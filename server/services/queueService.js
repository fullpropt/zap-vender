/**
 * SELF PROTECAO VEICULAR - Servico de Fila de Mensagens
 * Gerencia envio de mensagens em massa com delay para evitar bloqueios
 */

const { MessageQueue, Settings, Lead } = require('../database/models');
const { run, queryOne } = require('../database/connection');
const EventEmitter = require('events');

class QueueService extends EventEmitter {
    constructor() {
        super();
        this.isProcessing = false;
        this.intervalId = null;
        this.sendFunction = null;
        this.resolveSessionForMessage = null;
        this.defaultDelay = 3000; // 3 segundos entre mensagens
        this.maxMessagesPerMinute = 30;
        this.messagesSentThisMinute = 0;
        this.rateStateByOwner = new Map();
        this.queueSettingsCacheByOwner = new Map();
        this.queueSettingsCacheTtlMs = 30000;
        this.businessHoursCacheByOwner = new Map();
        this.businessHoursCacheTtlMs = 30000;
    }
    
    /**
     * Inicializar o servico de fila
     */
    async init(sendFunction, options = {}) {
        this.sendFunction = sendFunction;
        this.resolveSessionForMessage = typeof options.resolveSessionForMessage === 'function'
            ? options.resolveSessionForMessage
            : null;
        
        // Carregar configuracoes do banco
        const defaultSettings = await this.getQueueSettings(null, true);
        this.defaultDelay = defaultSettings.delay;
        this.maxMessagesPerMinute = defaultSettings.maxPerMinute;
        
        // Iniciar processamento
        this.startProcessing();
        
        console.log('Servico de fila de mensagens iniciado');
        console.log(`   - Delay entre mensagens: ${this.defaultDelay}ms`);
        console.log(`   - Maximo por minuto: ${this.maxMessagesPerMinute}`);
    }
    
    /**
     * Adicionar mensagem a fila
     */
    async add(options) {
        const {
            leadId,
            conversationId,
            campaignId,
            content,
            mediaType,
            mediaUrl,
            priority,
            scheduledAt,
            sessionId,
            isFirstContact,
            assignmentMeta
        } = options;
        
        const result = await MessageQueue.add({
            lead_id: leadId,
            conversation_id: conversationId,
            campaign_id: campaignId || null,
            session_id: sessionId || null,
            is_first_contact: isFirstContact !== false,
            assignment_meta: assignmentMeta || null,
            content,
            media_type: mediaType || 'text',
            media_url: mediaUrl,
            priority: priority || 0,
            scheduled_at: scheduledAt
        });
        
        this.emit('message:queued', { id: result.id, leadId, content });
        
        return result;
    }
    
    /**
     * Adicionar multiplas mensagens (disparo em massa)
     */
    async addBulk(leadIds, content, options = {}) {
        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            return [];
        }

        const ownerUserId = this.normalizeOwnerUserId(options.ownerUserId || options.owner_user_id || null) || null;
        const queueSettings = await this.getQueueSettings(ownerUserId || null);

        const results = [];
        const sessionAssignments = (options.sessionAssignments && typeof options.sessionAssignments === 'object')
            ? options.sessionAssignments
            : {};
        const assignmentMetaByLead = (options.assignmentMetaByLead && typeof options.assignmentMetaByLead === 'object')
            ? options.assignmentMetaByLead
            : {};
        const perLeadIsFirstContact = (options.isFirstContactByLead && typeof options.isFirstContactByLead === 'object')
            ? options.isFirstContactByLead
            : {};
        const defaultIsFirstContact = options.isFirstContact !== false;
        const delayMs = Number(options.delayMs);
        const delayMinInput = Number(options.delayMinMs);
        const delayMaxInput = Number(options.delayMaxMs);
        const hasRange = Number.isFinite(delayMinInput) || Number.isFinite(delayMaxInput);

        let delayMin = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : queueSettings.delay;
        let delayMax = delayMin;

        if (hasRange) {
            if (Number.isFinite(delayMinInput) && delayMinInput > 0) delayMin = delayMinInput;
            if (Number.isFinite(delayMaxInput) && delayMaxInput > 0) {
                delayMax = delayMaxInput;
            } else {
                delayMax = delayMin;
            }

            if (delayMax < delayMin) {
                const swap = delayMin;
                delayMin = delayMax;
                delayMax = swap;
            }
        }

        const pickStepDelay = () => {
            if (delayMax <= delayMin) return delayMin;
            return Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
        };

        const startAtMs = options.startAt ? Date.parse(options.startAt) : null;
        const hasValidStartAt = Number.isFinite(startAtMs);
        let nextScheduledAtMs = hasValidStartAt ? startAtMs : null;
        
        for (let i = 0; i < leadIds.length; i++) {
            const leadId = leadIds[i];
            
            // Calcular tempo de agendamento baseado na posicao na fila
            const scheduledAt = hasValidStartAt
                ? new Date(nextScheduledAtMs).toISOString()
                : null;
            
            const result = await this.add({
                leadId,
                campaignId: options.campaignId || null,
                content,
                mediaType: options.mediaType,
                mediaUrl: options.mediaUrl,
                priority: options.priority || 0,
                scheduledAt,
                sessionId: sessionAssignments[String(leadId)] || options.sessionId || null,
                isFirstContact: Object.prototype.hasOwnProperty.call(perLeadIsFirstContact, String(leadId))
                    ? perLeadIsFirstContact[String(leadId)]
                    : defaultIsFirstContact,
                assignmentMeta: assignmentMetaByLead[String(leadId)] || options.assignmentMeta || null
            });
            
            results.push(result);

            if (hasValidStartAt) {
                nextScheduledAtMs += pickStepDelay();
            }
        }
        
        this.emit('bulk:queued', { count: results.length, leadIds });
        
        return results;
    }

    normalizeOwnerUserId(value) {
        const ownerUserId = Number(value || 0);
        return Number.isInteger(ownerUserId) && ownerUserId > 0 ? ownerUserId : 0;
    }

    buildScopedSettingsKey(baseKey, ownerUserId = null) {
        const normalizedKey = String(baseKey || '').trim();
        if (!normalizedKey) return normalizedKey;

        const normalizedOwnerUserId = this.normalizeOwnerUserId(ownerUserId);
        if (!normalizedOwnerUserId) return normalizedKey;

        return `user:${normalizedOwnerUserId}:${normalizedKey}`;
    }

    buildOwnerCacheKey(ownerUserId = null) {
        const normalizedOwnerUserId = this.normalizeOwnerUserId(ownerUserId);
        return normalizedOwnerUserId ? `owner:${normalizedOwnerUserId}` : 'owner:0';
    }

    parsePositiveNumber(value, fallback, min = 1) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        if (parsed < min) return fallback;
        return parsed;
    }

    async resolveOwnerUserIdFromAssignee(assignedTo) {
        const assigneeId = Number(assignedTo || 0);
        if (!Number.isInteger(assigneeId) || assigneeId <= 0) {
            return null;
        }

        const row = await queryOne(
            'SELECT owner_user_id FROM users WHERE id = ?',
            [assigneeId]
        );
        const ownerUserId = this.normalizeOwnerUserId(row?.owner_user_id);
        if (ownerUserId) return ownerUserId;

        return assigneeId;
    }

    async resolveOwnerUserIdForMessage(message, lead = null) {
        const leadAssigneeId = Number(lead?.assigned_to || 0);
        if (Number.isInteger(leadAssigneeId) && leadAssigneeId > 0) {
            const ownerFromLead = await this.resolveOwnerUserIdFromAssignee(leadAssigneeId);
            if (ownerFromLead) return ownerFromLead;
        }

        const conversationId = Number(message?.conversation_id || 0);
        if (Number.isInteger(conversationId) && conversationId > 0) {
            const conversationRow = await queryOne(
                'SELECT assigned_to FROM conversations WHERE id = ?',
                [conversationId]
            );
            const ownerFromConversation = await this.resolveOwnerUserIdFromAssignee(conversationRow?.assigned_to);
            if (ownerFromConversation) return ownerFromConversation;
        }

        const sessionId = String(message?.session_id || '').trim();
        if (sessionId) {
            const sessionRow = await queryOne(
                'SELECT created_by FROM whatsapp_sessions WHERE session_id = ?',
                [sessionId]
            );
            const ownerFromSession = this.normalizeOwnerUserId(sessionRow?.created_by);
            if (ownerFromSession) return ownerFromSession;
        }

        return null;
    }

    getOwnerRateState(ownerUserId, maxPerMinute) {
        const key = this.buildOwnerCacheKey(ownerUserId);
        const now = Date.now();
        const existing = this.rateStateByOwner.get(key);

        if (!existing || (now - Number(existing.lastReset || 0)) > 60000) {
            const fresh = { count: 0, lastReset: now };
            this.rateStateByOwner.set(key, fresh);
            return fresh;
        }

        if (Number(existing.count || 0) > Number(maxPerMinute || 0) * 3) {
            existing.count = Number(maxPerMinute || 0);
        }

        return existing;
    }

    getTotalMessagesSentThisMinute() {
        const now = Date.now();
        let total = 0;
        for (const state of this.rateStateByOwner.values()) {
            if ((now - Number(state.lastReset || 0)) <= 60000) {
                total += Number(state.count || 0);
            }
        }
        return total;
    }

    canSendForOwner(ownerUserId, maxPerMinute) {
        const safeMaxPerMinute = Math.max(1, Math.floor(Number(maxPerMinute) || this.maxMessagesPerMinute || 1));
        const state = this.getOwnerRateState(ownerUserId, safeMaxPerMinute);
        return Number(state.count || 0) < safeMaxPerMinute;
    }

    registerSentForOwner(ownerUserId, maxPerMinute) {
        const safeMaxPerMinute = Math.max(1, Math.floor(Number(maxPerMinute) || this.maxMessagesPerMinute || 1));
        const state = this.getOwnerRateState(ownerUserId, safeMaxPerMinute);
        state.count = Number(state.count || 0) + 1;
        state.lastReset = Number(state.lastReset || Date.now());
    }

    normalizeTimeInput(value, fallback) {
        const raw = String(value || '').trim();
        if (!raw) return fallback;
        const match = raw.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return fallback;
        const hour = Number(match[1]);
        const minute = Number(match[2]);
        if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallback;
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    toMinutes(time, fallbackMinutes) {
        const match = String(time || '').match(/^(\d{2}):(\d{2})$/);
        if (!match) return fallbackMinutes;
        const hour = Number(match[1]);
        const minute = Number(match[2]);
        if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallbackMinutes;
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallbackMinutes;
        return (hour * 60) + minute;
    }

    coerceBoolean(value, fallback = false) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value > 0;
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
            if (['false', '0', 'no', 'off'].includes(normalized)) return false;
        }
        return fallback;
    }

    normalizeBusinessHoursSettings(raw = {}) {
        const start = this.normalizeTimeInput(raw.start, '08:00');
        const end = this.normalizeTimeInput(raw.end, '18:00');

        return {
            enabled: this.coerceBoolean(raw.enabled, false),
            start,
            end,
            startMinutes: this.toMinutes(start, 8 * 60),
            endMinutes: this.toMinutes(end, 18 * 60)
        };
    }

    async getQueueSettings(ownerUserId = null, forceRefresh = false) {
        const normalizedOwnerUserId = this.normalizeOwnerUserId(ownerUserId);
        const cacheKey = this.buildOwnerCacheKey(normalizedOwnerUserId);
        const now = Date.now();
        const cached = this.queueSettingsCacheByOwner.get(cacheKey);

        if (!forceRefresh && cached && (now - Number(cached.cachedAt || 0)) < this.queueSettingsCacheTtlMs) {
            return cached.value;
        }

        const [scopedDelay, scopedMaxPerMinute, legacyDelay, legacyMaxPerMinute] = await Promise.all([
            Settings.get(this.buildScopedSettingsKey('bulk_message_delay', normalizedOwnerUserId || null)),
            Settings.get(this.buildScopedSettingsKey('max_messages_per_minute', normalizedOwnerUserId || null)),
            normalizedOwnerUserId ? Settings.get('bulk_message_delay') : Promise.resolve(null),
            normalizedOwnerUserId ? Settings.get('max_messages_per_minute') : Promise.resolve(null)
        ]);

        const delay = this.parsePositiveNumber(
            scopedDelay ?? legacyDelay,
            this.defaultDelay,
            1
        );
        const maxPerMinute = Math.max(1, Math.floor(this.parsePositiveNumber(
            scopedMaxPerMinute ?? legacyMaxPerMinute,
            this.maxMessagesPerMinute,
            1
        )));

        const value = { delay, maxPerMinute };
        this.queueSettingsCacheByOwner.set(cacheKey, {
            value,
            cachedAt: now
        });

        return value;
    }

    async getBusinessHoursSettings(ownerUserId = null, forceRefresh = false) {
        const normalizedOwnerUserId = this.normalizeOwnerUserId(ownerUserId);
        const cacheKey = this.buildOwnerCacheKey(normalizedOwnerUserId);
        const now = Date.now();
        const cached = this.businessHoursCacheByOwner.get(cacheKey);
        if (!forceRefresh && cached && (now - Number(cached.cachedAt || 0)) < this.businessHoursCacheTtlMs) {
            return cached.value;
        }

        const [scopedEnabledValue, scopedStartValue, scopedEndValue, legacyEnabledValue, legacyStartValue, legacyEndValue] = await Promise.all([
            Settings.get(this.buildScopedSettingsKey('business_hours_enabled', normalizedOwnerUserId || null)),
            Settings.get(this.buildScopedSettingsKey('business_hours_start', normalizedOwnerUserId || null)),
            Settings.get(this.buildScopedSettingsKey('business_hours_end', normalizedOwnerUserId || null)),
            normalizedOwnerUserId ? Settings.get('business_hours_enabled') : Promise.resolve(null),
            normalizedOwnerUserId ? Settings.get('business_hours_start') : Promise.resolve(null),
            normalizedOwnerUserId ? Settings.get('business_hours_end') : Promise.resolve(null)
        ]);

        const normalized = this.normalizeBusinessHoursSettings({
            enabled: scopedEnabledValue ?? legacyEnabledValue,
            start: scopedStartValue ?? legacyStartValue,
            end: scopedEndValue ?? legacyEndValue
        });

        this.businessHoursCacheByOwner.set(cacheKey, {
            value: normalized,
            cachedAt: now
        });

        return normalized;
    }

    isWithinBusinessHours(settings, date = new Date()) {
        if (!settings?.enabled) return true;

        const nowMinutes = (date.getHours() * 60) + date.getMinutes();
        const start = Number(settings.startMinutes);
        const end = Number(settings.endMinutes);

        if (!Number.isFinite(start) || !Number.isFinite(end)) return true;
        if (start === end) return true;

        if (start < end) {
            return nowMinutes >= start && nowMinutes < end;
        }

        return nowMinutes >= start || nowMinutes < end;
    }

    async canProcessQueueNow(ownerUserId = null) {
        try {
            const settings = await this.getBusinessHoursSettings(ownerUserId || null);
            return this.isWithinBusinessHours(settings);
        } catch (error) {
            console.error('Erro ao validar horario de funcionamento da fila:', error.message);
            return true;
        }
    }

    invalidateBusinessHoursCache(ownerUserId = null) {
        const normalizedOwnerUserId = this.normalizeOwnerUserId(ownerUserId);
        if (normalizedOwnerUserId) {
            this.businessHoursCacheByOwner.delete(this.buildOwnerCacheKey(normalizedOwnerUserId));
            return;
        }
        this.businessHoursCacheByOwner.clear();
    }

    invalidateQueueSettingsCache(ownerUserId = null) {
        const normalizedOwnerUserId = this.normalizeOwnerUserId(ownerUserId);
        if (normalizedOwnerUserId) {
            this.queueSettingsCacheByOwner.delete(this.buildOwnerCacheKey(normalizedOwnerUserId));
            return;
        }
        this.queueSettingsCacheByOwner.clear();
    }
    
    /**
     * Iniciar processamento da fila
     */
    startProcessing() {
        if (this.intervalId) return;
        
        this.intervalId = setInterval(() => {
            this.processNext();
        }, 1000); // Verificar a cada segundo
    }
    
    /**
     * Parar processamento
     */
    stopProcessing() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    
    /**
     * Processar proxima mensagem da fila
     */
    async processNext() {
        if (this.isProcessing) return;
        if (!this.sendFunction) return;

        this.isProcessing = true;

        try {
            const pendingMessages = await MessageQueue.getPending({ limit: 100 });
            if (!pendingMessages || pendingMessages.length === 0) return;

            let selected = null;
            for (const candidate of pendingMessages) {
                const lead = await Lead.findById(candidate.lead_id);
                if (!lead) {
                    await MessageQueue.markProcessing(candidate.id);
                    await MessageQueue.markFailed(candidate.id, 'Lead nao encontrado');
                    continue;
                }

                if (Number(lead.is_blocked || 0) > 0) {
                    await MessageQueue.markProcessing(candidate.id);
                    await MessageQueue.markFailed(candidate.id, 'Lead bloqueado');
                    continue;
                }

                const ownerUserId = await this.resolveOwnerUserIdForMessage(candidate, lead);
                const queueSettings = await this.getQueueSettings(ownerUserId || null);

                if (!this.canSendForOwner(ownerUserId || null, queueSettings.maxPerMinute)) {
                    continue;
                }

                const canProcessNow = await this.canProcessQueueNow(ownerUserId || null);
                if (!canProcessNow) {
                    continue;
                }

                selected = {
                    message: candidate,
                    lead,
                    ownerUserId: ownerUserId || null,
                    queueSettings
                };
                break;
            }

            if (!selected) return;

            const { message, lead, ownerUserId, queueSettings } = selected;
            await MessageQueue.markProcessing(message.id);

            let assignedSessionId = String(message.session_id || '').trim();
            if (!assignedSessionId && this.resolveSessionForMessage) {
                const allocation = await this.resolveSessionForMessage({
                    message,
                    lead
                });
                assignedSessionId = String(allocation?.sessionId || '').trim();
                if (assignedSessionId) {
                    await MessageQueue.setAssignment(
                        message.id,
                        assignedSessionId,
                        allocation?.assignmentMeta || null
                    );
                }
            }

            if (!assignedSessionId) {
                const sendError = new Error('Nenhuma conta de WhatsApp disponivel para envio');
                sendError.messageId = message.id;
                sendError.leadId = message.lead_id;
                sendError.conversationId = message.conversation_id;
                throw sendError;
            }

            try {
                await this.sendFunction({
                    sessionId: assignedSessionId,
                    to: lead.phone,
                    jid: lead.jid,
                    ownerUserId: ownerUserId || undefined,
                    assignedTo: lead.assigned_to || null,
                    content: message.content,
                    mediaType: message.media_type,
                    mediaUrl: message.media_url,
                    campaignId: message.campaign_id || null,
                    conversationId: message.conversation_id || null
                });
            } catch (sendError) {
                sendError.messageId = message.id;
                sendError.leadId = message.lead_id;
                sendError.conversationId = message.conversation_id;
                throw sendError;
            }

            await MessageQueue.markSent(message.id);
            this.registerSentForOwner(ownerUserId || null, queueSettings.maxPerMinute);
            this.messagesSentThisMinute = this.getTotalMessagesSentThisMinute();
            this.defaultDelay = queueSettings.delay;
            this.maxMessagesPerMinute = queueSettings.maxPerMinute;

            this.emit('message:sent', {
                id: message.id,
                leadId: message.lead_id,
                ownerUserId: ownerUserId || null,
                sessionId: assignedSessionId,
                content: message.content
            });

            await this.delay(queueSettings.delay);

        } catch (error) {
            const messageId = Number(error?.messageId || 0);
            const leadId = Number(error?.leadId || 0);
            const conversationId = Number(error?.conversationId || 0);
            console.error('Erro ao processar fila:', error.message);

            if (messageId > 0) {
                await MessageQueue.markFailed(messageId, error.message);
                if (conversationId > 0 && leadId > 0) {
                    try {
                        await run(
                            `UPDATE messages
                             SET status = 'failed'
                             WHERE conversation_id = ? AND lead_id = ? AND status = 'pending'`,
                            [conversationId, leadId]
                        );
                    } catch (dbError) {
                        console.error(`Erro ao atualizar status da mensagem ${messageId}:`, dbError.message);
                    }
                }

                this.emit('message:failed', {
                    id: messageId,
                    leadId: leadId || null,
                    error: error.message
                });
            }
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Cancelar mensagem na fila
     */
    async cancel(messageId, options = {}) {
        const ownerUserId = Number(options.ownerUserId || 0) || null;
        await MessageQueue.cancel(messageId, {
            owner_user_id: ownerUserId || undefined
        });
        this.emit('message:cancelled', { id: messageId });
    }
    
    /**
     * Cancelar todas as mensagens pendentes
     */
    async cancelAll(options = {}) {
        const ownerUserId = Number(options.ownerUserId || 0) || null;
        const pending = await MessageQueue.getPending({
            owner_user_id: ownerUserId || undefined
        });
        for (const message of pending) {
            await MessageQueue.cancel(message.id, {
                owner_user_id: ownerUserId || undefined
            });
        }
        this.emit('queue:cleared', { count: pending.length });
        return pending.length;
    }
    
    /**
     * Obter status da fila
     */
    async getStatus(options = {}) {
        const ownerUserId = Number(options.ownerUserId || 0) || null;
        const pending = await MessageQueue.getPending({
            owner_user_id: ownerUserId || undefined
        });
        const queueSettings = await this.getQueueSettings(ownerUserId || null);
        const rateState = this.getOwnerRateState(ownerUserId || null, queueSettings.maxPerMinute);
        
        return {
            isProcessing: this.isProcessing,
            pendingCount: pending.length,
            messagesSentThisMinute: Number(rateState.count || 0),
            maxMessagesPerMinute: queueSettings.maxPerMinute,
            delay: queueSettings.delay
        };
    }
    
    /**
     * Obter mensagens pendentes
     */
    async getPending(options = {}) {
        const ownerUserId = Number(options.ownerUserId || 0) || null;
        const limit = Number(options.limit || 0) || null;
        return await MessageQueue.getPending({
            owner_user_id: ownerUserId || undefined,
            limit: limit || undefined
        });
    }
    
    /**
     * Utilitario de delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Atualizar configuracoes
     */
    async updateSettings(settings, options = {}) {
        const ownerUserId = this.normalizeOwnerUserId(options.ownerUserId || options.owner_user_id || null) || null;
        const delayKey = this.buildScopedSettingsKey('bulk_message_delay', ownerUserId);
        const maxPerMinuteKey = this.buildScopedSettingsKey('max_messages_per_minute', ownerUserId);

        if (settings.delay) {
            await Settings.set(delayKey, settings.delay, 'number');
        }
        
        if (settings.maxPerMinute) {
            await Settings.set(maxPerMinuteKey, settings.maxPerMinute, 'number');
        }

        this.invalidateQueueSettingsCache(ownerUserId);
        this.invalidateBusinessHoursCache(ownerUserId);
        const refreshed = await this.getQueueSettings(ownerUserId, true);
        if (!ownerUserId) {
            this.defaultDelay = refreshed.delay;
            this.maxMessagesPerMinute = refreshed.maxPerMinute;
        }
    }
}

module.exports = new QueueService();
module.exports.QueueService = QueueService;

