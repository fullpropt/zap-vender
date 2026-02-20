/**
 * Classificador de intencao para roteamento de fluxos por palavra-chave.
 * Usa Gemini de forma opcional e conservadora.
 */

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash-lite';
const DEFAULT_TIMEOUT_MS = 4500;
const DEFAULT_MIN_CONFIDENCE = 0.7;
const DEFAULT_MAX_CANDIDATES = 5;
const DEFAULT_MIN_CANDIDATES = 1;
const DEFAULT_GEMINI_QUOTA_BACKOFF_MS = 10 * 60 * 1000;

let geminiBlockedUntil = 0;
let geminiBlockReason = '';

function readEnvString(name, fallback = '') {
    const value = process.env[name];
    if (value === undefined || value === null) return fallback;
    return String(value).trim() || fallback;
}

function readEnvNumber(name, fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
    const raw = process.env[name];
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

function isFlowIntentClassifierEnabled() {
    const toggle = readEnvString('FLOW_INTENT_CLASSIFIER_ENABLED', '');
    if (toggle) {
        const normalizedToggle = toggle.toLowerCase();
        if (normalizedToggle === '0' || normalizedToggle === 'false' || normalizedToggle === 'off') {
            return false;
        }
    }

    return Boolean(readEnvString('GEMINI_API_KEY', ''));
}

function isGeminiTemporarilyBlocked() {
    return geminiBlockedUntil > Date.now();
}

function shouldDisableGeminiTemporarily(statusCode, errorText = '') {
    if (Number(statusCode) !== 429) return false;
    const normalized = String(errorText || '').toLowerCase();
    return (
        normalized.includes('quota')
        || normalized.includes('resource_exhausted')
        || normalized.includes('rate limit')
        || normalized.includes('billing')
    );
}

function disableGeminiTemporarily(reason = 'quota_exceeded') {
    const backoffMs = readEnvNumber('GEMINI_QUOTA_BACKOFF_MS', DEFAULT_GEMINI_QUOTA_BACKOFF_MS, 10000, 3600000);
    const nextBlockedUntil = Date.now() + backoffMs;
    geminiBlockedUntil = Math.max(geminiBlockedUntil, nextBlockedUntil);

    if (geminiBlockReason !== reason) {
        geminiBlockReason = reason;
        const untilIso = new Date(geminiBlockedUntil).toISOString();
        console.warn(`[flow-intent] Gemini temporariamente desativado (${reason}) ate ${untilIso}; fallback local sera usado.`);
    }
}

function extractKeywords(value = '') {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function buildCandidatesPayload(candidateFlows) {
    return candidateFlows.map((flow) => ({
        id: Number(flow.id),
        nome: String(flow.name || ''),
        descricao: String(flow.description || ''),
        prioridade: Number(flow.priority) || 0,
        palavras_chave: extractKeywords(flow.trigger_value || ''),
        palavras_chave_casadas: Array.isArray(flow?._keywordMatch?.matchedKeywords)
            ? flow._keywordMatch.matchedKeywords
            : []
    }));
}

function buildClassificationPrompt(messageText, candidatesPayload) {
    return [
        'Voce e um classificador de intencao para roteamento de fluxos de WhatsApp.',
        'Analise a mensagem do usuario e selecione o fluxo MAIS adequado.',
        'Se a mensagem nao combinar claramente com nenhum fluxo, retorne selected_flow_id = null.',
        'Se houver duvida, seja conservador e retorne null.',
        '',
        'Regras:',
        '- Considere semantica da pergunta, nao apenas palavras isoladas.',
        '- Evite falso positivo.',
        '- confidence deve ser um numero de 0 a 1.',
        '- reason deve ser curta.',
        '',
        'Retorne SOMENTE JSON valido no formato:',
        '{"selected_flow_id": number|null, "confidence": number, "reason": string}',
        '',
        `Mensagem do usuario: "${String(messageText || '').trim()}"`,
        `Fluxos candidatos: ${JSON.stringify(candidatesPayload)}`
    ].join('\n');
}

function stripCodeFences(value = '') {
    const text = String(value || '').trim();
    if (!text.startsWith('```')) return text;
    return text
        .replace(/^```[a-zA-Z0-9_-]*\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
}

function parseJsonFromText(value = '') {
    const cleaned = stripCodeFences(value);
    if (!cleaned) return null;

    try {
        return JSON.parse(cleaned);
    } catch (_) {
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start < 0 || end <= start) return null;
        const maybeJson = cleaned.slice(start, end + 1);
        try {
            return JSON.parse(maybeJson);
        } catch (_) {
            return null;
        }
    }
}

function extractGeminiText(payload) {
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';

    return parts
        .map((part) => part?.text)
        .filter(Boolean)
        .join('\n')
        .trim();
}

async function callGemini(prompt) {
    const apiKey = readEnvString('GEMINI_API_KEY', '');
    if (!apiKey) return null;
    if (isGeminiTemporarilyBlocked()) return null;

    const model = readEnvString('GEMINI_MODEL', DEFAULT_GEMINI_MODEL);
    const timeoutMs = readEnvNumber('GEMINI_REQUEST_TIMEOUT_MS', DEFAULT_TIMEOUT_MS, 1000, 15000);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(
            `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: prompt }]
                        }
                    ],
                    generationConfig: {
                        temperature: 0,
                        topP: 0.8,
                        maxOutputTokens: 220,
                        responseMimeType: 'application/json'
                    }
                }),
                signal: controller.signal
            }
        );

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            if (shouldDisableGeminiTemporarily(response.status, errorText)) {
                disableGeminiTemporarily('quota_or_rate_limit');
            }
            throw new Error(`Gemini HTTP ${response.status}: ${errorText.slice(0, 300)}`);
        }

        const payload = await response.json();
        return extractGeminiText(payload);
    } finally {
        clearTimeout(timeout);
    }
}

function normalizeConfidence(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(1, numeric));
}

function normalizeSelectedFlowId(value) {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.trunc(parsed);
}

function normalizeSelectedRouteId(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim();
    return normalized || null;
}

function parseRoutePhrases(value = '') {
    return String(value || '')
        .split(/[,;\n|]+/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function buildIntentRouteCandidatesPayload(intentRoutes = []) {
    return intentRoutes.map((route) => ({
        id: String(route.id || ''),
        nome: String(route.label || route.name || ''),
        frases: parseRoutePhrases(route.phrases || route.keywords || '')
    })).filter((route) => route.id && route.frases.length > 0);
}

function buildIntentRoutePrompt(messageText, routesPayload) {
    return [
        'Voce e um classificador de intencao para escolher a melhor rota de um bloco de fluxo.',
        'Analise a mensagem e escolha a rota mais adequada.',
        'Se a mensagem nao corresponder claramente a nenhuma rota, retorne selected_route_id = null.',
        'Em caso de duvida, retorne null.',
        '',
        'Retorne SOMENTE JSON valido no formato:',
        '{"selected_route_id": string|null, "confidence": number, "reason": string}',
        '',
        `Mensagem do usuario: "${String(messageText || '').trim()}"`,
        `Rotas disponiveis: ${JSON.stringify(routesPayload)}`
    ].join('\n');
}

async function classifyKeywordFlowIntent(messageText, candidateFlows = []) {
    if (!isFlowIntentClassifierEnabled()) return null;
    if (!Array.isArray(candidateFlows) || candidateFlows.length === 0) return null;

    const minCandidates = readEnvNumber('FLOW_INTENT_CLASSIFIER_MIN_CANDIDATES', DEFAULT_MIN_CANDIDATES, 1, 10);
    if (candidateFlows.length < minCandidates) return null;

    const maxCandidates = readEnvNumber('FLOW_INTENT_CLASSIFIER_MAX_CANDIDATES', DEFAULT_MAX_CANDIDATES, 1, 20);
    const limitedCandidates = candidateFlows.slice(0, maxCandidates);
    const candidatesPayload = buildCandidatesPayload(limitedCandidates);
    const prompt = buildClassificationPrompt(messageText, candidatesPayload);

    try {
        const rawResponse = await callGemini(prompt);
        if (!rawResponse) return null;

        const parsed = parseJsonFromText(rawResponse);
        if (!parsed || typeof parsed !== 'object') return null;

        const confidence = normalizeConfidence(parsed.confidence);
        const minConfidence = readEnvNumber('FLOW_INTENT_CLASSIFIER_MIN_CONFIDENCE', DEFAULT_MIN_CONFIDENCE, 0, 1);
        if (confidence < minConfidence) {
            return { status: 'indeterminate', confidence };
        }

        const selectedFlowId = normalizeSelectedFlowId(parsed.selected_flow_id);
        const reason = String(parsed.reason || '').trim();

        if (selectedFlowId === null) {
            return {
                status: 'no_match',
                confidence,
                reason
            };
        }

        const availableFlowIds = new Set(limitedCandidates.map((flow) => Number(flow.id)));
        if (!availableFlowIds.has(selectedFlowId)) {
            return { status: 'indeterminate', confidence };
        }

        return {
            status: 'selected',
            flowId: selectedFlowId,
            confidence,
            reason
        };
    } catch (error) {
        console.warn('[flow-intent] Falha ao classificar intencao com Gemini:', error.message);
        return null;
    }
}

async function classifyIntentRoute(messageText, intentRoutes = []) {
    if (!isFlowIntentClassifierEnabled()) return null;
    if (!Array.isArray(intentRoutes) || intentRoutes.length === 0) return null;

    const routesPayload = buildIntentRouteCandidatesPayload(intentRoutes);
    if (routesPayload.length === 0) return null;

    const prompt = buildIntentRoutePrompt(messageText, routesPayload);

    try {
        const rawResponse = await callGemini(prompt);
        if (!rawResponse) return null;

        const parsed = parseJsonFromText(rawResponse);
        if (!parsed || typeof parsed !== 'object') return null;

        const confidence = normalizeConfidence(parsed.confidence);
        const minConfidence = readEnvNumber('FLOW_INTENT_CLASSIFIER_MIN_CONFIDENCE', DEFAULT_MIN_CONFIDENCE, 0, 1);
        if (confidence < minConfidence) {
            return { status: 'indeterminate', confidence };
        }

        const selectedRouteId = normalizeSelectedRouteId(parsed.selected_route_id);
        const reason = String(parsed.reason || '').trim();
        if (!selectedRouteId) {
            return { status: 'no_match', confidence, reason };
        }

        const availableIds = new Set(routesPayload.map((route) => String(route.id)));
        if (!availableIds.has(String(selectedRouteId))) {
            return { status: 'indeterminate', confidence };
        }

        return {
            status: 'selected',
            routeId: String(selectedRouteId),
            confidence,
            reason
        };
    } catch (error) {
        console.warn('[flow-intent] Falha ao classificar rota de intencao com Gemini:', error.message);
        return null;
    }
}

module.exports = {
    classifyKeywordFlowIntent,
    classifyIntentRoute
};
