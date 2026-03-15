#!/usr/bin/env node
/*
 * Repair utility for account-owner data isolation.
 *
 * Usage:
 *   node scripts/owner-scope-repair.js audit
 *   node scripts/owner-scope-repair.js safe-fix [--dry-run]
 *   node scripts/owner-scope-repair.js apply-map --map ./scripts/owner-map.json [--dry-run]
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, run, close, getDatabase } = require('../server/database/connection');

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function toPositiveInt(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    const normalized = Math.floor(parsed);
    return normalized > 0 ? normalized : 0;
}

function parseArgs(argv) {
    const [, , command, ...rest] = argv;
    const flags = {};
    for (let i = 0; i < rest.length; i++) {
        const token = String(rest[i] || '').trim();
        if (!token.startsWith('--')) continue;
        const key = token.slice(2);
        const next = String(rest[i + 1] || '').trim();
        if (!next || next.startsWith('--')) {
            flags[key] = true;
            continue;
        }
        flags[key] = next;
        i += 1;
    }
    return { command: String(command || '').trim(), flags };
}

function printSection(title) {
    console.log('');
    console.log(`=== ${title} ===`);
}

function printUsers(users) {
    const rows = users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        owner_user_id: user.owner_user_id,
        owner_exists: user.owner_exists ? 'yes' : 'no',
        owner_name: user.owner_name || '',
        owner_email: user.owner_email || ''
    }));
    console.table(rows);
}

function buildGroupedSummary(users) {
    const groups = new Map();
    for (const user of users) {
        const key = toPositiveInt(user.owner_user_id) || user.id;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(user);
    }

    const summary = [];
    for (const [ownerId, members] of groups.entries()) {
        const owner = members.find((item) => item.id === ownerId) || null;
        summary.push({
            owner_id: ownerId,
            owner_name: owner?.name || '(owner user missing)',
            owner_email: owner?.email || '',
            users_total: members.length,
            admins_total: members.filter((item) => String(item.role || '').toLowerCase() === 'admin').length
        });
    }

    summary.sort((a, b) => a.owner_id - b.owner_id);
    return summary;
}

async function getUsersWithOwnerInfo() {
    return await query(
        `
        SELECT
            u.id,
            u.name,
            u.email,
            u.role,
            u.is_active,
            u.owner_user_id,
            owner.id AS owner_id_exists,
            owner.name AS owner_name,
            owner.email AS owner_email
        FROM users u
        LEFT JOIN users owner ON owner.id = u.owner_user_id
        ORDER BY u.id ASC
        `
    );
}

async function printOwnerDataDistribution() {
    printSection('Distribuicao por owner (dados sensiveis)');

    const createdByTables = [
        'whatsapp_sessions',
        'tags',
        'templates',
        'campaigns',
        'automations',
        'flows',
        'webhooks',
        'custom_events'
    ];

    for (const tableName of createdByTables) {
        const rows = await query(
            `
            SELECT
                COALESCE(owner_scope.owner_user_id, owner_scope.id, 0) AS owner_id,
                COUNT(*) AS total
            FROM ${tableName} t
            LEFT JOIN users owner_scope ON owner_scope.id = t.created_by
            GROUP BY COALESCE(owner_scope.owner_user_id, owner_scope.id, 0)
            ORDER BY owner_id ASC
            `
        );
        console.log(`- ${tableName}`);
        console.table(rows);
    }

    const leadRows = await query(
        `
        SELECT
            COALESCE(owner_scope.owner_user_id, owner_scope.id, 0) AS owner_id,
            COUNT(*) AS total
        FROM leads l
        LEFT JOIN users owner_scope ON owner_scope.id = l.assigned_to
        GROUP BY COALESCE(owner_scope.owner_user_id, owner_scope.id, 0)
        ORDER BY owner_id ASC
        `
    );
    console.log('- leads');
    console.table(leadRows);

    const conversationRows = await query(
        `
        SELECT
            COALESCE(owner_scope.owner_user_id, owner_scope.id, 0) AS owner_id,
            COUNT(*) AS total
        FROM conversations c
        LEFT JOIN users owner_scope ON owner_scope.id = c.assigned_to
        GROUP BY COALESCE(owner_scope.owner_user_id, owner_scope.id, 0)
        ORDER BY owner_id ASC
        `
    );
    console.log('- conversations');
    console.table(conversationRows);

    const settingsRows = await query(
        `
        SELECT
            key
        FROM settings
        WHERE key LIKE 'user:%:%'
        ORDER BY key ASC
        LIMIT 200
        `
    );
    console.log('- settings keys (prefixadas por owner, limite 200)');
    console.table(settingsRows);
}

async function audit() {
    const users = await getUsersWithOwnerInfo();
    const decorated = users.map((row) => ({
        ...row,
        owner_exists: Boolean(row.owner_id_exists)
    }));

    printSection('Usuarios (owner atual)');
    printUsers(decorated);

    printSection('Resumo por owner');
    console.table(buildGroupedSummary(decorated));

    const invalidOwners = decorated.filter((item) => toPositiveInt(item.owner_user_id) <= 0 || !item.owner_exists);
    printSection('Usuarios com owner invalido/ausente');
    if (!invalidOwners.length) {
        console.log('Nenhum usuario com owner invalido.');
    } else {
        console.table(
            invalidOwners.map((item) => ({
                id: item.id,
                name: item.name,
                email: item.email,
                role: item.role,
                owner_user_id: item.owner_user_id
            }))
        );
    }

    await printOwnerDataDistribution();
}

async function safeFix(options = {}) {
    const dryRun = options.dryRun === true;
    const users = await getUsersWithOwnerInfo();
    const candidates = users.filter((item) => {
        const ownerId = toPositiveInt(item.owner_user_id);
        return ownerId <= 0 || !item.owner_id_exists;
    });

    printSection('Safe fix (owner invalido -> owner proprio)');
    if (!candidates.length) {
        console.log('Nenhuma correcao necessaria.');
        return;
    }

    console.table(
        candidates.map((item) => ({
            user_id: item.id,
            user_email: item.email,
            old_owner_user_id: item.owner_user_id,
            new_owner_user_id: item.id
        }))
    );

    if (dryRun) {
        console.log('Dry-run ativo: nenhuma alteracao foi aplicada.');
        return;
    }

    for (const item of candidates) {
        await run('UPDATE users SET owner_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item.id, item.id]);
    }

    console.log(`Correcao aplicada em ${candidates.length} usuario(s).`);
}

async function applyMap(options = {}) {
    const dryRun = options.dryRun === true;
    const mapPathRaw = String(options.mapPath || '').trim();
    if (!mapPathRaw) {
        throw new Error('Use --map <caminho-json>');
    }

    const mapPath = path.isAbsolute(mapPathRaw)
        ? mapPathRaw
        : path.resolve(process.cwd(), mapPathRaw);

    if (!fs.existsSync(mapPath)) {
        throw new Error(`Arquivo de mapeamento nao encontrado: ${mapPath}`);
    }

    const mapRaw = fs.readFileSync(mapPath, 'utf8');
    const payload = JSON.parse(mapRaw);
    const userOwnerMapById = payload?.user_owner_map && typeof payload.user_owner_map === 'object'
        ? payload.user_owner_map
        : {};
    const userOwnerMapByEmail = payload?.user_owner_map_by_email && typeof payload.user_owner_map_by_email === 'object'
        ? payload.user_owner_map_by_email
        : {};

    const users = await query('SELECT id, email, owner_user_id FROM users');
    const usersById = new Map(users.map((item) => [toPositiveInt(item.id), item]));
    const usersByEmail = new Map(users.map((item) => [normalizeEmail(item.email), item]));

    const updates = [];

    for (const [rawUserId, rawOwnerId] of Object.entries(userOwnerMapById)) {
        const userId = toPositiveInt(rawUserId);
        const ownerUserId = toPositiveInt(rawOwnerId);
        if (!userId || !ownerUserId) continue;
        if (!usersById.has(userId)) continue;
        if (!usersById.has(ownerUserId)) continue;
        updates.push({ userId, ownerUserId, source: 'id-map' });
    }

    for (const [rawEmail, rawOwnerRef] of Object.entries(userOwnerMapByEmail)) {
        const userEmail = normalizeEmail(rawEmail);
        const targetUser = usersByEmail.get(userEmail);
        if (!targetUser) continue;

        let ownerUserId = 0;
        const ownerRef = String(rawOwnerRef || '').trim();
        if (ownerRef.includes('@')) {
            ownerUserId = toPositiveInt(usersByEmail.get(normalizeEmail(ownerRef))?.id);
        } else {
            ownerUserId = toPositiveInt(ownerRef);
        }
        if (!ownerUserId || !usersById.has(ownerUserId)) continue;

        updates.push({
            userId: toPositiveInt(targetUser.id),
            ownerUserId,
            source: 'email-map'
        });
    }

    const deduped = [];
    const seen = new Set();
    for (const update of updates) {
        const key = `${update.userId}:${update.ownerUserId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(update);
    }

    printSection('Mapa de correcao');
    if (!deduped.length) {
        console.log('Nenhuma atualizacao valida encontrada no arquivo de mapeamento.');
        return;
    }
    console.table(deduped);

    if (dryRun) {
        console.log('Dry-run ativo: nenhuma alteracao foi aplicada.');
        return;
    }

    for (const update of deduped) {
        await run(
            'UPDATE users SET owner_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [update.ownerUserId, update.userId]
        );
    }

    console.log(`Mapa aplicado em ${deduped.length} usuario(s).`);
}

function printUsage() {
    console.log('Uso:');
    console.log('  node scripts/owner-scope-repair.js audit');
    console.log('  node scripts/owner-scope-repair.js safe-fix [--dry-run]');
    console.log('  node scripts/owner-scope-repair.js apply-map --map ./scripts/owner-map.json [--dry-run]');
}

async function main() {
    const { command, flags } = parseArgs(process.argv);
    const dryRun = Boolean(flags['dry-run']);

    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL nao definida. Rode no ambiente do servidor/railway com acesso ao banco.');
    }

    getDatabase();

    if (!command || command === 'help' || command === '--help' || command === '-h') {
        printUsage();
        return;
    }

    if (command === 'audit') {
        await audit();
        return;
    }

    if (command === 'safe-fix') {
        await safeFix({ dryRun });
        return;
    }

    if (command === 'apply-map') {
        await applyMap({ mapPath: flags.map, dryRun });
        return;
    }

    printUsage();
    throw new Error(`Comando desconhecido: ${command}`);
}

main()
    .catch((error) => {
        console.error('[owner-scope-repair] Erro:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await close();
    });

