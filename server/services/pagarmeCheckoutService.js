const DEFAULT_SUPPORT_EMAIL = 'suporte@zapvender.com';
const DEFAULT_API_BASE_URL_PRODUCTION = 'https://api.pagar.me/core/v5';
const DEFAULT_API_BASE_URL_TEST = 'https://sdx-api.pagar.me/core/v5';

const PLAN_CATALOG = {
    starter: {
        key: 'starter',
        code: 'starter',
        name: 'Starter',
        priceId: String(process.env.PAGARME_PLAN_STARTER || '').trim(),
        trialDays: 0
    },
    premium: {
        key: 'premium',
        code: 'premium',
        name: 'Premium',
        priceId: String(process.env.PAGARME_PLAN_PREMIUM || '').trim(),
        trialDays: 7
    },
    advanced: {
        key: 'advanced',
        code: 'advanced',
        name: 'Avancado',
        priceId: String(process.env.PAGARME_PLAN_ADVANCED || process.env.PAGARME_PLAN_AVANCADO || '').trim(),
        trialDays: 0
    }
};

const PAGARME_TO_APP_PLAN_STATUS = {
    active: 'active',
    paid: 'active',
    trialing: 'trialing',
    future: 'trialing',
    processing: 'trialing',
    pending: 'past_due',
    unpaid: 'past_due',
    past_due: 'past_due',
    failed: 'past_due',
    overdue: 'past_due',
    canceled: 'canceled',
    cancelled: 'canceled',
    inactive: 'suspended',
    suspended: 'suspended',
    ended: 'expired',
    expired: 'expired'
};

function trimTrailingSlash(value) {
    return String(value || '').replace(/\/+$/, '');
}

function normalizePlanKey(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    if (normalized === 'avancado') return 'advanced';
    return normalized;
}

function getPlanConfig(planKey) {
    const normalizedPlanKey = normalizePlanKey(planKey);
    const plan = PLAN_CATALOG[normalizedPlanKey];
    if (!plan || !plan.priceId) {
        return null;
    }
    return { ...plan };
}

function listPlanCatalog() {
    return Object.values(PLAN_CATALOG).map((plan) => ({ ...plan }));
}

function inferPlanByPriceId(priceId) {
    const normalizedPriceId = String(priceId || '').trim();
    if (!normalizedPriceId) return null;
    return listPlanCatalog().find((plan) => plan.priceId === normalizedPriceId) || null;
}

function getSupportEmail() {
    return String(process.env.SALES_SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL).trim() || DEFAULT_SUPPORT_EMAIL;
}

function normalizePlanStatus(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return PAGARME_TO_APP_PLAN_STATUS[normalized] || 'active';
}

function getPagarmeSecretKey() {
    const secretKey = String(process.env.PAGARME_SECRET_KEY || '').trim();
    if (!secretKey) {
        throw new Error('PAGARME_SECRET_KEY nao configurada');
    }
    return secretKey;
}

function getPagarmeApiBaseUrl() {
    const configuredBaseUrl = trimTrailingSlash(process.env.PAGARME_API_BASE_URL || '');
    if (configuredBaseUrl) return configuredBaseUrl;

    const secretKey = getPagarmeSecretKey();
    if (secretKey.startsWith('sk_test_')) {
        return DEFAULT_API_BASE_URL_TEST;
    }
    return DEFAULT_API_BASE_URL_PRODUCTION;
}

function buildPagarmeAuthorizationHeader() {
    const secretKey = getPagarmeSecretKey();
    return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
}

function sanitizeMetadataValue(value, maxLength = 500) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return normalized.slice(0, maxLength);
}

function normalizeMetadataObject(metadata = {}) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return {};
    }

    const entries = Object.entries(metadata).slice(0, 20);
    const normalized = {};

    for (const [rawKey, rawValue] of entries) {
        const key = String(rawKey || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 40);
        if (!key) continue;

        const value = sanitizeMetadataValue(rawValue);
        if (!value) continue;
        normalized[key] = value;
    }

    return normalized;
}

function normalizeCustomerEmail(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return '';
    return normalized;
}

function normalizePhoneDigits(value) {
    return String(value || '').replace(/\D+/g, '');
}

function buildCustomerPhonesPayload(value) {
    const digits = normalizePhoneDigits(value);
    if (!digits) return null;

    let normalized = digits;
    let countryCode = '55';

    if (normalized.length > 11 && normalized.startsWith('55')) {
        countryCode = '55';
        normalized = normalized.slice(2);
    } else if (normalized.length > 11) {
        const extraDigits = normalized.length - 11;
        countryCode = normalized.slice(0, extraDigits);
        normalized = normalized.slice(extraDigits);
    }

    if (normalized.length < 10) return null;

    const areaCode = normalized.slice(0, 2);
    const number = normalized.slice(2);
    if (!areaCode || !number) return null;

    return {
        mobile_phone: {
            country_code: countryCode,
            area_code: areaCode,
            number
        }
    };
}

async function resolvePagarmeCustomerId(customer = {}) {
    const customerEmail = normalizeCustomerEmail(customer?.email);
    if (!customerEmail) return '';

    const customerName = sanitizeMetadataValue(customer?.name, 120);
    const customerPhones = buildCustomerPhonesPayload(customer?.phone);

    try {
        const existingCustomers = await pagarmeRequest(`/customers?email=${encodeURIComponent(customerEmail)}`);
        const existingCustomer = existingCustomers?.data?.[0] || null;

        if (existingCustomer?.id) {
            const updates = {};
            const existingName = sanitizeMetadataValue(existingCustomer?.name, 120);
            const existingPhones = existingCustomer?.phones && typeof existingCustomer.phones === 'object'
                ? existingCustomer.phones
                : null;

            if (customerName && customerName !== existingName) {
                updates.name = customerName;
            }

            if (
                customerPhones
                && JSON.stringify(customerPhones) !== JSON.stringify(existingPhones)
            ) {
                updates.phones = customerPhones;
            }

            if (Object.keys(updates).length > 0) {
                await pagarmeRequest(`/customers/${encodeURIComponent(existingCustomer.id)}`, {
                    method: 'PUT',
                    body: updates
                });
            }

            return String(existingCustomer.id || '').trim();
        }

        const createdCustomer = await pagarmeRequest('/customers', {
            method: 'POST',
            body: {
                name: customerName || customerEmail,
                email: customerEmail,
                type: 'individual',
                ...(customerPhones ? { phones: customerPhones } : {})
            }
        });

        return String(createdCustomer?.id || '').trim();
    } catch (error) {
        console.warn('[pagarmeCheckoutService] Falha ao preparar customer para prefill:', error.message);
        return '';
    }
}

async function pagarmeRequest(path, options = {}) {
    const method = String(options?.method || 'GET').trim().toUpperCase() || 'GET';
    const headers = {
        Accept: 'application/json',
        Authorization: buildPagarmeAuthorizationHeader(),
        ...(options?.headers && typeof options.headers === 'object' ? options.headers : {})
    };

    let body = options?.body;
    if (body && typeof body === 'object' && !(body instanceof Buffer)) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        body = JSON.stringify(body);
    }

    const response = await fetch(`${getPagarmeApiBaseUrl()}${path}`, {
        method,
        headers,
        body: typeof body === 'undefined' ? undefined : body
    });

    const raw = await response.text();
    let payload = {};
    if (raw) {
        try {
            payload = JSON.parse(raw);
        } catch (_) {
            payload = { raw };
        }
    }

    if (!response.ok) {
        const errorMessage = String(
            payload?.message
            || payload?.error
            || payload?.errors?.[0]?.message
            || payload?.raw
            || `Pagar.me HTTP ${response.status}`
        ).trim() || `Pagar.me HTTP ${response.status}`;
        const error = new Error(errorMessage);
        error.statusCode = response.status;
        error.payload = payload;
        throw error;
    }

    return payload;
}

function extractPlanIdFromSubscription(subscription = {}) {
    return String(
        subscription?.plan?.id
        || subscription?.item?.plan?.id
        || subscription?.items?.[0]?.plan?.id
        || subscription?.metadata?.plan_id
        || ''
    ).trim();
}

function extractCustomerId(payload = {}) {
    return String(
        payload?.customer?.id
        || payload?.customer_id
        || payload?.recipient?.customer_id
        || ''
    ).trim();
}

function extractCustomerEmail(payload = {}) {
    const email = String(
        payload?.customer?.email
        || payload?.customer_email
        || payload?.charges?.[0]?.customer?.email
        || payload?.order?.customer?.email
        || ''
    ).trim().toLowerCase();

    return normalizeCustomerEmail(email);
}

function extractRenewalDate(payload = {}) {
    const candidate = String(
        payload?.next_billing_at
        || payload?.current_period?.end_at
        || payload?.current_cycle?.end_at
        || payload?.billing?.next_at
        || ''
    ).trim();

    if (!candidate) return null;
    const parsed = new Date(candidate);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function createCheckoutSession({ plan, customer = {}, metadata = {} }) {
    const resolvedPlan = typeof plan === 'string' ? getPlanConfig(plan) : plan;
    if (!resolvedPlan?.priceId) {
        throw new Error('Plano invalido para checkout');
    }

    const customerEmail = normalizeCustomerEmail(customer?.email);
    const customerName = sanitizeMetadataValue(customer?.name, 120);
    const checkoutMetadata = normalizeMetadataObject({
        plan_key: resolvedPlan.key,
        plan_code: resolvedPlan.code,
        plan_name: resolvedPlan.name,
        pre_checkout_email: customerEmail,
        pre_checkout_name: customerName,
        source: 'zapvender_public_plans',
        ...metadata
    });

    const linkPayload = {
        type: 'subscription',
        name: customerName
            ? `ZapVender ${resolvedPlan.name} - ${customerName}`
            : `ZapVender ${resolvedPlan.name}`,
        max_paid_sessions: 1,
        payment_settings: {
            accepted_payment_methods: ['credit_card'],
            credit_card_settings: {
                operation_type: 'auth_and_capture'
            }
        },
        cart_settings: {
            recurrences: [
                {
                    plan_id: resolvedPlan.priceId,
                    start_in: Math.max(0, Number(resolvedPlan.trialDays || 0))
                }
            ]
        }
    };

    const customerId = await resolvePagarmeCustomerId(customer);
    if (customerId) {
        linkPayload.customer_settings = {
            customer_id: customerId,
            editable: true
        };
    }

    const paymentLink = await pagarmeRequest('/paymentlinks', {
        method: 'POST',
        body: linkPayload
    });

    return {
        id: String(paymentLink?.id || '').trim(),
        url: String(paymentLink?.url || '').trim(),
        raw: paymentLink
    };
}

async function constructWebhookEvent(rawBody) {
    if (!rawBody) return {};
    if (Buffer.isBuffer(rawBody)) {
        return JSON.parse(rawBody.toString('utf8'));
    }
    if (typeof rawBody === 'string') {
        return JSON.parse(rawBody);
    }
    if (typeof rawBody === 'object') {
        return rawBody;
    }
    return {};
}

async function retrieveCheckoutSession(sessionId) {
    const normalizedSessionId = String(sessionId || '').trim();
    if (!normalizedSessionId) {
        throw new Error('session_id do checkout e obrigatorio');
    }

    return pagarmeRequest(`/paymentlinks/${encodeURIComponent(normalizedSessionId)}`);
}

async function retrieveSubscription(subscriptionId) {
    const normalizedSubscriptionId = String(subscriptionId || '').trim();
    if (!normalizedSubscriptionId) return null;

    return pagarmeRequest(`/subscriptions/${encodeURIComponent(normalizedSubscriptionId)}`);
}

async function resolveCheckoutSessionPayload(sessionOrId) {
    let session = sessionOrId;
    if (!session || typeof session !== 'object') {
        session = await retrieveCheckoutSession(sessionOrId);
    }

    const sessionId = String(session?.id || '').trim();
    if (!sessionId) {
        throw new Error('Sessao de checkout invalida');
    }

    const planId = String(
        session?.cart_settings?.recurrences?.[0]?.plan_id
        || session?.cart_settings?.recurrence?.plan_id
        || ''
    ).trim();
    const inferredPlan = inferPlanByPriceId(planId);

    return {
        provider: 'pagarme',
        providerLabel: 'Pagar.me',
        sessionId,
        customerId: '',
        customerEmail: normalizeCustomerEmail(session?.metadata?.pre_checkout_email || ''),
        subscriptionId: '',
        subscriptionStatus: 'active',
        priceId: planId,
        planKey: inferredPlan?.key || normalizePlanKey(session?.metadata?.plan_key || session?.metadata?.plan_code),
        planCode: inferredPlan?.code || normalizePlanKey(session?.metadata?.plan_code),
        planName: inferredPlan?.name || String(session?.metadata?.plan_name || '').trim() || 'Plano',
        renewalDate: null,
        metadata: {
            provider: 'pagarme',
            paymentLinkStatus: String(session?.status || '').trim() || null,
            planStatus: 'active'
        }
    };
}

async function resolveSubscriptionPayload(subscriptionOrId) {
    let subscription = subscriptionOrId;
    if (!subscription || typeof subscription !== 'object') {
        subscription = await retrieveSubscription(subscriptionOrId);
    } else if (!subscription?.customer?.email && subscription?.id) {
        try {
            subscription = await retrieveSubscription(subscription.id);
        } catch (_) {
            // Mantem o payload original caso a reidratacao falhe.
        }
    }

    const subscriptionId = String(subscription?.id || '').trim();
    if (!subscriptionId) {
        throw new Error('Assinatura do Pagar.me invalida');
    }

    const planId = extractPlanIdFromSubscription(subscription);
    const inferredPlan = inferPlanByPriceId(planId);
    const normalizedStatus = normalizePlanStatus(subscription?.status);

    return {
        provider: 'pagarme',
        providerLabel: 'Pagar.me',
        sessionId: String(
            subscription?.payment_link?.id
            || subscription?.metadata?.payment_link_id
            || ''
        ).trim(),
        customerId: extractCustomerId(subscription),
        customerEmail: extractCustomerEmail(subscription),
        subscriptionId,
        subscriptionStatus: normalizedStatus,
        priceId: planId,
        planKey: inferredPlan?.key || normalizePlanKey(subscription?.metadata?.plan_key || subscription?.metadata?.plan_code),
        planCode: inferredPlan?.code || normalizePlanKey(subscription?.metadata?.plan_code),
        planName: inferredPlan?.name || String(subscription?.metadata?.plan_name || '').trim() || 'Plano',
        renewalDate: extractRenewalDate(subscription),
        metadata: {
            provider: 'pagarme',
            pagarmeSubscriptionStatus: String(subscription?.status || '').trim() || null,
            planStatus: normalizedStatus
        }
    };
}

module.exports = {
    constructWebhookEvent,
    createCheckoutSession,
    getPlanConfig,
    getSupportEmail,
    inferPlanByPriceId,
    listPlanCatalog,
    normalizePlanKey,
    normalizePlanStatus,
    resolveCheckoutSessionPayload,
    resolveSubscriptionPayload,
    retrieveCheckoutSession,
    retrieveSubscription
};
