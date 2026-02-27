/**
 * Gera rascunho de fluxo via OpenAI (sem fallback heuristico).
 */

const DEFAULT_OPENAI_API_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_FLOW_MODEL = 'gpt-5-mini';
const DEFAULT_OPENAI_TIMEOUT_MS = 25000;
const MAX_ASSUMPTIONS = 8;
const MAX_NODES = 48;
const MAX_EDGES = 120;

const ALLOWED_NODE_TYPES = new Set([
    'trigger',
    'intent',
    'message',
    'wait',
    'condition',
    'delay',
    'transfer',
    'tag',
    'status',
    'webhook',
    'event',
    'end'
]);

function createServiceError(message, options = {}) {
    const error = new Error(message);
    error.code = options.code || 'OPENAI_FLOW_DRAFT_ERROR';
    error.statusCode = Number(options.statusCode || 500);
    error.publicMessage = options.publicMessage || message;
    return error;
}

function readEnvString(name, fallback = '') {
    const value = process.env[name];
    if (value === undefined || value === null) return fallback;
    return String(value).trim() || fallback;
}

function readEnvNumber(name, fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
    const parsed = Number(process.env[name]);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

function trimTrailingSlash(value = '') {
    return String(value || '').replace(/\/+$/, '');
}

function normalizeText(value = '') {
    return String(value || '').replace(/\r/g, '').trim();
}

function clip(value, max = 280) {
    const normalized = normalizeText(value);
    if (normalized.length <= max) return normalized;
    return `${normalized.slice(0, Math.max(0, max - 1)).trim()}...`;
}

function normalizeNodeId(value = '', fallback = 'node') {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

    return normalized || fallback;
}

function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBoolean(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1') return true;
    if (value === 0 || value === '0') return false;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', 'yes', 'sim', 'on'].includes(normalized)) return true;
        if (['false', 'no', 'nao', 'não', 'off'].includes(normalized)) return false;
    }
    return fallback;
}

function stripCodeFences(value = '') {
    const text = String(value || '').trim();
    if (!text.startsWith('```')) return text;
    return text
        .replace(/^```[a-z0-9_-]*\s*/i, '')
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

function extractOutputText(payload = {}) {
    if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
        return payload.output_text.trim();
    }

    const output = Array.isArray(payload?.output) ? payload.output : [];
    for (const block of output) {
        const content = Array.isArray(block?.content) ? block.content : [];
        const textParts = content
            .map((part) => (typeof part?.text === 'string' ? part.text : ''))
            .filter(Boolean);
        if (textParts.length) {
            return textParts.join('\n').trim();
        }
    }

    const fallbackChatText = payload?.choices?.[0]?.message?.content;
    if (typeof fallbackChatText === 'string' && fallbackChatText.trim()) {
        return fallbackChatText.trim();
    }

    return '';
}

function normalizeAssumptions(value) {
    if (!Array.isArray(value)) return [];
    const assumptions = value
        .map((item) => clip(item, 260))
        .filter(Boolean);
    return assumptions.slice(0, MAX_ASSUMPTIONS);
}

function normalizeIntentRoutes(value) {
    if (!Array.isArray(value)) return [];
    const uniqueIds = new Set();

    return value
        .map((route, index) => {
            const baseId = normalizeNodeId(route?.id || route?.label || `route_${index + 1}`, `route_${index + 1}`);
            let id = baseId;
            let suffix = 1;
            while (uniqueIds.has(id)) {
                id = `${baseId}_${suffix}`;
                suffix += 1;
            }
            uniqueIds.add(id);

            const label = clip(route?.label || `Intenção ${index + 1}`, 90);
            const phrases = normalizeText(route?.phrases || '');
            if (!phrases) return null;

            return { id, label, phrases: clip(phrases, 380) };
        })
        .filter(Boolean);
}

function normalizeConditions(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((condition) => {
            const next = normalizeNodeId(condition?.next || '', '');
            const normalized = {
                value: clip(condition?.value || '', 140)
            };
            if (next) normalized.next = next;
            return normalized.value ? normalized : null;
        })
        .filter(Boolean);
}

function normalizeNodeData(value = {}) {
    const data = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const normalized = {
        label: clip(data.label || '', 120) || 'Etapa'
    };

    if (Object.prototype.hasOwnProperty.call(data, 'collapsed')) {
        normalized.collapsed = normalizeBoolean(data.collapsed, false);
    }

    const keyword = clip(data.keyword || '', 320);
    if (keyword) normalized.keyword = keyword;

    const intentRoutes = normalizeIntentRoutes(data.intentRoutes);
    if (intentRoutes.length) normalized.intentRoutes = intentRoutes;

    const content = normalizeText(data.content || '');
    if (content) normalized.content = clip(content, 2000);

    if (Object.prototype.hasOwnProperty.call(data, 'delaySeconds')) {
        normalized.delaySeconds = Math.max(0, Math.min(86400, Math.trunc(toFiniteNumber(data.delaySeconds, 0))));
    }

    if (Object.prototype.hasOwnProperty.call(data, 'timeout')) {
        normalized.timeout = Math.max(0, Math.min(86400, Math.trunc(toFiniteNumber(data.timeout, 0))));
    }

    const conditions = normalizeConditions(data.conditions);
    if (conditions.length) normalized.conditions = conditions;

    if (Object.prototype.hasOwnProperty.call(data, 'seconds')) {
        normalized.seconds = Math.max(0, Math.min(86400, Math.trunc(toFiniteNumber(data.seconds, 0))));
    }

    const transferMessage = normalizeText(data.message || '');
    if (transferMessage) normalized.message = clip(transferMessage, 600);

    const tag = clip(data.tag || '', 80);
    if (tag) normalized.tag = tag;

    if (Object.prototype.hasOwnProperty.call(data, 'status')) {
        const status = Math.trunc(toFiniteNumber(data.status, 0));
        if (Number.isFinite(status)) normalized.status = status;
    }

    const url = normalizeText(data.url || '');
    if (url) normalized.url = clip(url, 500);

    if (Object.prototype.hasOwnProperty.call(data, 'eventId')) {
        const rawEventId = data.eventId;
        if (rawEventId === null) {
            normalized.eventId = null;
        } else {
            const eventId = Math.trunc(toFiniteNumber(rawEventId, 0));
            if (eventId > 0) normalized.eventId = eventId;
        }
    }

    const eventKey = clip(data.eventKey || '', 80);
    if (eventKey) normalized.eventKey = eventKey;

    const eventName = clip(data.eventName || '', 120);
    if (eventName) normalized.eventName = eventName;

    return normalized;
}

function normalizeNodes(rawNodes = []) {
    if (!Array.isArray(rawNodes)) return [];
    const usedIds = new Set();

    return rawNodes
        .slice(0, MAX_NODES)
        .map((rawNode, index) => {
            if (!rawNode || typeof rawNode !== 'object') return null;

            const type = String(rawNode.type || '').trim().toLowerCase();
            if (!ALLOWED_NODE_TYPES.has(type)) return null;

            const baseId = normalizeNodeId(rawNode.id || `node_${index + 1}`, `node_${index + 1}`);
            let id = baseId;
            let suffix = 1;
            while (usedIds.has(id)) {
                id = `${baseId}_${suffix}`;
                suffix += 1;
            }
            usedIds.add(id);

            const position = rawNode.position && typeof rawNode.position === 'object'
                ? rawNode.position
                : {};

            const normalized = {
                id,
                type,
                position: {
                    x: Math.round(toFiniteNumber(position.x, 80 + (index * 210))),
                    y: Math.round(toFiniteNumber(position.y, 100))
                },
                data: normalizeNodeData(rawNode.data || {})
            };

            const subtype = normalizeNodeId(rawNode.subtype || '', '');
            if (subtype) normalized.subtype = subtype;

            if (!normalized.data.label) {
                normalized.data.label = clip(type, 80);
            }

            return normalized;
        })
        .filter(Boolean);
}

function normalizeEdges(rawEdges = [], availableNodeIds = new Set()) {
    if (!Array.isArray(rawEdges)) return [];

    return rawEdges
        .slice(0, MAX_EDGES)
        .map((edge) => {
            if (!edge || typeof edge !== 'object') return null;

            const source = normalizeNodeId(edge.source || '', '');
            const target = normalizeNodeId(edge.target || '', '');
            if (!source || !target) return null;
            if (!availableNodeIds.has(source) || !availableNodeIds.has(target)) return null;

            const normalized = { source, target };

            const sourceHandle = normalizeNodeId(edge.sourceHandle || '', '');
            if (sourceHandle) normalized.sourceHandle = sourceHandle;

            const targetHandle = normalizeNodeId(edge.targetHandle || '', '');
            if (targetHandle) normalized.targetHandle = targetHandle;

            const label = clip(edge.label || '', 120);
            if (label) normalized.label = label;

            return normalized;
        })
        .filter(Boolean);
}

function normalizeFlowDraft(rawDraft = {}, options = {}) {
    if (!rawDraft || typeof rawDraft !== 'object' || Array.isArray(rawDraft)) {
        throw createServiceError('A IA retornou um payload de fluxo inválido.', {
            code: 'OPENAI_INVALID_DRAFT',
            statusCode: 502,
            publicMessage: 'A IA retornou um rascunho inválido. Tente novamente.'
        });
    }

    const nodes = normalizeNodes(rawDraft.nodes);
    if (!nodes.length) {
        throw createServiceError('A IA não retornou nós válidos para o fluxo.', {
            code: 'OPENAI_INVALID_DRAFT',
            statusCode: 502,
            publicMessage: 'A IA não conseguiu montar um fluxo válido. Tente novamente.'
        });
    }

    const hasTrigger = nodes.some((node) => node.type === 'trigger');
    if (!hasTrigger) {
        throw createServiceError('A IA retornou fluxo sem gatilho inicial.', {
            code: 'OPENAI_INVALID_DRAFT',
            statusCode: 502,
            publicMessage: 'A IA retornou um fluxo sem gatilho inicial. Tente novamente.'
        });
    }

    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = normalizeEdges(rawDraft.edges, nodeIds);
    if (!edges.length) {
        throw createServiceError('A IA não retornou conexões válidas para o fluxo.', {
            code: 'OPENAI_INVALID_DRAFT',
            statusCode: 502,
            publicMessage: 'A IA retornou um fluxo sem conexões válidas. Tente novamente.'
        });
    }

    const name = clip(rawDraft.name || 'Fluxo IA', 120) || 'Fluxo IA';
    const description = clip(rawDraft.description || '', 280)
        || `Rascunho gerado por IA para: ${clip(options.prompt || '', 180)}`;

    return {
        name,
        description,
        nodes,
        edges,
        assumptions: normalizeAssumptions(rawDraft.assumptions),
        is_active: 0,
        metadata: {
            generated_by: 'openai_flow_draft_service',
            provider: 'openai',
            model: options.model || DEFAULT_OPENAI_FLOW_MODEL,
            source_prompt: clip(options.prompt || '', 500)
        }
    };
}

function buildSystemPrompt() {
    return [
        'Você é um arquiteto de fluxos do ZapVender.',
        'Sua tarefa é gerar um rascunho de fluxo de conversa para WhatsApp.',
        'Responda SOMENTE JSON válido, sem markdown e sem texto fora do JSON.',
        'Use português do Brasil nas mensagens.',
        '',
        'Regras obrigatórias:',
        '- Estrutura JSON: { name, description, assumptions, nodes, edges }.',
        '- nodes: array de objetos com { id, type, subtype?, position:{x,y}, data }.',
        '- type permitido: trigger, intent, message, wait, condition, delay, transfer, tag, status, webhook, event, end.',
        '- O fluxo deve ter pelo menos 1 trigger, 1 message e 1 end.',
        '- edges deve conectar nós existentes.',
        '- IDs de nodes devem ser únicos e estáveis.',
        '- Em trigger keyword/intenção, use data.keyword e opcionalmente data.intentRoutes.',
        '- Não invente campos fora do contrato.'
    ].join('\n');
}

function buildUserPrompt(promptText, businessContext = {}) {
    const context = businessContext && typeof businessContext === 'object' ? businessContext : {};
    const lines = [
        'Prompt do usuário:',
        clip(promptText, 3000),
        '',
        'Contexto do negócio (use quando útil):',
        `- Descrição: ${clip(context.businessDescription || '', 600) || '-'}`,
        `- Produtos/Serviços: ${clip(context.productsServices || '', 600) || '-'}`,
        `- Público-alvo: ${clip(context.targetAudience || '', 420) || '-'}`,
        `- Tom de voz: ${clip(context.toneOfVoice || '', 160) || '-'}`,
        `- Regras e políticas: ${clip(context.rulesPolicies || '', 600) || '-'}`,
        `- FAQ: ${clip(context.faqs || '', 900) || '-'}`,
        `- Site: ${clip(context.websiteUrl || '', 240) || '-'}`,
        `- Notas de documentos: ${clip(context.documentsNotes || '', 1200) || '-'}`,
        `- Notas internas: ${clip(context.internalNotes || '', 1200) || '-'}`
    ];

    return lines.join('\n');
}

async function callOpenAiForFlowDraft(options = {}) {
    const apiKey = readEnvString('OPENAI_API_KEY', '');
    if (!apiKey) {
        throw createServiceError('OPENAI_API_KEY não configurada.', {
            code: 'OPENAI_NOT_CONFIGURED',
            statusCode: 503,
            publicMessage: 'Integração de IA não configurada. Defina OPENAI_API_KEY.'
        });
    }

    const prompt = normalizeText(options.prompt || '');
    if (!prompt) {
        throw createServiceError('Prompt de geração é obrigatório.', {
            code: 'OPENAI_INVALID_PROMPT',
            statusCode: 400,
            publicMessage: 'Prompt de geração é obrigatório.'
        });
    }

    const model = readEnvString('OPENAI_FLOW_MODEL', DEFAULT_OPENAI_FLOW_MODEL);
    const baseUrl = trimTrailingSlash(readEnvString('OPENAI_API_BASE_URL', DEFAULT_OPENAI_API_BASE_URL));
    const timeoutMs = readEnvNumber('OPENAI_FLOW_TIMEOUT_MS', DEFAULT_OPENAI_TIMEOUT_MS, 3000, 90000);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(`${baseUrl}/responses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                input: [
                    {
                        role: 'system',
                        content: [
                            {
                                type: 'input_text',
                                text: buildSystemPrompt()
                            }
                        ]
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'input_text',
                                text: buildUserPrompt(prompt, options.businessContext || {})
                            }
                        ]
                    }
                ],
                max_output_tokens: 3000
            }),
            signal: controller.signal
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const apiMessage = String(payload?.error?.message || '').trim();
            throw createServiceError(
                apiMessage || `OpenAI respondeu HTTP ${response.status}.`,
                {
                    code: 'OPENAI_REQUEST_FAILED',
                    statusCode: response.status === 401 || response.status === 403 ? 502 : 502,
                    publicMessage: apiMessage
                        ? `Falha ao gerar fluxo com IA: ${clip(apiMessage, 220)}`
                        : 'Falha ao gerar fluxo com IA no provedor.'
                }
            );
        }

        const outputText = extractOutputText(payload);
        if (!outputText) {
            throw createServiceError('OpenAI não retornou conteúdo para o rascunho.', {
                code: 'OPENAI_EMPTY_RESPONSE',
                statusCode: 502,
                publicMessage: 'A IA não retornou conteúdo. Tente novamente.'
            });
        }

        const parsed = parseJsonFromText(outputText);
        if (!parsed) {
            throw createServiceError('Não foi possível interpretar o JSON retornado pela IA.', {
                code: 'OPENAI_INVALID_JSON',
                statusCode: 502,
                publicMessage: 'A IA retornou um formato inválido. Tente novamente.'
            });
        }

        return {
            provider: 'openai',
            model,
            draft: normalizeFlowDraft(parsed, { prompt, model })
        };
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw createServiceError('Timeout ao chamar OpenAI.', {
                code: 'OPENAI_TIMEOUT',
                statusCode: 504,
                publicMessage: 'A IA demorou para responder. Tente novamente.'
            });
        }
        if (error?.code) throw error;
        throw createServiceError(`Falha ao gerar fluxo com OpenAI: ${error?.message || 'erro inesperado'}`, {
            code: 'OPENAI_UNEXPECTED_FAILURE',
            statusCode: 502,
            publicMessage: 'Falha inesperada ao gerar fluxo com IA.'
        });
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = {
    generateFlowDraft: callOpenAiForFlowDraft
};

