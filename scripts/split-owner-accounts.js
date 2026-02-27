#!/usr/bin/env node
/*
 * Separa dados por owner/admin account.
 *
 * Default: DRY-RUN (faz rollback no final)
 * Apply:   node scripts/split-owner-accounts.js --apply
 *
 * Exemplo:
 * node scripts/split-owner-accounts.js \
 *   --apply \
 *   --primary-email rotelliofficial@gmail.com \
 *   --secondary-email tarso.thyago@gmail.com \
 *   --secondary-since 2026-02-15
 */

const { getDatabase, close } = require('../server/database/connection');

function parseCsv(value) {
    if (!value) return [];
    return String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function toPgStatement(sql, params = []) {
    let index = 0;
    const converted = String(sql).replace(/\?/g, () => `$${++index}`);
    return { sql: converted, params };
}

async function queryRows(client, sql, params = []) {
    const stmt = toPgStatement(sql, params);
    try {
        const result = await client.query(stmt.sql, stmt.params);
        return result.rows || [];
    } catch (error) {
        const preview = stmt.sql.replace(/\s+/g, ' ').trim().slice(0, 220);
        const typedParams = (stmt.params || []).map((value) => `${typeof value}:${String(value).slice(0, 60)}`);
        throw new Error(`${error.message} | query=${preview} | params=${typedParams.join(',')}`);
    }
}

async function exec(client, sql, params = []) {
    const stmt = toPgStatement(sql, params);
    try {
        const result = await client.query(stmt.sql, stmt.params);
        return Number(result.rowCount || 0);
    } catch (error) {
        const preview = stmt.sql.replace(/\s+/g, ' ').trim().slice(0, 220);
        const typedParams = (stmt.params || []).map((value) => `${typeof value}:${String(value).slice(0, 60)}`);
        throw new Error(`${error.message} | query=${preview} | params=${typedParams.join(',')}`);
    }
}

function parseArgs(argv) {
    const options = {
        apply: false,
        primaryEmail: 'rotelliofficial@gmail.com',
        secondaryEmail: 'tarso.thyago@gmail.com',
        secondarySince: null,
        secondaryLeadIds: [],
        secondaryUserEmails: [],
        secondarySessionIds: [],
        cleanupGlobalSettings: false,
        help: false
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = String(argv[i] || '').trim();
        if (!arg) continue;

        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }
        if (arg === '--apply') {
            options.apply = true;
            continue;
        }
        if (arg === '--cleanup-global-settings') {
            options.cleanupGlobalSettings = true;
            continue;
        }

        const nextValue = argv[i + 1];
        if (!nextValue) continue;

        if (arg === '--primary-email') {
            options.primaryEmail = normalizeEmail(nextValue);
            i += 1;
            continue;
        }
        if (arg === '--secondary-email') {
            options.secondaryEmail = normalizeEmail(nextValue);
            i += 1;
            continue;
        }
        if (arg === '--secondary-since') {
            options.secondarySince = String(nextValue).trim();
            i += 1;
            continue;
        }
        if (arg === '--secondary-lead-ids') {
            options.secondaryLeadIds = parseCsv(nextValue)
                .map((item) => Number(item))
                .filter((item) => Number.isInteger(item) && item > 0);
            i += 1;
            continue;
        }
        if (arg === '--secondary-user-emails') {
            options.secondaryUserEmails = parseCsv(nextValue).map(normalizeEmail);
            i += 1;
            continue;
        }
        if (arg === '--secondary-session-ids') {
            options.secondarySessionIds = parseCsv(nextValue);
            i += 1;
            continue;
        }
    }

    return options;
}

function printHelp() {
    console.log(`
Uso:
  node scripts/split-owner-accounts.js [opcoes]

Opcoes:
  --apply                         Aplica alteracoes (sem isso, roda dry-run)
  --primary-email <email>         Owner principal (default: rotelliofficial@gmail.com)
  --secondary-email <email>       Segundo owner (default: tarso.thyago@gmail.com)
  --secondary-since <YYYY-MM-DD>  Inclui leads criados a partir desta data no owner secundario
  --secondary-lead-ids <ids>      Lista de lead IDs para owner secundario (ex: 1,2,3)
  --secondary-user-emails <list>  Usuarios (emails) que devem ficar sob owner secundario
  --secondary-session-ids <list>  Session IDs do WhatsApp para owner secundario
  --cleanup-global-settings       Remove chaves globais de settings apos copiar para scoped
  -h, --help                      Mostra esta ajuda

Exemplo:
  node scripts/split-owner-accounts.js --apply --secondary-since 2026-02-15
`);
}

function buildInClause(values = []) {
    const normalized = Array.isArray(values) ? values : [];
    if (!normalized.length) {
        return { placeholders: '', params: [] };
    }
    const placeholders = normalized.map(() => '?').join(', ');
    return { placeholders, params: normalized };
}

async function ensureOwnerColumn(client) {
    const rows = await queryRows(client, `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'owner_user_id'
        LIMIT 1
    `);
    if (!rows.length) {
        throw new Error('Coluna users.owner_user_id ausente. Execute "npm run db:migrate" antes.');
    }
}

async function findUserByEmail(client, email) {
    const rows = await queryRows(client, `
        SELECT id, uuid, name, email, role, is_active, owner_user_id
        FROM users
        WHERE LOWER(email) = LOWER(?)
        LIMIT 1
    `, [email]);
    return rows[0] || null;
}

async function updateUserOwnerAndRole(client, userId, ownerUserId, forceAdmin = false) {
    const updates = [];
    const params = [];
    updates.push('owner_user_id = ?');
    params.push(ownerUserId);

    if (forceAdmin) {
        updates.push("role = 'admin'");
        updates.push('is_active = 1');
    }

    params.push(userId);
    return exec(client, `
        UPDATE users
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, params);
}

async function syncCreatedByByOwner(client, tableName, primaryOwnerId, secondaryOwnerId) {
    const columnCheck = await queryRows(client, `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ?
          AND column_name = 'created_by'
        LIMIT 1
    `, [tableName]);
    if (!columnCheck.length) return { mapped: 0, nullToPrimary: 0 };

    const mapped = await exec(client, `
        UPDATE ${tableName} t
        SET created_by = CASE
            WHEN (u.id = ? OR u.owner_user_id = ?) THEN (?::integer)
            ELSE (?::integer)
        END
        FROM users u
        WHERE t.created_by IS NOT NULL
          AND t.created_by::text = u.id::text
          AND t.created_by::text IS DISTINCT FROM (CASE
              WHEN (u.id = ? OR u.owner_user_id = ?) THEN (?::integer)
              ELSE (?::integer)
          END)::text
    `, [
        secondaryOwnerId, secondaryOwnerId, secondaryOwnerId, primaryOwnerId,
        secondaryOwnerId, secondaryOwnerId, secondaryOwnerId, primaryOwnerId
    ]);

    const nullToPrimary = await exec(client, `
        UPDATE ${tableName}
        SET created_by = ?
        WHERE created_by IS NULL
    `, [primaryOwnerId]);

    return { mapped, nullToPrimary };
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const db = getDatabase();
    const client = await db.connect();
    const metrics = {
        usersOwnerUpdated: 0,
        leadsToSecondary: 0,
        leadsToPrimary: 0,
        conversationsToSecondary: 0,
        conversationsToPrimary: 0,
        settingsScopedUpserts: 0,
        settingsGlobalDeleted: 0,
        sessionsToSecondary: 0
    };

    try {
        await client.query('BEGIN');
        await ensureOwnerColumn(client);

        const primary = await findUserByEmail(client, options.primaryEmail);
        const secondary = await findUserByEmail(client, options.secondaryEmail);

        if (!primary) {
            throw new Error(`Usuario principal nao encontrado: ${options.primaryEmail}`);
        }
        if (!secondary) {
            throw new Error(`Usuario secundario nao encontrado: ${options.secondaryEmail}`);
        }
        if (Number(primary.id) === Number(secondary.id)) {
            throw new Error('Os emails principal e secundario apontam para o mesmo usuario.');
        }

        console.log(`Primary owner: #${primary.id} ${primary.email}`);
        console.log(`Secondary owner: #${secondary.id} ${secondary.email}`);
        console.log(`Mode: ${options.apply ? 'APPLY' : 'DRY-RUN (rollback)'}`);

        metrics.usersOwnerUpdated += await updateUserOwnerAndRole(client, primary.id, primary.id, true);
        metrics.usersOwnerUpdated += await updateUserOwnerAndRole(client, secondary.id, secondary.id, true);

        const allUsers = await queryRows(client, `
            SELECT id, email
            FROM users
            ORDER BY id ASC
        `);
        const secondaryEmailSet = new Set(options.secondaryUserEmails.map(normalizeEmail));
        for (const user of allUsers) {
            const id = Number(user.id);
            if (!id || id === Number(primary.id) || id === Number(secondary.id)) continue;
            const userEmail = normalizeEmail(user.email);
            const targetOwner = secondaryEmailSet.has(userEmail) ? Number(secondary.id) : Number(primary.id);
            metrics.usersOwnerUpdated += await updateUserOwnerAndRole(client, id, targetOwner, false);
        }

        const secondaryLeadIds = new Set(options.secondaryLeadIds);

        const leadAssignedRows = await queryRows(client, `
            SELECT id
            FROM leads
            WHERE assigned_to = ?
        `, [secondary.id]);
        for (const row of leadAssignedRows) {
            const id = Number(row.id);
            if (id > 0) secondaryLeadIds.add(id);
        }

        const convAssignedRows = await queryRows(client, `
            SELECT DISTINCT lead_id
            FROM conversations
            WHERE assigned_to = ?
        `, [secondary.id]);
        for (const row of convAssignedRows) {
            const id = Number(row.lead_id);
            if (id > 0) secondaryLeadIds.add(id);
        }

        if (options.secondarySince) {
            const sinceRows = await queryRows(client, `
                SELECT id
                FROM leads
                WHERE created_at >= ?
            `, [options.secondarySince]);
            for (const row of sinceRows) {
                const id = Number(row.id);
                if (id > 0) secondaryLeadIds.add(id);
            }
        }

        const secondaryLeadArray = Array.from(secondaryLeadIds.values());
        console.log(`Secondary leads selected: ${secondaryLeadArray.length}`);

        if (secondaryLeadArray.length > 0) {
            const leadIn = buildInClause(secondaryLeadArray);
            metrics.leadsToSecondary += await exec(client, `
                UPDATE leads
                SET assigned_to = ?
                WHERE id IN (${leadIn.placeholders})
            `, [secondary.id, ...leadIn.params]);

            metrics.leadsToPrimary += await exec(client, `
                UPDATE leads
                SET assigned_to = ?
                WHERE id NOT IN (${leadIn.placeholders})
            `, [primary.id, ...leadIn.params]);

            metrics.conversationsToSecondary += await exec(client, `
                UPDATE conversations
                SET assigned_to = ?
                WHERE lead_id IN (${leadIn.placeholders})
            `, [secondary.id, ...leadIn.params]);

            metrics.conversationsToPrimary += await exec(client, `
                UPDATE conversations
                SET assigned_to = ?
                WHERE lead_id NOT IN (${leadIn.placeholders})
            `, [primary.id, ...leadIn.params]);
        } else {
            metrics.leadsToPrimary += await exec(client, `
                UPDATE leads
                SET assigned_to = ?
            `, [primary.id]);

            metrics.conversationsToPrimary += await exec(client, `
                UPDATE conversations
                SET assigned_to = ?
            `, [primary.id]);
        }

        const globalSettings = await queryRows(client, `
            SELECT key, value, type
            FROM settings
            WHERE key NOT LIKE 'user:%'
            ORDER BY key ASC
        `);
        for (const row of globalSettings) {
            const scopedKey = `user:${primary.id}:${row.key}`;
            metrics.settingsScopedUpserts += await exec(client, `
                INSERT INTO settings (key, value, type, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (key) DO UPDATE SET
                    value = EXCLUDED.value,
                    type = EXCLUDED.type,
                    updated_at = CURRENT_TIMESTAMP
            `, [scopedKey, row.value, row.type || 'string']);
        }

        if (options.cleanupGlobalSettings) {
            metrics.settingsGlobalDeleted += await exec(client, `
                DELETE FROM settings
                WHERE key NOT LIKE 'user:%'
            `);
        }

        const createdByTables = [
            'flows',
            'templates',
            'campaigns',
            'automations',
            'custom_events',
            'webhooks',
            'tags',
            'whatsapp_sessions'
        ];

        for (const tableName of createdByTables) {
            const result = await syncCreatedByByOwner(client, tableName, Number(primary.id), Number(secondary.id));
            console.log(`Table ${tableName}: mapped=${result.mapped}, null_to_primary=${result.nullToPrimary}`);
        }

        if (options.secondarySessionIds.length > 0) {
            const sessionIn = buildInClause(options.secondarySessionIds);
            metrics.sessionsToSecondary += await exec(client, `
                UPDATE whatsapp_sessions
                SET created_by = ?
                WHERE session_id IN (${sessionIn.placeholders})
            `, [secondary.id, ...sessionIn.params]);
        }

        console.log('Summary:', metrics);

        if (options.apply) {
            await client.query('COMMIT');
            console.log('Migration applied successfully.');
        } else {
            await client.query('ROLLBACK');
            console.log('Dry-run completed. No data persisted.');
        }
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (_) {}
        console.error('Migration failed:', error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await close();
    }
}

main();
