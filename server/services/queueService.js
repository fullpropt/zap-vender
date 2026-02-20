/**
 * SELF PROTEÇÃO VEICULAR - Serviço de Fila de Mensagens
 * Gerencia envio de mensagens em massa com delay para evitar bloqueios
 */

const { MessageQueue, Settings, Lead } = require('../database/models');
const { run } = require('../database/connection');
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
        this.lastMinuteReset = Date.now();
        this.businessHoursCache = null;
        this.businessHoursCacheAt = 0;
        this.businessHoursCacheTtlMs = 30000;
    }
    
    /**
     * Inicializar o serviço de fila
     */
    async init(sendFunction, options = {}) {
        this.sendFunction = sendFunction;
        this.resolveSessionForMessage = typeof options.resolveSessionForMessage === 'function'
            ? options.resolveSessionForMessage
            : null;
        
        // Carregar configurações do banco
        const delay = await Settings.get('bulk_message_delay');
        const maxPerMinute = await Settings.get('max_messages_per_minute');
        
        if (delay) this.defaultDelay = delay;
        if (maxPerMinute) this.maxMessagesPerMinute = maxPerMinute;
        
        // Iniciar processamento
        this.startProcessing();
        
        console.log('📬 Serviço de fila de mensagens iniciado');
        console.log(`   - Delay entre mensagens: ${this.defaultDelay}ms`);
        console.log(`   - Máximo por minuto: ${this.maxMessagesPerMinute}`);
    }
    
    /**
     * Adicionar mensagem à fila
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
     * Adicionar múltiplas mensagens (disparo em massa)
     */
    async addBulk(leadIds, content, options = {}) {
        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            return [];
        }

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

        let delayMin = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : this.defaultDelay;
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

    async getBusinessHoursSettings(forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && this.businessHoursCache && (now - this.businessHoursCacheAt) < this.businessHoursCacheTtlMs) {
            return this.businessHoursCache;
        }

        const [enabledValue, startValue, endValue] = await Promise.all([
            Settings.get('business_hours_enabled'),
            Settings.get('business_hours_start'),
            Settings.get('business_hours_end')
        ]);

        const normalized = this.normalizeBusinessHoursSettings({
            enabled: enabledValue,
            start: startValue,
            end: endValue
        });

        this.businessHoursCache = normalized;
        this.businessHoursCacheAt = now;

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

    async canProcessQueueNow() {
        try {
            const settings = await this.getBusinessHoursSettings();
            return this.isWithinBusinessHours(settings);
        } catch (error) {
            console.error('❌ Erro ao validar horário de funcionamento da fila:', error.message);
            return true;
        }
    }

    invalidateBusinessHoursCache() {
        this.businessHoursCache = null;
        this.businessHoursCacheAt = 0;
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
     * Processar próxima mensagem da fila
     */
    async processNext() {
        if (this.isProcessing) return;
        if (!this.sendFunction) return;
        
        // Reset contador de mensagens por minuto
        if (Date.now() - this.lastMinuteReset > 60000) {
            this.messagesSentThisMinute = 0;
            this.lastMinuteReset = Date.now();
        }
        
        // Verificar limite por minuto
        if (this.messagesSentThisMinute >= this.maxMessagesPerMinute) {
            return;
        }

        const canProcessNow = await this.canProcessQueueNow();
        if (!canProcessNow) {
            return;
        }
        
        // Buscar próxima mensagem
        const message = await MessageQueue.getNext();
        if (!message) return;
        
        this.isProcessing = true;
        
        try {
            // Marcar como processando
            await MessageQueue.markProcessing(message.id);
            
            // Buscar lead
            const lead = await Lead.findById(message.lead_id);
            if (!lead) {
                throw new Error('Lead não encontrado');
            }
            
            if (lead.is_blocked) {
                throw new Error('Lead bloqueado');
            }
            
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
                throw new Error('Nenhuma conta de WhatsApp disponivel para envio');
            }

            // Enviar mensagem
            await this.sendFunction({
                sessionId: assignedSessionId,
                to: lead.phone,
                jid: lead.jid,
                content: message.content,
                mediaType: message.media_type,
                mediaUrl: message.media_url,
                campaignId: message.campaign_id || null,
                conversationId: message.conversation_id || null
            });
            
            // Marcar como enviada
            await MessageQueue.markSent(message.id);
            this.messagesSentThisMinute++;
            
            this.emit('message:sent', { 
                id: message.id, 
                leadId: message.lead_id,
                sessionId: assignedSessionId,
                content: message.content 
            });
            
            // Aguardar delay antes de processar próxima
            await this.delay(this.defaultDelay);
            
        } catch (error) {
            console.error(`❌ Erro ao processar mensagem ${message.id}:`, error.message);
            
            await MessageQueue.markFailed(message.id, error.message);
            try {
                await run(
                    `UPDATE messages
                     SET status = 'failed'
                     WHERE conversation_id = ? AND lead_id = ? AND status = 'pending'`,
                    [message.conversation_id, message.lead_id]
                );
            } catch (dbError) {
                console.error(`❌ Erro ao atualizar status da mensagem ${message.id}:`, dbError.message);
            }
            
            this.emit('message:failed', { 
                id: message.id, 
                leadId: message.lead_id,
                error: error.message 
            });
        } finally {
            this.isProcessing = false;
        }
    }
    
    /**
     * Cancelar mensagem na fila
     */
    async cancel(messageId) {
        await MessageQueue.cancel(messageId);
        this.emit('message:cancelled', { id: messageId });
    }
    
    /**
     * Cancelar todas as mensagens pendentes
     */
    async cancelAll() {
        const pending = await MessageQueue.getPending();
        for (const message of pending) {
            await MessageQueue.cancel(message.id);
        }
        this.emit('queue:cleared', { count: pending.length });
        return pending.length;
    }
    
    /**
     * Obter status da fila
     */
    async getStatus() {
        const pending = await MessageQueue.getPending();
        
        return {
            isProcessing: this.isProcessing,
            pendingCount: pending.length,
            messagesSentThisMinute: this.messagesSentThisMinute,
            maxMessagesPerMinute: this.maxMessagesPerMinute,
            delay: this.defaultDelay
        };
    }
    
    /**
     * Obter mensagens pendentes
     */
    async getPending() {
        return await MessageQueue.getPending();
    }
    
    /**
     * Utilitário de delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Atualizar configurações
     */
    async updateSettings(settings) {
        if (settings.delay) {
            this.defaultDelay = settings.delay;
            await Settings.set('bulk_message_delay', settings.delay, 'number');
        }
        
        if (settings.maxPerMinute) {
            this.maxMessagesPerMinute = settings.maxPerMinute;
            await Settings.set('max_messages_per_minute', settings.maxPerMinute, 'number');
        }

        this.invalidateBusinessHoursCache();
    }
}

module.exports = new QueueService();
module.exports.QueueService = QueueService;
