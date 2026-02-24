/**
 * SELF PROTEÇÃO VEICULAR - Serviço de Webhooks
 * Dispara webhooks para integrações externas
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { Webhook } = require('../database/models');

class WebhookService {
    constructor() {
        this.eventQueue = [];
        this.processing = false;
    }
    
    /**
     * Gerar assinatura HMAC para payload
     */
    generateSignature(payload, secret) {
        if (!secret) return null;
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(JSON.stringify(payload));
        return hmac.digest('hex');
    }
    
    /**
     * Disparar webhook para um evento
     */
    async trigger(event, data, options = {}) {
        let webhooks = [];
        try {
            webhooks = await Webhook.findByEvent(event, {
                owner_user_id: Number(options.ownerUserId || 0) || undefined,
                created_by: Number(options.createdBy || 0) || undefined
            });
        } catch (error) {
            console.error(`[WebhookService] Falha ao buscar webhooks do evento "${event}":`, error.message);
            return { triggered: 0, results: [] };
        }

        if (!Array.isArray(webhooks) || webhooks.length === 0) {
            return { triggered: 0, results: [] };
        }

        const results = [];

        for (const webhook of webhooks) {
            try {
                const result = await this.send(webhook, event, data);
                results.push({
                    webhookId: webhook.id,
                    success: result.success,
                    status: result.status
                });
            } catch (error) {
                results.push({
                    webhookId: webhook.id,
                    success: false,
                    error: error.message
                });
            }
        }

        return { triggered: results.length, results };
    }
    
    /**
     * Enviar webhook HTTP
     */
    async send(webhook, event, data) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const payload = {
                event,
                timestamp: new Date().toISOString(),
                data
            };
            
            const payloadString = JSON.stringify(payload);
            const signature = this.generateSignature(payload, webhook.secret);
            let customHeaders = {};
            try {
                customHeaders = JSON.parse(webhook.headers || '{}');
            } catch (error) {
                console.warn(`[WebhookService] Headers invalidos no webhook ${webhook.id}:`, error.message);
            }
            
            const url = new URL(webhook.url);
            const isHttps = url.protocol === 'https:';
            
            const headers = {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payloadString),
                'X-Webhook-Event': event,
                'X-Webhook-Signature': signature || '',
                'X-Webhook-Timestamp': new Date().toISOString(),
                'User-Agent': 'SELF-Webhook/1.0',
                ...customHeaders
            };
            
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: 'POST',
                headers,
                timeout: 30000
            };
            
            const client = isHttps ? https : http;
            
            const req = client.request(options, (res) => {
                let responseBody = '';
                
                res.on('data', (chunk) => {
                    responseBody += chunk;
                });
                
                res.on('end', () => {
                    const duration = Date.now() - startTime;
                    
                    // Logar resultado
                    Webhook.logTrigger(
                        webhook.id,
                        event,
                        payload,
                        res.statusCode,
                        responseBody.substring(0, 1000),
                        duration
                    ).catch((error) => {
                        console.warn('[WebhookService] Falha ao registrar log de webhook:', error.message);
                    });
                    
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({
                            success: true,
                            status: res.statusCode,
                            duration
                        });
                    } else {
                        resolve({
                            success: false,
                            status: res.statusCode,
                            error: responseBody,
                            duration
                        });
                    }
                });
            });
            
            req.on('error', (error) => {
                const duration = Date.now() - startTime;
                
                Webhook.logTrigger(
                    webhook.id,
                    event,
                    payload,
                    0,
                    error.message,
                    duration
                ).catch((logError) => {
                    console.warn('[WebhookService] Falha ao registrar log de erro de webhook:', logError.message);
                });
                
                reject(error);
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
            
            req.write(payloadString);
            req.end();
        });
    }
    
    /**
     * Eventos disponíveis
     */
    static EVENTS = {
        // Mensagens
        MESSAGE_RECEIVED: 'message.received',
        MESSAGE_SENT: 'message.sent',
        MESSAGE_DELIVERED: 'message.delivered',
        MESSAGE_READ: 'message.read',
        MESSAGE_FAILED: 'message.failed',
        
        // Leads
        LEAD_CREATED: 'lead.created',
        LEAD_UPDATED: 'lead.updated',
        LEAD_STATUS_CHANGED: 'lead.status_changed',
        
        // Conversas
        CONVERSATION_STARTED: 'conversation.started',
        CONVERSATION_ASSIGNED: 'conversation.assigned',
        CONVERSATION_CLOSED: 'conversation.closed',
        
        // WhatsApp
        WHATSAPP_CONNECTED: 'whatsapp.connected',
        WHATSAPP_DISCONNECTED: 'whatsapp.disconnected',
        WHATSAPP_QR_GENERATED: 'whatsapp.qr_generated',
        
        // Fluxos
        FLOW_STARTED: 'flow.started',
        FLOW_COMPLETED: 'flow.completed',
        FLOW_FAILED: 'flow.failed'
    };
}

module.exports = new WebhookService();
module.exports.WebhookService = WebhookService;
