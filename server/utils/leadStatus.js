const LEAD_STATUS_VALUES = Object.freeze([1, 2, 3, 4]);
const LEAD_STATUS_SET = new Set(LEAD_STATUS_VALUES);
const LEAD_STATUS_LABELS = Object.freeze({
    1: 'Novo',
    2: 'Em Andamento',
    3: 'Concluido',
    4: 'Perdido'
});

function normalizeLeadStatus(value, fallback = null) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return fallback;
    if (!LEAD_STATUS_SET.has(parsed)) return fallback;
    return parsed;
}

function isLeadStatusValid(value) {
    return normalizeLeadStatus(value, null) !== null;
}

function getLeadStatusLabel(value, fallback = '') {
    const normalized = normalizeLeadStatus(value, null);
    if (normalized === null) return fallback;
    return LEAD_STATUS_LABELS[normalized] || fallback;
}

module.exports = {
    LEAD_STATUS_VALUES,
    LEAD_STATUS_LABELS,
    normalizeLeadStatus,
    isLeadStatusValid,
    getLeadStatusLabel
};
