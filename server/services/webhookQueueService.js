/**
 * SELF PROTECAO VEICULAR - Fila de Entrega de Webhooks
 * Worker persistente com retry exponencial e idempotencia por dedupe_key.
 */

const EventEmitter = require('events');
const { Webhook, WebhookDeliveryQueue } = require('../database/models');

function parseBooleanEnv(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'sim', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'nao', 'off'].includes(normalized)) return false;
    return fallback;
}

class WebhookQueueService extends EventEmitter {
    constructor() {
        super();
        this.isProcessing = false;
        this.intervalId = null;
        this.sendFunction = null;
        this.leaderLock = null;

        this.workerEnabled = parseBooleanEnv(process.env.WEBHOOK_QUEUE_WORKER_ENABLED, true);
        this.pollIntervalMs = this.parsePositiveNumber(process.env.WEBHOOK_QUEUE_POLL_MS, 1000, 200);
        this.batchSize = this.parsePositiveNumber(process.env.WEBHOOK_QUEUE_BATCH_SIZE, 20, 1);
        this.retryBaseDelayMs = this.parsePositiveNumber(process.env.WEBHOOK_RETRY_BASE_DELAY_MS, 2000, 250);
        this.retryMaxDelayMs = this.parsePositiveNumber(process.env.WEBHOOK_RETRY_MAX_DELAY_MS, 300000, 1000);
        this.retryJitterMs = this.parsePositiveNumber(process.env.WEBHOOK_RETRY_JITTER_MS, 750, 0);
        this.staleProcessingMs = this.parsePositiveNumber(process.env.WEBHOOK_QUEUE_STALE_PROCESSING_MS, 120000, 5000);
        this.lastStaleRecoveryAt = 0;
    }

    parsePositiveNumber(value, fallback, min = 1) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        if (parsed < min) return fallback;
        return Math.floor(parsed);
    }

    async init(sendFunction, options = {}) {
        if (typeof sendFunction !== 'function') {
            throw new Error('sendFunction invalida para webhookQueueService');
        }

        this.sendFunction = sendFunction;
        this.workerEnabled = options.workerEnabled !== false;
        this.leaderLock = options.leaderLock && typeof options.leaderLock.isHeld === 'function'
            ? options.leaderLock
            : null;

        if (this.leaderLock && typeof this.leaderLock.start === 'function') {
            await this.leaderLock.start();
        }

        if (this.workerEnabled) {
            this.startProcessing();
        } else {
            console.log('[LeaderLock][webhook-queue-worker] worker desabilitado por configuracao');
        }
    }

    startProcessing() {
        if (this.intervalId) return;
        this.intervalId = setInterval(() => {
            this.processNext();
        }, this.pollIntervalMs);
    }

    stopProcessing() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    async shutdown() {
        this.stopProcessing();
        if (this.leaderLock && typeof this.leaderLock.stop === 'function') {
            await this.leaderLock.stop();
        }
    }

    computeRetryDelayMs(attempts) {
        const normalizedAttempt = Math.max(1, Number(attempts || 1));
        const expFactor = Math.pow(2, Math.max(0, normalizedAttempt - 1));
        const exponentialDelay = Math.min(this.retryMaxDelayMs, this.retryBaseDelayMs * expFactor);
        const jitter = this.retryJitterMs > 0
            ? Math.floor(Math.random() * (this.retryJitterMs + 1))
            : 0;

        return Math.min(this.retryMaxDelayMs, exponentialDelay + jitter);
    }

    async recoverStaleProcessingIfNeeded(force = false) {
        const now = Date.now();
        const cooldownMs = Math.max(15000, Math.min(this.staleProcessingMs, 60000));
        if (!force && (now - this.lastStaleRecoveryAt) < cooldownMs) {
            return 0;
        }
        this.lastStaleRecoveryAt = now;

        const recovered = await WebhookDeliveryQueue.requeueStuck(this.staleProcessingMs);
        if (recovered > 0) {
            console.warn(`[WebhookQueue] ${recovered} entrega(s) recuperada(s) de estado processing estagnado`);
        }
        return recovered;
    }

    async processDelivery(delivery) {
        const deliveryId = Number(delivery?.id || 0);
        if (!deliveryId) return;

        await WebhookDeliveryQueue.markProcessing(deliveryId);
        const current = await WebhookDeliveryQueue.findById(deliveryId);
        if (!current) return;

        const webhook = await Webhook.findById(current.webhook_id);
        if (!webhook || Number(webhook.is_active || 0) !== 1) {
            await WebhookDeliveryQueue.markCancelled(deliveryId, 'Webhook inativo ou removido');
            this.emit('delivery:cancelled', {
                id: deliveryId,
                webhookId: Number(current.webhook_id || 0) || null,
                event: String(current.event || '')
            });
            return;
        }

        let payload = {};
        try {
            payload = current.payload ? JSON.parse(current.payload) : {};
        } catch (_) {
            payload = {};
        }

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            payload = {};
        }
        payload.event = String(payload.event || current.event || '').trim() || String(current.event || '');
        payload.timestamp = String(payload.timestamp || new Date().toISOString());
        if (!Object.prototype.hasOwnProperty.call(payload, 'data')) {
            payload.data = {};
        }

        try {
            const result = await this.sendFunction({
                webhook,
                event: String(current.event || ''),
                payload,
                attempt: Number(current.attempts || 0),
                delivery: current
            });

            const status = Number(result?.status || 0);
            const success = result?.success === true || (status >= 200 && status < 300);
            const responseBody = String(result?.responseBody ?? result?.error ?? '').slice(0, 2000) || null;
            const durationMs = Number.isFinite(Number(result?.duration)) && Number(result.duration) >= 0
                ? Math.floor(Number(result.duration))
                : null;

            if (success) {
                await WebhookDeliveryQueue.markSent(deliveryId, {
                    responseStatus: status || null,
                    responseBody,
                    durationMs
                });
                this.emit('delivery:sent', {
                    id: deliveryId,
                    webhookId: Number(current.webhook_id || 0) || null,
                    event: String(current.event || ''),
                    attempt: Number(current.attempts || 0),
                    status: status || null
                });
                return;
            }

            const attempts = Number(current.attempts || 0);
            const maxAttempts = Math.max(1, Number(current.max_attempts || 1));
            const canRetry = attempts < maxAttempts;
            const nextAttemptAt = canRetry
                ? new Date(Date.now() + this.computeRetryDelayMs(attempts)).toISOString()
                : null;
            const errorMessage = String(result?.error || (status ? `HTTP ${status}` : 'Falha de entrega')).slice(0, 1000);

            await WebhookDeliveryQueue.markFailed(deliveryId, errorMessage, {
                nextAttemptAt,
                responseStatus: status || null,
                responseBody,
                durationMs
            });

            this.emit(canRetry ? 'delivery:retry_scheduled' : 'delivery:failed', {
                id: deliveryId,
                webhookId: Number(current.webhook_id || 0) || null,
                event: String(current.event || ''),
                attempt: attempts,
                maxAttempts,
                status: status || null,
                nextAttemptAt
            });
            return;
        } catch (error) {
            const attempts = Number(current.attempts || 0);
            const maxAttempts = Math.max(1, Number(current.max_attempts || 1));
            const canRetry = attempts < maxAttempts;
            const nextAttemptAt = canRetry
                ? new Date(Date.now() + this.computeRetryDelayMs(attempts)).toISOString()
                : null;
            const responseStatus = Number.isFinite(Number(error?.status || error?.responseStatus))
                ? Math.floor(Number(error?.status || error?.responseStatus))
                : null;
            const responseBody = String(error?.responseBody || error?.message || '').slice(0, 2000) || null;
            const durationMs = Number.isFinite(Number(error?.duration))
                ? Math.max(0, Math.floor(Number(error.duration)))
                : null;

            await WebhookDeliveryQueue.markFailed(deliveryId, error?.message || 'Falha de entrega', {
                nextAttemptAt,
                responseStatus,
                responseBody,
                durationMs
            });

            this.emit(canRetry ? 'delivery:retry_scheduled' : 'delivery:failed', {
                id: deliveryId,
                webhookId: Number(current.webhook_id || 0) || null,
                event: String(current.event || ''),
                attempt: attempts,
                maxAttempts,
                status: responseStatus,
                nextAttemptAt,
                error: String(error?.message || 'Falha de entrega')
            });
        }
    }

    async processNext() {
        if (this.isProcessing) return;
        if (!this.sendFunction) return;
        if (!this.workerEnabled) return;
        if (this.leaderLock && !this.leaderLock.isHeld()) return;

        this.isProcessing = true;
        try {
            await this.recoverStaleProcessingIfNeeded();
            const pending = await WebhookDeliveryQueue.getPending({ limit: this.batchSize });
            if (!pending || pending.length === 0) return;

            for (const delivery of pending) {
                await this.processDelivery(delivery);
            }
        } catch (error) {
            console.error('[WebhookQueue] Erro ao processar fila:', error.message);
        } finally {
            this.isProcessing = false;
        }
    }

    async getStatus() {
        const stats = await WebhookDeliveryQueue.getStats();
        return {
            ...stats,
            workerEnabled: this.workerEnabled,
            isProcessing: this.isProcessing,
            pollIntervalMs: this.pollIntervalMs,
            batchSize: this.batchSize
        };
    }
}

module.exports = new WebhookQueueService();
module.exports.WebhookQueueService = WebhookQueueService;
