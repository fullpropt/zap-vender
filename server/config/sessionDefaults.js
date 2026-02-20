const LEGACY_COMPANY_SESSION_ID = 'self_whatsapp_session';
const FALLBACK_WHATSAPP_SESSION_ID = 'default_whatsapp_session';

function sanitizeSessionId(value, fallback = '') {
    const normalized = String(value || '').trim();
    return normalized || fallback;
}

const DEFAULT_WHATSAPP_SESSION_ID = sanitizeSessionId(
    process.env.WHATSAPP_DEFAULT_SESSION_ID ||
    process.env.DEFAULT_WHATSAPP_SESSION_ID ||
    process.env.SESSION_ID,
    FALLBACK_WHATSAPP_SESSION_ID
);

const LEGACY_WHATSAPP_SESSION_ALIASES = Array.from(
    new Set(
        [LEGACY_COMPANY_SESSION_ID]
            .map((value) => sanitizeSessionId(value))
            .filter((value) => value && value !== DEFAULT_WHATSAPP_SESSION_ID)
    )
);

function listDefaultSessionCandidates(extraCandidates = []) {
    return Array.from(
        new Set(
            [...extraCandidates, DEFAULT_WHATSAPP_SESSION_ID, ...LEGACY_WHATSAPP_SESSION_ALIASES]
                .map((value) => sanitizeSessionId(value))
                .filter(Boolean)
        )
    );
}

module.exports = {
    DEFAULT_WHATSAPP_SESSION_ID,
    FALLBACK_WHATSAPP_SESSION_ID,
    LEGACY_WHATSAPP_SESSION_ALIASES,
    listDefaultSessionCandidates,
    sanitizeSessionId
};
