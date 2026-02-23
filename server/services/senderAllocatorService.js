/**
 * Alocador de conta de envio WhatsApp para campanhas/transmissoes.
 * Estratégias suportadas: single, round_robin, weighted_round_robin, random.
 */

const { query } = require('../database/connection');
const { CampaignSenderAccount, WhatsAppSession } = require('../database/models');
const { DEFAULT_WHATSAPP_SESSION_ID } = require('../config/sessionDefaults');

class SenderAllocatorService {
    constructor(options = {}) {
        this.runtimeSessionsGetter = typeof options.getRuntimeSessions === 'function'
            ? options.getRuntimeSessions
            : () => new Map();
        this.defaultSessionId = this.sanitizeSessionId(options.defaultSessionId) || DEFAULT_WHATSAPP_SESSION_ID;
        this.cursorByScope = new Map();
    }

    setRuntimeSessionsGetter(getter) {
        if (typeof getter === 'function') {
            this.runtimeSessionsGetter = getter;
        }
    }

    setDefaultSessionId(sessionId) {
        const normalized = this.sanitizeSessionId(sessionId);
        if (normalized) {
            this.defaultSessionId = normalized;
        }
    }

    sanitizeSessionId(value) {
        return String(value || '').trim();
    }

    normalizeStrategy(value, fallback = 'round_robin') {
        const normalized = String(value || '').trim().toLowerCase();
        if (!normalized) return fallback;
        if (normalized === 'single') return 'single';
        if (normalized === 'round_robin' || normalized === 'round-robin' || normalized === 'roundrobin') {
            return 'round_robin';
        }
        if (
            normalized === 'weighted_round_robin' ||
            normalized === 'weighted-round-robin' ||
            normalized === 'weighted' ||
            normalized === 'weighted_rr'
        ) {
            return 'weighted_round_robin';
        }
        if (normalized === 'random' || normalized === 'aleatorio' || normalized === 'aleatório') {
            return 'random';
        }
        return fallback;
    }

    toBoolean(value, fallback = true) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value > 0;
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (['1', 'true', 'yes', 'sim', 'on'].includes(normalized)) return true;
            if (['0', 'false', 'no', 'nao', 'não', 'off'].includes(normalized)) return false;
        }
        return fallback;
    }

    toNonNegativeInt(value, fallback = 0) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        const normalized = Math.floor(parsed);
        return normalized >= 0 ? normalized : fallback;
    }

    toPositiveInt(value, fallback = 0) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        const normalized = Math.floor(parsed);
        return normalized > 0 ? normalized : fallback;
    }

    normalizeSenderAccounts(rawAccounts = []) {
        if (!Array.isArray(rawAccounts)) return [];

        const result = [];
        const seen = new Set();

        for (const account of rawAccounts) {
            const sessionId = this.sanitizeSessionId(account?.session_id || account?.sessionId || account);
            if (!sessionId || seen.has(sessionId)) continue;
            seen.add(sessionId);

            result.push({
                session_id: sessionId,
                weight: Math.max(1, this.toNonNegativeInt(account?.weight, 1)),
                daily_limit: this.toNonNegativeInt(account?.daily_limit ?? account?.dailyLimit, 0),
                is_active: this.toBoolean(account?.is_active ?? account?.isActive, true)
            });
        }

        return result;
    }

    getRuntimeSessionsMap() {
        try {
            const sessions = this.runtimeSessionsGetter();
            if (sessions instanceof Map) return sessions;
        } catch (_) {
            // fallback
        }
        return new Map();
    }

    isInCooldown(cooldownUntil, nowMs = Date.now()) {
        if (!cooldownUntil) return false;
        const parsed = Date.parse(String(cooldownUntil));
        if (!Number.isFinite(parsed)) return false;
        return parsed > nowMs;
    }

    getTodayWindow() {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return {
            startIso: start.toISOString(),
            endIso: end.toISOString()
        };
    }

    async listDispatchSessions(options = {}) {
        const includeDisabled = options.includeDisabled !== false;
        const ownerUserId = this.toPositiveInt(options.ownerUserId, 0);
        const hasOwnerScope = ownerUserId > 0;
        const storedSessions = await WhatsAppSession.list({
            includeDisabled: true,
            created_by: hasOwnerScope ? ownerUserId : undefined
        });
        const runtimeSessions = this.getRuntimeSessionsMap();

        const merged = [];
        const seen = new Set();

        for (const row of storedSessions) {
            const sessionId = this.sanitizeSessionId(row.session_id);
            if (!sessionId) continue;
            seen.add(sessionId);

            const runtime = runtimeSessions.get(sessionId);
            const connected = Boolean(runtime?.isConnected);

            merged.push({
                ...row,
                session_id: sessionId,
                connected,
                status: connected ? 'connected' : String(row.status || 'disconnected'),
                campaign_enabled: this.toBoolean(row.campaign_enabled, true),
                daily_limit: this.toNonNegativeInt(row.daily_limit, 0),
                dispatch_weight: Math.max(1, this.toNonNegativeInt(row.dispatch_weight, 1)),
                hourly_limit: this.toNonNegativeInt(row.hourly_limit, 0)
            });
        }

        for (const [sessionId, runtime] of runtimeSessions.entries()) {
            const normalizedSessionId = this.sanitizeSessionId(sessionId);
            if (!normalizedSessionId || seen.has(normalizedSessionId)) continue;
            if (hasOwnerScope) continue;
            merged.push({
                id: null,
                session_id: normalizedSessionId,
                phone: runtime?.user?.phone || null,
                name: runtime?.user?.name || runtime?.user?.pushName || null,
                status: runtime?.isConnected ? 'connected' : 'disconnected',
                connected: Boolean(runtime?.isConnected),
                campaign_enabled: true,
                daily_limit: 0,
                dispatch_weight: 1,
                hourly_limit: 0,
                cooldown_until: null,
                qr_code: null,
                last_connected_at: null,
                created_by: null,
                created_at: null,
                updated_at: null
            });
        }

        if (!includeDisabled) {
            return merged.filter((row) => row.campaign_enabled);
        }

        return merged;
    }

    async getCampaignSenderAccounts(campaignId, options = {}) {
        const numericCampaignId = Number(campaignId);
        if (!Number.isFinite(numericCampaignId) || numericCampaignId <= 0) {
            return [];
        }
        return await CampaignSenderAccount.listByCampaignId(numericCampaignId, options);
    }

    async replaceCampaignSenderAccounts(campaignId, senderAccounts = []) {
        const numericCampaignId = Number(campaignId);
        if (!Number.isFinite(numericCampaignId) || numericCampaignId <= 0) {
            throw new Error('campaign_id invalido para vincular contas de envio');
        }
        const normalized = this.normalizeSenderAccounts(senderAccounts);
        return await CampaignSenderAccount.replaceForCampaign(numericCampaignId, normalized);
    }

    async getUsageBySessionIds(sessionIds = []) {
        const normalized = Array.from(new Set(
            sessionIds
                .map((value) => this.sanitizeSessionId(value))
                .filter(Boolean)
        ));

        const usage = {};
        for (const sessionId of normalized) {
            usage[sessionId] = 0;
        }

        if (!normalized.length) {
            return usage;
        }

        const placeholders = normalized.map(() => '?').join(', ');
        const { startIso, endIso } = this.getTodayWindow();
        const rows = await query(`
            SELECT session_id, COUNT(*) AS total
            FROM message_queue
            WHERE session_id IN (${placeholders})
              AND COALESCE(is_first_contact, 1) = 1
              AND status IN ('pending', 'processing', 'sent')
              AND COALESCE(processed_at, created_at) >= ?
              AND COALESCE(processed_at, created_at) < ?
            GROUP BY session_id
        `, [...normalized, startIso, endIso]);

        for (const row of rows) {
            const sessionId = this.sanitizeSessionId(row.session_id);
            if (!sessionId) continue;
            usage[sessionId] = this.toNonNegativeInt(row.total, 0);
        }

        return usage;
    }

    buildRoundRobinOrder(strategy, states) {
        if (strategy !== 'weighted_round_robin') {
            return states.map((_, index) => index);
        }

        const order = [];
        for (let index = 0; index < states.length; index++) {
            const repeats = Math.max(1, this.toNonNegativeInt(states[index].weight, 1));
            for (let rep = 0; rep < repeats; rep++) {
                order.push(index);
            }
        }
        return order.length ? order : states.map((_, index) => index);
    }

    getCursor(scope, modulo) {
        if (!modulo || modulo <= 0) return 0;
        const current = Number(this.cursorByScope.get(scope) || 0);
        if (!Number.isFinite(current)) return 0;
        const normalized = current % modulo;
        return normalized >= 0 ? normalized : normalized + modulo;
    }

    setCursor(scope, value, modulo) {
        if (!modulo || modulo <= 0) return;
        const normalized = Number(value);
        const next = Number.isFinite(normalized) ? normalized : 0;
        this.cursorByScope.set(scope, next % modulo);
    }

    pickAvailableStateIndex(order, states, scope) {
        if (!order.length) return -1;

        const startCursor = this.getCursor(scope, order.length);
        for (let offset = 0; offset < order.length; offset++) {
            const ringIndex = (startCursor + offset) % order.length;
            const stateIndex = order[ringIndex];
            const state = states[stateIndex];
            if (!state) continue;
            if (state.remaining <= 0) continue;

            this.setCursor(scope, ringIndex + 1, order.length);
            return stateIndex;
        }

        return -1;
    }

    pickRandomAvailableStateIndex(states) {
        const availableIndexes = [];
        for (let index = 0; index < states.length; index++) {
            const state = states[index];
            if (!state) continue;
            if (state.remaining <= 0) continue;
            availableIndexes.push(index);
        }

        if (!availableIndexes.length) return -1;
        const randomPos = Math.floor(Math.random() * availableIndexes.length);
        return availableIndexes[randomPos];
    }

    async resolvePool(options = {}) {
        const campaignId = Number(options.campaignId);
        let senderAccounts = this.normalizeSenderAccounts(options.senderAccounts || []);
        const defaultSessionId = this.sanitizeSessionId(options.defaultSessionId || this.defaultSessionId);
        const ownerUserId = this.toPositiveInt(options.ownerUserId, 0);

        if (!senderAccounts.length && Number.isFinite(campaignId) && campaignId > 0) {
            senderAccounts = this.normalizeSenderAccounts(
                await this.getCampaignSenderAccounts(campaignId, { onlyActive: true })
            );
        }

        const sessions = await this.listDispatchSessions({
            includeDisabled: true,
            ownerUserId: ownerUserId || undefined
        });
        const sessionsById = new Map(
            sessions.map((session) => [this.sanitizeSessionId(session.session_id), session])
        );

        const pool = [];
        const pushCandidate = (candidate) => {
            const sessionId = this.sanitizeSessionId(candidate?.session_id);
            if (!sessionId) return;
            if (pool.some((item) => item.session_id === sessionId)) return;
            pool.push({
                session_id: sessionId,
                weight: Math.max(1, this.toNonNegativeInt(candidate?.weight, 1)),
                account_daily_limit: this.toNonNegativeInt(candidate?.daily_limit, 0),
                is_active: this.toBoolean(candidate?.is_active, true),
                campaign_enabled: this.toBoolean(candidate?.campaign_enabled, true),
                session_daily_limit: this.toNonNegativeInt(candidate?.session_daily_limit, 0),
                status: String(candidate?.status || 'disconnected'),
                connected: Boolean(candidate?.connected),
                cooldown_until: candidate?.cooldown_until || null,
                phone: candidate?.phone || null,
                name: candidate?.name || null
            });
        };

        if (senderAccounts.length) {
            for (const account of senderAccounts) {
                const sessionId = this.sanitizeSessionId(account.session_id);
                if (!sessionId) continue;
                const storedSession = sessionsById.get(sessionId);
                pushCandidate({
                    session_id: sessionId,
                    weight: account.weight,
                    daily_limit: account.daily_limit,
                    is_active: account.is_active,
                    campaign_enabled: storedSession?.campaign_enabled ?? true,
                    session_daily_limit: storedSession?.daily_limit ?? 0,
                    status: storedSession?.status,
                    connected: storedSession?.connected ?? false,
                    cooldown_until: storedSession?.cooldown_until || null,
                    phone: storedSession?.phone || null,
                    name: storedSession?.name || null
                });
            }
        } else {
            for (const session of sessions) {
                pushCandidate({
                    session_id: session.session_id,
                    weight: this.toNonNegativeInt(session.dispatch_weight, 1) || 1,
                    daily_limit: session.daily_limit,
                    is_active: true,
                    campaign_enabled: session.campaign_enabled,
                    session_daily_limit: session.daily_limit,
                    status: session.status,
                    connected: session.connected,
                    cooldown_until: session.cooldown_until,
                    phone: session.phone,
                    name: session.name
                });
            }
        }

        if (!pool.length && defaultSessionId) {
            const fallbackSession = sessionsById.get(defaultSessionId);
            pushCandidate({
                session_id: defaultSessionId,
                weight: this.toNonNegativeInt(fallbackSession?.dispatch_weight, 1) || 1,
                daily_limit: fallbackSession?.daily_limit ?? 0,
                is_active: true,
                campaign_enabled: fallbackSession?.campaign_enabled ?? true,
                session_daily_limit: fallbackSession?.daily_limit ?? 0,
                status: fallbackSession?.status || 'disconnected',
                connected: fallbackSession?.connected ?? false,
                cooldown_until: fallbackSession?.cooldown_until || null,
                phone: fallbackSession?.phone || null,
                name: fallbackSession?.name || null
            });
        }

        return pool
            .filter((entry) => entry.is_active && entry.campaign_enabled)
            .filter((entry) => !this.isInCooldown(entry.cooldown_until));
    }

    async buildDistributionPlan(options = {}) {
        const strategy = this.normalizeStrategy(options.strategy, 'round_robin');
        const fixedSessionId = this.sanitizeSessionId(options.fixedSessionId || options.sessionId);
        const excludeSessionIds = new Set(
            (Array.isArray(options.excludeSessionIds) ? options.excludeSessionIds : [])
                .map((sessionId) => this.sanitizeSessionId(sessionId))
                .filter(Boolean)
        );

        const uniqueLeadIds = Array.from(new Set(
            (Array.isArray(options.leadIds) ? options.leadIds : [])
                .map((value) => Number(value))
                .filter((value) => Number.isFinite(value) && value > 0)
        ));

        if (!uniqueLeadIds.length) {
            return {
                strategyUsed: strategy,
                assignmentsByLead: {},
                assignmentMetaByLead: {},
                summary: {}
            };
        }

        let pool = await this.resolvePool({
            campaignId: options.campaignId,
            senderAccounts: options.senderAccounts,
            defaultSessionId: options.defaultSessionId,
            ownerUserId: options.ownerUserId
        });

        if (fixedSessionId) {
            pool = pool.filter((entry) => entry.session_id === fixedSessionId);
            if (!pool.length) {
                throw new Error(`Conta fixa de envio nao encontrada: ${fixedSessionId}`);
            }
        }

        pool = pool.filter((entry) => !excludeSessionIds.has(entry.session_id));
        if (!pool.length) {
            throw new Error('Nenhuma conta de WhatsApp habilitada para envio');
        }

        const connectedPool = pool.filter((entry) => entry.connected);
        if (!connectedPool.length) {
            throw new Error('Nenhuma conta de WhatsApp conectada para envio');
        }

        const usageBySession = await this.getUsageBySessionIds(connectedPool.map((entry) => entry.session_id));
        const states = connectedPool.map((entry) => {
            const limitFromAccount = this.toNonNegativeInt(entry.account_daily_limit, 0);
            const limitFromSession = this.toNonNegativeInt(entry.session_daily_limit, 0);
            const effectiveLimit = limitFromAccount > 0 ? limitFromAccount : (limitFromSession > 0 ? limitFromSession : 0);
            const used = this.toNonNegativeInt(usageBySession[entry.session_id], 0);
            const remaining = effectiveLimit > 0 ? Math.max(0, effectiveLimit - used) : Number.POSITIVE_INFINITY;
            return {
                ...entry,
                effective_daily_limit: effectiveLimit,
                used,
                remaining
            };
        }).filter((entry) => entry.remaining > 0);

        if (!states.length) {
            throw new Error('Todas as contas de envio atingiram o limite diário configurado');
        }

        const strategyUsed = fixedSessionId ? 'single' : strategy;
        const scope = [
            Number(options.campaignId) || 'bulk',
            strategyUsed,
            states.map((entry) => entry.session_id).join('|')
        ].join(':');

        const assignmentsByLead = {};
        const assignmentMetaByLead = {};
        const summary = {};

        const assignLead = (leadId, state) => {
            if (!state) return;
            const key = String(leadId);
            assignmentsByLead[key] = state.session_id;
            assignmentMetaByLead[key] = {
                strategy: strategyUsed,
                session_id: state.session_id,
                campaign_id: Number(options.campaignId) || null,
                assigned_at: new Date().toISOString(),
                daily_limit: state.effective_daily_limit || 0
            };
            summary[state.session_id] = (summary[state.session_id] || 0) + 1;
            if (Number.isFinite(state.remaining)) {
                state.remaining = Math.max(0, state.remaining - 1);
            }
        };

        if (strategyUsed === 'single') {
            const state = states[0];
            for (const leadId of uniqueLeadIds) {
                if (state.remaining <= 0) {
                    throw new Error('Limite diário da conta de envio foi atingido durante a alocação');
                }
                assignLead(leadId, state);
            }
            return { strategyUsed, assignmentsByLead, assignmentMetaByLead, summary };
        }

        if (strategyUsed === 'random') {
            for (const leadId of uniqueLeadIds) {
                const selectedIndex = this.pickRandomAvailableStateIndex(states);
                if (selectedIndex < 0) {
                    throw new Error('Capacidade diária de envio esgotada para as contas selecionadas');
                }
                assignLead(leadId, states[selectedIndex]);
            }
            return { strategyUsed, assignmentsByLead, assignmentMetaByLead, summary };
        }

        const order = this.buildRoundRobinOrder(strategyUsed, states);
        for (const leadId of uniqueLeadIds) {
            const selectedIndex = this.pickAvailableStateIndex(order, states, scope);
            if (selectedIndex < 0) {
                throw new Error('Capacidade diária de envio esgotada para as contas selecionadas');
            }
            assignLead(leadId, states[selectedIndex]);
        }

        return { strategyUsed, assignmentsByLead, assignmentMetaByLead, summary };
    }

    async allocateForSingleLead(options = {}) {
        const leadId = Number(options.leadId);
        const normalizedLeadId = Number.isFinite(leadId) && leadId > 0 ? leadId : 1;
        const plan = await this.buildDistributionPlan({
            leadIds: [normalizedLeadId],
            campaignId: options.campaignId,
            senderAccounts: options.senderAccounts,
            strategy: options.strategy,
            sessionId: options.sessionId,
            fixedSessionId: options.fixedSessionId,
            defaultSessionId: options.defaultSessionId,
            excludeSessionIds: options.excludeSessionIds,
            ownerUserId: options.ownerUserId
        });
        const key = String(normalizedLeadId);
        return {
            sessionId: plan.assignmentsByLead[key] || null,
            assignmentMeta: plan.assignmentMetaByLead[key] || null,
            strategyUsed: plan.strategyUsed
        };
    }
}

module.exports = new SenderAllocatorService();
module.exports.SenderAllocatorService = SenderAllocatorService;
