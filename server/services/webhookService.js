/**
 * SELF PROTEÇÃO VEICULAR - Serviço de Webhooks
 * Dispara webhooks para integrações externas
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { Webhook, WebhookDeliveryQueue } = require('../database/models');

function parseBooleanEnv(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'sim', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'nao', 'off'].includes(normalized)) return false;
    return fallback;
}

class WebhookService {
    constructor() {
        this.useDeliveryQueue = parseBooleanEnv(process.env.WEBHOOK_DELIVERY_USE_QUEUE, true);
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

    buildPayload(event, data) {
        return {
            event,
            timestamp: new Date().toISOString(),
            data
        };
    }

    normalizeDedupePart(value) {
        const normalized = String(value || '').trim();
        if (!normalized) return '';
        return normalized.replace(/\s+/g, '_').slice(0, 180);
    }

    resolveIdempotencyKey(event, data, payload, options = {}) {
        const explicitKey = this.normalizeDedupePart(
            options?.dedupe_key ?? options?.dedupeKey ?? options?.idempotency_key ?? options?.idempotencyKey
        );
        if (explicitKey) return `${String(event || '').trim()}:${explicitKey}`.slice(0, 255);

        const messageIdCandidates = [
            data?.message?.messageId,
            data?.message?.id,
            data?.messageId,
            data?.id,
            data?.key?.id
        ];

        for (const candidate of messageIdCandidates) {
            const normalized = this.normalizeDedupePart(candidate);
            if (normalized) {
                return `${String(event || '').trim()}:message:${normalized}`.slice(0, 255);
            }
        }

        const fallbackHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(payload?.data || data || {}))
            .digest('hex');

        return `${String(event || '').trim()}:hash:${fallbackHash}`.slice(0, 255);
    }

    async queueDelivery(webhook, event, payload, options = {}) {
        const dedupeKey = this.resolveIdempotencyKey(event, payload?.data || {}, payload, options);
        return await WebhookDeliveryQueue.add({
            webhook_id: webhook.id,
            event,
            payload,
            dedupe_key: dedupeKey,
            max_attempts: Number(webhook.retry_count || 0) > 0 ? Number(webhook.retry_count) : 3
        });
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
        const payload = this.buildPayload(event, data);

        for (const webhook of webhooks) {
            try {
                if (this.useDeliveryQueue) {
                    try {
                        const queued = await this.queueDelivery(webhook, event, payload, options);
                        results.push({
                            webhookId: webhook.id,
                            queued: queued?.created === true,
                            deduplicated: queued?.duplicated === true,
                            queueId: Number(queued?.id || 0) || null
                        });
                        continue;
                    } catch (queueError) {
                        console.error(
                            `[WebhookService] Falha ao enfileirar webhook ${webhook.id}, fallback para envio direto:`,
                            queueError.message
                        );
                    }
                }

                const result = await this.send(webhook, event, data, { payload });
                results.push({
                    webhookId: webhook.id,
                    success: result.success,
                    status: result.status,
                    fallbackDirect: this.useDeliveryQueue === true
                });
            } catch (error) {
                results.push({
                    webhookId: webhook.id,
                    success: false,
                    error: error.message
                });
            }
        }

        const queuedCount = results.filter((item) => item.queued === true).length;
        const deduplicatedCount = results.filter((item) => item.deduplicated === true).length;

        return {
            triggered: results.length,
            queued: queuedCount,
            deduplicated: deduplicatedCount,
            results
        };
    }
    
    /**
     * Enviar webhook HTTP
     */
    async send(webhook, event, data, options = {}) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const providedPayload = options?.payload;
            const payload = providedPayload && typeof providedPayload === 'object' && !Array.isArray(providedPayload)
                ? {
                    ...providedPayload,
                    event: String(providedPayload.event || event || '').trim() || String(event || '').trim(),
                    timestamp: String(providedPayload.timestamp || new Date().toISOString())
                }
                : this.buildPayload(event, data);
            
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
            
            const requestOptions = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: 'POST',
                headers,
                timeout: 30000
            };
            
            const client = isHttps ? https : http;
            
            const req = client.request(requestOptions, (res) => {
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
                            responseBody: responseBody.substring(0, 1000),
                            duration
                        });
                    } else {
                        resolve({
                            success: false,
                            status: res.statusCode,
                            error: responseBody,
                            responseBody: responseBody.substring(0, 1000),
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

                error.status = 0;
                error.responseStatus = 0;
                error.responseBody = error.message;
                error.duration = duration;
                reject(error);
            });
            
            req.on('timeout', () => {
                const timeoutError = new Error('Timeout');
                timeoutError.code = 'ETIMEDOUT';
                req.destroy(timeoutError);
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
