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
    init(sendFunction) {
        this.sendFunction = sendFunction;
        
        // Carregar configurações do banco
        const delay = Settings.get('bulk_message_delay');
        const maxPerMinute = Settings.get('max_messages_per_minute');
        
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
    add(options) {
        const { leadId, conversationId, content, mediaType, mediaUrl, priority, scheduledAt } = options;
        
        const result = MessageQueue.add({
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
    addBulk(leadIds, content, options = {}) {
        const results = [];
        
        for (let i = 0; i < leadIds.length; i++) {
            const leadId = leadIds[i];
            
            // Calcular tempo de agendamento baseado na posição na fila
            const scheduledAt = options.startAt 
                ? new Date(new Date(options.startAt).getTime() + (i * this.defaultDelay)).toISOString()
                : null;
            
            const result = this.add({
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
        const message = MessageQueue.getNext();
        if (!message) return;
        
        this.isProcessing = true;
        
        try {
            // Marcar como processando
            MessageQueue.markProcessing(message.id);
            
            // Buscar lead
            const lead = Lead.findById(message.lead_id);
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
            MessageQueue.markSent(message.id);
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
            
            MessageQueue.markFailed(message.id, error.message);
            try {
                run(
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
    cancel(messageId) {
        MessageQueue.cancel(messageId);
        this.emit('message:cancelled', { id: messageId });
    }
    
    /**
     * Cancelar todas as mensagens pendentes
     */
    cancelAll() {
        const pending = MessageQueue.getPending();
        for (const message of pending) {
            MessageQueue.cancel(message.id);
        }
        this.emit('queue:cleared', { count: pending.length });
        return pending.length;
    }
    
    /**
     * Obter status da fila
     */
    getStatus() {
        const pending = MessageQueue.getPending();
        
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
    getPending() {
        return MessageQueue.getPending();
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
    updateSettings(settings) {
        if (settings.delay) {
            this.defaultDelay = settings.delay;
            Settings.set('bulk_message_delay', settings.delay, 'number');
        }
        
        if (settings.maxPerMinute) {
            this.maxMessagesPerMinute = settings.maxPerMinute;
            Settings.set('max_messages_per_minute', settings.maxPerMinute, 'number');
        }
    }
}

module.exports = new QueueService();
module.exports.QueueService = QueueService;
