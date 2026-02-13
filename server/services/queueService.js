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
        this.defaultDelay = 3000; // 3 segundos entre mensagens
        this.maxMessagesPerMinute = 30;
        this.messagesSentThisMinute = 0;
        this.lastMinuteReset = Date.now();
    }
    
    /**
     * Inicializar o serviço de fila
     */
    async init(sendFunction) {
        this.sendFunction = sendFunction;
        
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
        const { leadId, conversationId, content, mediaType, mediaUrl, priority, scheduledAt } = options;
        
        const result = await MessageQueue.add({
            lead_id: leadId,
            conversation_id: conversationId,
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
        const delayMs = Number(options.delayMs);
        const stepDelay = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : this.defaultDelay;
        const startAtMs = options.startAt ? Date.parse(options.startAt) : null;
        const hasValidStartAt = Number.isFinite(startAtMs);
        
        for (let i = 0; i < leadIds.length; i++) {
            const leadId = leadIds[i];
            
            // Calcular tempo de agendamento baseado na posição na fila
            const scheduledAt = hasValidStartAt
                ? new Date(startAtMs + (i * stepDelay)).toISOString()
                : null;
            
            const result = await this.add({
                leadId,
                content,
                mediaType: options.mediaType,
                mediaUrl: options.mediaUrl,
                priority: options.priority || 0,
                scheduledAt
            });
            
            results.push(result);
        }
        
        this.emit('bulk:queued', { count: results.length, leadIds });
        
        return results;
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
            
            // Enviar mensagem
            await this.sendFunction({
                to: lead.phone,
                jid: lead.jid,
                content: message.content,
                mediaType: message.media_type,
                mediaUrl: message.media_url
            });
            
            // Marcar como enviada
            await MessageQueue.markSent(message.id);
            this.messagesSentThisMinute++;
            
            this.emit('message:sent', { 
                id: message.id, 
                leadId: message.lead_id,
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
    }
}

module.exports = new QueueService();
module.exports.QueueService = QueueService;
