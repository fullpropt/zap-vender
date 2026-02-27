const crypto = require('crypto');

const EMAIL_CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_EXPIRES_IN_TEXT = '24 horas';
const DEFAULT_APP_NAME = 'ZapVender';
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_EMAIL_SUBJECT_TEMPLATE = 'Confirme seu cadastro no {{app_name}}';
const DEFAULT_EMAIL_TEXT_TEMPLATE = [
    'Ola {{name}},',
    '',
    'Para concluir seu cadastro no {{app_name}}, confirme seu email no link abaixo:',
    '{{confirmation_url}}',
    '',
    'Este link expira em {{expires_in_text}}.'
].join('\n');
const DEFAULT_EMAIL_HTML_TEMPLATE = [
    '<p>Ola {{name}},</p>',
    '<p>Para concluir seu cadastro no <strong>{{app_name}}</strong>, confirme seu email no link abaixo:</p>',
    '<p><a href="{{confirmation_url}}" target="_blank" rel="noopener noreferrer">Confirmar email</a></p>',
    '<p>Este link expira em {{expires_in_text}}.</p>'
].join('');
const SUPPORTED_EMAIL_PROVIDERS = new Set(['mailgun', 'sendgrid', 'mailmkt']);

class MailMktIntegrationError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = 'MailMktIntegrationError';
        this.statusCode = Number(options.statusCode) || 502;
        this.upstreamStatus = Number(options.upstreamStatus) || null;
        this.retryable = options.retryable !== false;
    }
}

function clampNumber(value, fallback, min = 1000, max = 60000) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function trimTrailingSlash(value) {
    return String(value || '').replace(/\/+$/, '');
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeProvider(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return SUPPORTED_EMAIL_PROVIDERS.has(normalized) ? normalized : '';
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function applyTemplate(template, context = {}) {
    const source = String(template || '');
    if (!source) return '';

    return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
        if (!Object.prototype.hasOwnProperty.call(context, key)) return '';
        const value = context[key];
        return value === null || value === undefined ? '' : String(value);
    });
}

function resolveAppUrl(req) {
    const configuredAppUrl = trimTrailingSlash(process.env.APP_URL || process.env.FRONTEND_URL || '');
    if (configuredAppUrl) return configuredAppUrl;

    const host = String(req?.get?.('host') || '').trim();
    if (!host) return '';

    const protocol = String(req?.protocol || 'https').trim() || 'https';
    return trimTrailingSlash(`${protocol}://${host}`);
}

function resolveMailMktEndpointUrl(baseUrl = '') {
    const normalizedBaseUrl = trimTrailingSlash(baseUrl || process.env.MAILMKT_URL || '');
    if (!normalizedBaseUrl) return '';
    return `${normalizedBaseUrl}/api/integrations/zapvender/send-email-confirmation`;
}

function resolveMailgunEndpointUrl(baseUrl = '', domain = '') {
    const normalizedBaseUrl = trimTrailingSlash(baseUrl || process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net');
    const normalizedDomain = String(domain || process.env.MAILGUN_DOMAIN || '').trim();
    if (!normalizedBaseUrl || !normalizedDomain) return '';
    return `${normalizedBaseUrl}/v3/${encodeURIComponent(normalizedDomain)}/messages`;
}

function hashEmailConfirmationToken(token) {
    return crypto
        .createHash('sha256')
        .update(String(token || ''), 'utf8')
        .digest('hex');
}

function buildEmailConfirmationToken() {
    return crypto.randomBytes(32).toString('hex');
}

function createEmailConfirmationTokenPayload(now = Date.now()) {
    const token = buildEmailConfirmationToken();
    const tokenHash = hashEmailConfirmationToken(token);
    const expiresAt = new Date(now + EMAIL_CONFIRMATION_TTL_MS).toISOString();
    return {
        token,
        tokenHash,
        expiresAt,
        expiresInText: process.env.EMAIL_CONFIRMATION_EXPIRES_TEXT || DEFAULT_EXPIRES_IN_TEXT
    };
}

function buildEmailConfirmationUrl(appUrl, token) {
    const normalizedAppUrl = trimTrailingSlash(appUrl);
    if (!normalizedAppUrl) {
        throw new MailMktIntegrationError(
            'APP_URL nao configurada para montar link de confirmacao de email',
            { statusCode: 500, retryable: false }
        );
    }
    return `${normalizedAppUrl}/confirm-email?token=${encodeURIComponent(String(token || ''))}`;
}

function tokenFingerprint(token) {
    const hash = hashEmailConfirmationToken(token);
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function normalizePersonName(name, email) {
    const cleanedName = String(name || '').trim();
    if (cleanedName) return cleanedName;
    return String(email || '').split('@')[0] || 'Cliente';
}

function buildRuntimeEmailDeliveryConfig(overrides = {}) {
    const options = overrides && typeof overrides === 'object' ? overrides : {};
    const requestTimeoutMs = clampNumber(
        options.requestTimeoutMs
            || process.env.EMAIL_REQUEST_TIMEOUT_MS
            || process.env.MAILGUN_REQUEST_TIMEOUT_MS
            || process.env.MAILMKT_REQUEST_TIMEOUT_MS,
        DEFAULT_REQUEST_TIMEOUT_MS
    );

    const sendgridApiKey = String(options.sendgridApiKey || process.env.SENDGRID_API_KEY || '').trim();
    const sendgridFromEmail = normalizeEmail(options.sendgridFromEmail || process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM || '');
    const sendgridFromName = String(options.sendgridFromName || process.env.SENDGRID_FROM_NAME || process.env.APP_NAME || DEFAULT_APP_NAME).trim();
    const sendgridReplyToEmail = normalizeEmail(options.sendgridReplyToEmail || process.env.SENDGRID_REPLY_TO_EMAIL || '');
    const sendgridReplyToName = String(options.sendgridReplyToName || process.env.SENDGRID_REPLY_TO_NAME || '').trim();
    const mailgunApiKey = String(options.mailgunApiKey || process.env.MAILGUN_API_KEY || '').trim();
    const mailgunDomain = String(options.mailgunDomain || process.env.MAILGUN_DOMAIN || '').trim();
    const mailgunBaseUrl = trimTrailingSlash(options.mailgunBaseUrl || process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net');
    const mailgunFromEmail = normalizeEmail(options.mailgunFromEmail || process.env.MAILGUN_FROM_EMAIL || process.env.EMAIL_FROM || '');
    const mailgunFromName = String(options.mailgunFromName || process.env.MAILGUN_FROM_NAME || process.env.APP_NAME || DEFAULT_APP_NAME).trim();
    const mailgunReplyToEmail = normalizeEmail(options.mailgunReplyToEmail || process.env.MAILGUN_REPLY_TO_EMAIL || '');
    const mailgunReplyToName = String(options.mailgunReplyToName || process.env.MAILGUN_REPLY_TO_NAME || '').trim();
    const mailmktUrl = String(options.mailmktUrl || process.env.MAILMKT_URL || '').trim();
    const mailmktApiKey = String(options.mailmktApiKey || process.env.MAILMKT_INTEGRATION_API_KEY || '').trim();
    const appName = String(options.appName || process.env.APP_NAME || DEFAULT_APP_NAME).trim() || DEFAULT_APP_NAME;
    const subjectTemplate = String(
        options.subjectTemplate
        || process.env.EMAIL_CONFIRMATION_SUBJECT_TEMPLATE
        || DEFAULT_EMAIL_SUBJECT_TEMPLATE
    );
    const htmlTemplate = String(
        options.htmlTemplate
        || process.env.EMAIL_CONFIRMATION_HTML_TEMPLATE
        || DEFAULT_EMAIL_HTML_TEMPLATE
    );
    const textTemplate = String(
        options.textTemplate
        || process.env.EMAIL_CONFIRMATION_TEXT_TEMPLATE
        || DEFAULT_EMAIL_TEXT_TEMPLATE
    );

    let provider = normalizeProvider(options.provider || process.env.EMAIL_DELIVERY_PROVIDER || process.env.EMAIL_PROVIDER);
    if (!provider) {
        if (mailgunApiKey && mailgunDomain && mailgunFromEmail) {
            provider = 'mailgun';
        } else if (sendgridApiKey && sendgridFromEmail) {
            provider = 'sendgrid';
        } else if (mailmktUrl && mailmktApiKey) {
            provider = 'mailmkt';
        } else {
            provider = 'mailgun';
        }
    }

    return {
        provider,
        appName,
        subjectTemplate,
        htmlTemplate,
        textTemplate,
        requestTimeoutMs,
        mailgunApiKey,
        mailgunDomain,
        mailgunBaseUrl,
        mailgunFromEmail,
        mailgunFromName,
        mailgunReplyToEmail,
        mailgunReplyToName,
        sendgridApiKey,
        sendgridFromEmail,
        sendgridFromName,
        sendgridReplyToEmail,
        sendgridReplyToName,
        mailmktUrl,
        mailmktApiKey
    };
}

function buildEmailTemplateContext(user, confirmationUrl, options = {}) {
    const appName = String(options.appName || DEFAULT_APP_NAME).trim() || DEFAULT_APP_NAME;
    const name = normalizePersonName(user?.name, user?.email);
    const email = normalizeEmail(user?.email);
    const expiresInText = String(options.expiresInText || DEFAULT_EXPIRES_IN_TEXT).trim() || DEFAULT_EXPIRES_IN_TEXT;
    return {
        name,
        email,
        app_name: appName,
        confirmation_url: String(confirmationUrl || ''),
        expires_in_text: expiresInText
    };
}

function buildRenderedEmailContent(context, config) {
    const subject = applyTemplate(config.subjectTemplate, context).trim() || DEFAULT_EMAIL_SUBJECT_TEMPLATE;
    const renderedHtml = applyTemplate(config.htmlTemplate, context).trim();
    const renderedText = applyTemplate(config.textTemplate, context).trim();
    const text = renderedText || [
        `Ola ${context.name || 'Cliente'},`,
        '',
        `Para concluir seu cadastro no ${context.app_name || DEFAULT_APP_NAME}, confirme seu email no link abaixo:`,
        context.confirmation_url || '',
        '',
        `Este link expira em ${context.expires_in_text || DEFAULT_EXPIRES_IN_TEXT}.`
    ].join('\n');
    const html = renderedHtml || (
        '<p>'
        + `Ola ${escapeHtml(context.name || 'Cliente')},`
        + '</p><p>Para concluir seu cadastro no <strong>'
        + `${escapeHtml(context.app_name || DEFAULT_APP_NAME)}`
        + '</strong>, confirme seu email no link abaixo:</p>'
        + '<p><a href="'
        + `${escapeHtml(context.confirmation_url || '')}`
        + '" target="_blank" rel="noopener noreferrer">Confirmar email</a></p>'
        + '<p>Este link expira em '
        + `${escapeHtml(context.expires_in_text || DEFAULT_EXPIRES_IN_TEXT)}`
        + '.</p>'
    );

    return { subject, html, text };
}

async function sendEmailConfirmationViaMailMkt(payload, config) {
    const endpointUrl = resolveMailMktEndpointUrl(config.mailmktUrl);
    const apiKey = String(config.mailmktApiKey || '').trim();
    const timeoutMs = clampNumber(config.requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS);

    if (!endpointUrl) {
        throw new MailMktIntegrationError('MAILMKT_URL nao configurada', {
            statusCode: 500,
            retryable: false
        });
    }

    if (!apiKey) {
        throw new MailMktIntegrationError('MAILMKT_INTEGRATION_API_KEY nao configurada', {
            statusCode: 500,
            retryable: false
        });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(endpointUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        if (!response.ok) {
            const responseText = await response.text().catch(() => '');
            const upstreamPreview = String(responseText || '').slice(0, 300);
            const integrationError = new MailMktIntegrationError(
                `MailMKT respondeu HTTP ${response.status}`,
                {
                    statusCode: response.status >= 500 ? 503 : 502,
                    upstreamStatus: response.status,
                    retryable: response.status >= 500 || response.status === 429
                }
            );
            integrationError.upstreamBodyPreview = upstreamPreview || null;
            throw integrationError;
        }

        return true;
    } catch (error) {
        if (error instanceof MailMktIntegrationError) {
            throw error;
        }

        if (error?.name === 'AbortError') {
            throw new MailMktIntegrationError('Timeout ao enviar confirmacao de email via MailMKT', {
                statusCode: 503,
                retryable: true
            });
        }

        throw new MailMktIntegrationError(`Falha de rede ao enviar confirmacao via MailMKT: ${error.message}`, {
            statusCode: 503,
            retryable: true
        });
    } finally {
        clearTimeout(timeout);
    }
}

async function sendEmailConfirmationViaSendGrid(payload, config) {
    const endpointUrl = 'https://api.sendgrid.com/v3/mail/send';
    const apiKey = String(config.sendgridApiKey || '').trim();
    const fromEmail = normalizeEmail(config.sendgridFromEmail);
    const fromName = String(config.sendgridFromName || '').trim();
    const replyToEmail = normalizeEmail(config.sendgridReplyToEmail);
    const replyToName = String(config.sendgridReplyToName || '').trim();
    const timeoutMs = clampNumber(config.requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS);

    if (!apiKey) {
        throw new MailMktIntegrationError('SENDGRID_API_KEY nao configurada', {
            statusCode: 500,
            retryable: false
        });
    }

    if (!fromEmail) {
        throw new MailMktIntegrationError('SENDGRID_FROM_EMAIL nao configurada', {
            statusCode: 500,
            retryable: false
        });
    }

    const recipientEmail = normalizeEmail(payload.email);
    if (!recipientEmail) {
        throw new MailMktIntegrationError('Email do destinatario nao informado', {
            statusCode: 400,
            retryable: false
        });
    }

    const recipientName = String(payload.name || '').trim() || normalizePersonName('', recipientEmail);
    const subject = String(payload.subject || '').trim() || DEFAULT_EMAIL_SUBJECT_TEMPLATE;
    const text = String(payload.text || '').trim();
    const html = String(payload.html || '').trim();

    const content = [];
    if (text) {
        content.push({ type: 'text/plain', value: text });
    }
    if (html) {
        content.push({ type: 'text/html', value: html });
    }
    if (!content.length) {
        content.push({ type: 'text/plain', value: DEFAULT_EMAIL_TEXT_TEMPLATE });
    }

    const body = {
        personalizations: [
            {
                to: [
                    {
                        email: recipientEmail,
                        name: recipientName
                    }
                ],
                subject
            }
        ],
        from: {
            email: fromEmail,
            name: fromName || undefined
        },
        content
    };

    if (replyToEmail) {
        body.reply_to = {
            email: replyToEmail,
            name: replyToName || undefined
        };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(endpointUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify(body),
            signal: controller.signal
        });

        if (!response.ok) {
            const responseText = await response.text().catch(() => '');
            const upstreamPreview = String(responseText || '').slice(0, 300);
            const integrationError = new MailMktIntegrationError(
                `SendGrid respondeu HTTP ${response.status}`,
                {
                    statusCode: response.status >= 500 ? 503 : 502,
                    upstreamStatus: response.status,
                    retryable: response.status >= 500 || response.status === 429
                }
            );
            integrationError.upstreamBodyPreview = upstreamPreview || null;
            throw integrationError;
        }

        return true;
    } catch (error) {
        if (error instanceof MailMktIntegrationError) {
            throw error;
        }

        if (error?.name === 'AbortError') {
            throw new MailMktIntegrationError('Timeout ao enviar confirmacao de email via SendGrid', {
                statusCode: 503,
                retryable: true
            });
        }

        throw new MailMktIntegrationError(`Falha de rede ao enviar confirmacao via SendGrid: ${error.message}`, {
            statusCode: 503,
            retryable: true
        });
    } finally {
        clearTimeout(timeout);
    }
}

async function sendEmailConfirmationViaMailgun(payload, config) {
    const endpointUrl = resolveMailgunEndpointUrl(config.mailgunBaseUrl, config.mailgunDomain);
    const apiKey = String(config.mailgunApiKey || '').trim();
    const fromEmail = normalizeEmail(config.mailgunFromEmail);
    const fromName = String(config.mailgunFromName || '').trim();
    const replyToEmail = normalizeEmail(config.mailgunReplyToEmail);
    const replyToName = String(config.mailgunReplyToName || '').trim();
    const timeoutMs = clampNumber(config.requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS);

    if (!endpointUrl) {
        throw new MailMktIntegrationError('MAILGUN_DOMAIN ou MAILGUN_BASE_URL nao configurada', {
            statusCode: 500,
            retryable: false
        });
    }

    if (!apiKey) {
        throw new MailMktIntegrationError('MAILGUN_API_KEY nao configurada', {
            statusCode: 500,
            retryable: false
        });
    }

    if (!fromEmail) {
        throw new MailMktIntegrationError('MAILGUN_FROM_EMAIL nao configurada', {
            statusCode: 500,
            retryable: false
        });
    }

    const recipientEmail = normalizeEmail(payload.email);
    if (!recipientEmail) {
        throw new MailMktIntegrationError('Email do destinatario nao informado', {
            statusCode: 400,
            retryable: false
        });
    }

    const recipientName = String(payload.name || '').trim() || normalizePersonName('', recipientEmail);
    const subject = String(payload.subject || '').trim() || DEFAULT_EMAIL_SUBJECT_TEMPLATE;
    const text = String(payload.text || '').trim();
    const html = String(payload.html || '').trim();
    const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
    const toHeader = recipientName ? `${recipientName} <${recipientEmail}>` : recipientEmail;

    const formData = new URLSearchParams();
    formData.set('from', fromHeader);
    formData.set('to', toHeader);
    formData.set('subject', subject);
    if (text) {
        formData.set('text', text);
    } else {
        formData.set('text', DEFAULT_EMAIL_TEXT_TEMPLATE);
    }
    if (html) {
        formData.set('html', html);
    }
    if (replyToEmail) {
        const replyToHeader = replyToName ? `${replyToName} <${replyToEmail}>` : replyToEmail;
        formData.set('h:Reply-To', replyToHeader);
    }

    const basicAuthToken = Buffer.from(`api:${apiKey}`).toString('base64');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(endpointUrl, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${basicAuthToken}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString(),
            signal: controller.signal
        });

        if (!response.ok) {
            const responseText = await response.text().catch(() => '');
            const upstreamPreview = String(responseText || '').slice(0, 300);
            const integrationError = new MailMktIntegrationError(
                `Mailgun respondeu HTTP ${response.status}`,
                {
                    statusCode: response.status >= 500 ? 503 : 502,
                    upstreamStatus: response.status,
                    retryable: response.status >= 500 || response.status === 429
                }
            );
            integrationError.upstreamBodyPreview = upstreamPreview || null;
            throw integrationError;
        }

        return true;
    } catch (error) {
        if (error instanceof MailMktIntegrationError) {
            throw error;
        }

        if (error?.name === 'AbortError') {
            throw new MailMktIntegrationError('Timeout ao enviar confirmacao de email via Mailgun', {
                statusCode: 503,
                retryable: true
            });
        }

        throw new MailMktIntegrationError(`Falha de rede ao enviar confirmacao via Mailgun: ${error.message}`, {
            statusCode: 503,
            retryable: true
        });
    } finally {
        clearTimeout(timeout);
    }
}

async function sendRegistrationConfirmationEmail(req, user, tokenPayload, options = {}) {
    const emailSettings = options && typeof options === 'object'
        ? (options.emailSettings && typeof options.emailSettings === 'object' ? options.emailSettings : options)
        : {};
    const config = buildRuntimeEmailDeliveryConfig(emailSettings);
    const appUrl = resolveAppUrl(req);
    const confirmationUrl = buildEmailConfirmationUrl(appUrl, tokenPayload.token);
    const expiresInText = String(tokenPayload?.expiresInText || DEFAULT_EXPIRES_IN_TEXT).trim() || DEFAULT_EXPIRES_IN_TEXT;
    const context = buildEmailTemplateContext(user, confirmationUrl, {
        appName: config.appName,
        expiresInText
    });
    const content = buildRenderedEmailContent(context, config);
    const payload = {
        email: normalizeEmail(user?.email),
        name: normalizePersonName(user?.name, user?.email),
        confirmationUrl,
        appName: config.appName,
        expiresInText,
        subject: content.subject,
        text: content.text,
        html: content.html
    };

    try {
        if (config.provider === 'mailgun') {
            await sendEmailConfirmationViaMailgun(payload, config);
        } else if (config.provider === 'mailmkt') {
            await sendEmailConfirmationViaMailMkt(payload, config);
        } else if (config.provider === 'sendgrid') {
            await sendEmailConfirmationViaSendGrid(payload, config);
        } else {
            throw new MailMktIntegrationError('EMAIL_DELIVERY_PROVIDER invalido', {
                statusCode: 500,
                retryable: false
            });
        }

        console.log('[auth/register] Email de confirmacao enviado', JSON.stringify({
            provider: config.provider,
            email: payload.email,
            userId: Number(user?.id || 0) || null,
            tokenFingerprint: tokenFingerprint(tokenPayload.token),
            expiresAt: tokenPayload.expiresAt
        }));
        return { confirmationUrl, provider: config.provider };
    } catch (error) {
        console.error('[auth/register] Falha ao enviar email de confirmacao', JSON.stringify({
            provider: config.provider,
            email: payload.email,
            userId: Number(user?.id || 0) || null,
            tokenFingerprint: tokenFingerprint(tokenPayload.token),
            upstreamStatus: Number(error?.upstreamStatus || 0) || null,
            upstreamBodyPreview: String(error?.upstreamBodyPreview || '').slice(0, 300) || null,
            message: String(error?.message || 'erro_desconhecido')
        }));
        throw error;
    }
}

function isEmailConfirmed(user) {
    if (!user || !Object.prototype.hasOwnProperty.call(user, 'email_confirmed')) return true;
    if (user.email_confirmed === null || user.email_confirmed === undefined) return true;
    return Number(user.email_confirmed) > 0;
}

function isEmailConfirmationExpired(user, now = Date.now()) {
    const expiresAtRaw = user?.email_confirmation_expires_at;
    if (!expiresAtRaw) return false;
    const expiresAtMs = new Date(expiresAtRaw).getTime();
    if (!Number.isFinite(expiresAtMs)) return true;
    return expiresAtMs < now;
}

module.exports = {
    DEFAULT_APP_NAME,
    DEFAULT_EMAIL_HTML_TEMPLATE,
    DEFAULT_EMAIL_SUBJECT_TEMPLATE,
    DEFAULT_EMAIL_TEXT_TEMPLATE,
    EMAIL_CONFIRMATION_TTL_MS,
    MailMktIntegrationError,
    SUPPORTED_EMAIL_PROVIDERS,
    buildEmailConfirmationUrl,
    buildRuntimeEmailDeliveryConfig,
    createEmailConfirmationTokenPayload,
    hashEmailConfirmationToken,
    isEmailConfirmed,
    isEmailConfirmationExpired,
    resolveAppUrl,
    sendRegistrationConfirmationEmail,
    tokenFingerprint
};
