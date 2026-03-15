const Stripe = require('stripe');

const DEFAULT_SUPPORT_EMAIL = 'suporte@zapvender.com';
const DEFAULT_CHECKOUT_DISPLAY_NAME = 'ZapVender';
const DEFAULT_CHECKOUT_BRANDING_API_VERSION = '2025-09-30.clover';

const PLAN_CATALOG = {
    starter: {
        key: 'starter',
        code: 'starter',
        name: 'Starter',
        priceId: String(process.env.STRIPE_PRICE_STARTER || 'price_1T9ZqE1VLNFAgAlTuEVaP6mX').trim(),
        trialDays: 0
    },
    premium: {
        key: 'premium',
        code: 'premium',
        name: 'Premium',
        priceId: String(process.env.STRIPE_PRICE_PREMIUM || 'price_1T9Zz51VLNFAgAlT7uQdYPta').trim(),
        trialDays: 7
    },
    advanced: {
        key: 'advanced',
        code: 'advanced',
        name: 'Avancado',
        priceId: String(process.env.STRIPE_PRICE_ADVANCED || 'price_1T9Zz51VLNFAgAlT7uQdYPta').trim(),
        trialDays: 0
    }
};

const STRIPE_TO_APP_PLAN_STATUS = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    unpaid: 'past_due',
    incomplete: 'past_due',
    incomplete_expired: 'expired',
    canceled: 'canceled',
    paused: 'suspended'
};

let cachedStripeClient = null;

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

function getCheckoutBrandingDisplayName() {
    return String(process.env.STRIPE_CHECKOUT_DISPLAY_NAME || DEFAULT_CHECKOUT_DISPLAY_NAME).trim();
}

function getCheckoutBrandingApiVersion() {
    return String(
        process.env.STRIPE_CHECKOUT_BRANDING_API_VERSION || DEFAULT_CHECKOUT_BRANDING_API_VERSION
    ).trim();
}

function buildCheckoutBrandingSettings() {
    const displayName = getCheckoutBrandingDisplayName();
    if (!displayName) return null;

    return {
        display_name: displayName
    };
}

function getStripeClient() {
    if (cachedStripeClient) return cachedStripeClient;

    const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
    if (!secretKey) {
        throw new Error('STRIPE_SECRET_KEY nao configurada');
    }

    cachedStripeClient = new Stripe(secretKey);
    return cachedStripeClient;
}

function normalizePlanStatus(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return STRIPE_TO_APP_PLAN_STATUS[normalized] || 'active';
}

function sanitizeStripeMetadataValue(value, maxLength = 500) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return normalized.slice(0, maxLength);
}

function normalizeCustomerEmail(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return '';
    return normalized;
}

function normalizeStripeMetadataObject(metadata = {}) {
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

        const value = sanitizeStripeMetadataValue(rawValue);
        if (!value) continue;
        normalized[key] = value;
    }

    return normalized;
}

async function resolveStripeCustomerId(stripe, customer = {}, metadata = {}) {
    const email = normalizeCustomerEmail(customer?.email);
    if (!email) return '';

    const customerName = sanitizeStripeMetadataValue(customer?.name, 120);
    const customerPhone = sanitizeStripeMetadataValue(customer?.phone, 40);

    try {
        const existingCustomers = await stripe.customers.list({ email, limit: 1 });
        const existingCustomer = existingCustomers?.data?.[0] || null;

        if (existingCustomer?.id) {
            const updates = {};
            if (customerName) updates.name = customerName;
            if (customerPhone) updates.phone = customerPhone;
            if (Object.keys(metadata).length > 0) {
                updates.metadata = {
                    ...(existingCustomer?.metadata && typeof existingCustomer.metadata === 'object'
                        ? existingCustomer.metadata
                        : {}),
                    ...metadata
                };
            }
            if (Object.keys(updates).length > 0) {
                await stripe.customers.update(existingCustomer.id, updates);
            }
            return existingCustomer.id;
        }

        const createdCustomer = await stripe.customers.create({
            email,
            name: customerName || undefined,
            phone: customerPhone || undefined,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined
        });
        return String(createdCustomer?.id || '').trim();
    } catch (error) {
        console.warn('[stripeCheckoutService] Falha ao preparar customer para prefill:', error.message);
        return '';
    }
}

async function createCheckoutSession({ plan, successUrl, cancelUrl, customer = {}, metadata = {} }) {
    const resolvedPlan = typeof plan === 'string' ? getPlanConfig(plan) : plan;
    if (!resolvedPlan?.priceId) {
        throw new Error('Plano invalido para checkout');
    }

    const stripe = getStripeClient();
    const customerEmail = normalizeCustomerEmail(customer?.email);
    const checkoutMetadata = {
        plan_key: resolvedPlan.key,
        plan_code: resolvedPlan.code,
        plan_name: resolvedPlan.name,
        source: 'zapvender_public_plans',
        ...normalizeStripeMetadataObject(metadata)
    };

    const subscriptionData = {
        metadata: checkoutMetadata
    };

    if (Number(resolvedPlan.trialDays || 0) > 0) {
        subscriptionData.trial_period_days = Number(resolvedPlan.trialDays);
    }

    const checkoutSessionPayload = {
        mode: 'subscription',
        locale: 'pt-BR',
        billing_address_collection: 'auto',
        allow_promotion_codes: true,
        phone_number_collection: {
            enabled: true
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        line_items: [
            {
                price: resolvedPlan.priceId,
                quantity: 1
            }
        ],
        metadata: checkoutMetadata,
        subscription_data: subscriptionData
    };

    const customerId = await resolveStripeCustomerId(stripe, customer, checkoutMetadata);
    if (customerId) {
        checkoutSessionPayload.customer = customerId;
    } else if (customerEmail) {
        checkoutSessionPayload.customer_email = customerEmail;
    }

    const brandingSettings = buildCheckoutBrandingSettings();
    const requestOptions = {};

    if (brandingSettings) {
        checkoutSessionPayload.branding_settings = brandingSettings;
        requestOptions.apiVersion = getCheckoutBrandingApiVersion();
    }

    return stripe.checkout.sessions.create(checkoutSessionPayload, requestOptions);
}

async function constructWebhookEvent(rawBody, signature) {
    const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
    if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET nao configurada');
    }

    if (!signature) {
        throw new Error('Stripe-Signature ausente');
    }

    const stripe = getStripeClient();
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

async function retrieveCheckoutSession(sessionId) {
    const normalizedSessionId = String(sessionId || '').trim();
    if (!normalizedSessionId) {
        throw new Error('session_id do checkout e obrigatorio');
    }

    const stripe = getStripeClient();
    return stripe.checkout.sessions.retrieve(normalizedSessionId, {
        expand: [
            'line_items.data.price',
            'subscription'
        ]
    });
}

async function retrieveSubscription(subscriptionId) {
    const normalizedSubscriptionId = String(subscriptionId || '').trim();
    if (!normalizedSubscriptionId) return null;

    const stripe = getStripeClient();
    return stripe.subscriptions.retrieve(normalizedSubscriptionId);
}

async function resolveCheckoutSessionPayload(sessionOrId) {
    let session = sessionOrId;
    if (!session || typeof session !== 'object') {
        session = await retrieveCheckoutSession(sessionOrId);
    }

    const baseSessionId = String(session?.id || '').trim();
    if (!baseSessionId) {
        throw new Error('Sessao de checkout invalida');
    }

    const hydratedSession = session?.line_items && session?.subscription
        ? session
        : await retrieveCheckoutSession(baseSessionId);

    const lineItem = Array.isArray(hydratedSession?.line_items?.data)
        ? hydratedSession.line_items.data[0]
        : null;
    const priceId = String(
        lineItem?.price?.id
        || hydratedSession?.metadata?.price_id
        || ''
    ).trim();
    const planFromMetadata = getPlanConfig(
        hydratedSession?.metadata?.plan_key
        || hydratedSession?.metadata?.plan_code
    );
    const inferredPlan = planFromMetadata || inferPlanByPriceId(priceId);
    const subscriptionObject = hydratedSession?.subscription && typeof hydratedSession.subscription === 'object'
        ? hydratedSession.subscription
        : await retrieveSubscription(hydratedSession?.subscription);
    const subscriptionId = String(subscriptionObject?.id || hydratedSession?.subscription || '').trim();
    const customerId = String(hydratedSession?.customer || subscriptionObject?.customer || '').trim();
    const customerEmail = String(
        hydratedSession?.customer_details?.email
        || hydratedSession?.customer_email
        || ''
    ).trim().toLowerCase();
    const renewalDate = Number(subscriptionObject?.current_period_end || 0) > 0
        ? new Date(Number(subscriptionObject.current_period_end) * 1000).toISOString()
        : null;

    return {
        sessionId: baseSessionId,
        customerId,
        customerEmail,
        subscriptionId,
        subscriptionStatus: normalizePlanStatus(subscriptionObject?.status),
        priceId,
        planKey: inferredPlan?.key || normalizePlanKey(hydratedSession?.metadata?.plan_key),
        planCode: inferredPlan?.code || normalizePlanKey(hydratedSession?.metadata?.plan_code),
        planName: inferredPlan?.name || String(hydratedSession?.metadata?.plan_name || '').trim() || 'Plano',
        renewalDate,
        metadata: {
            checkoutMode: String(hydratedSession?.mode || 'subscription').trim() || 'subscription',
            paymentStatus: String(hydratedSession?.payment_status || '').trim() || null,
            subscriptionStatus: String(subscriptionObject?.status || '').trim() || null
        }
    };
}

module.exports = {
    constructWebhookEvent,
    createCheckoutSession,
    getPlanConfig,
    getSupportEmail,
    getStripeClient,
    inferPlanByPriceId,
    listPlanCatalog,
    normalizePlanKey,
    normalizePlanStatus,
    resolveCheckoutSessionPayload,
    retrieveCheckoutSession,
    retrieveSubscription
};
