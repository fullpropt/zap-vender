/**
 * SELF PROTEÇÃO VEICULAR - Serviço de Fluxos de Automação
 * Executa fluxos de automação baseados em triggers
 */

const { Flow, Lead, Conversation, Message, CustomEvent } = require('../database/models');
const { run, queryOne, generateUUID } = require('../database/connection');
const EventEmitter = require('events');
const Fuse = require('fuse.js');
const { classifyKeywordFlowIntent, classifyIntentRoute } = require('./intentClassifierService');
const INTENT_STOPWORDS = new Set([
    'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos',
    'e', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'uns', 'umas',
    'ao', 'aos', 'para', 'pra', 'pro', 'por', 'com', 'sem',
    'que', 'eu', 'voce', 'voces', 'vc', 'vcs', 'me', 'te', 'se',
    'como', 'onde', 'qual', 'quais', 'quando', 'quanto', 'quanta',
    'posso', 'pode', 'podem', 'quero', 'queria', 'gostaria', 'tem',
    'tenho', 'tinha', 'tiver', 'isso', 'isto', 'aquele', 'aquela',
    'esse', 'essa'
]);
const DEFAULT_INTENT_FUZZY_THRESHOLD = 0.34;
const DEFAULT_INTENT_FUZZY_MIN_SCORE = 0.58;
const DEFAULT_INTENT_FUZZY_MIN_TOKEN_COVERAGE = 0.45;
const INTENT_DIRECTION_GROUPS = [
    {
        id: 'buy',
        roots: ['compr', 'adquir', 'consig', 'encontr', 'acha']
    },
    {
        id: 'sell',
        roots: ['vend', 'revend', 'ofert', 'comercializ']
    }
];
const INTENT_DIRECTION_CONFLICT_PAIRS = [
    ['buy', 'sell']
];
const INTENT_TOKEN_CANONICAL_PREFIXES = [
    { canonical: 'hora', prefixes: ['hora', 'horari'] }
];

function isStrictFlowIntentRoutingEnabled() {
    const value = String(process.env.FLOW_INTENT_CLASSIFIER_STRICT || '').trim().toLowerCase();
    return value === '1' || value === 'true' || value === 'on';
}

function isFlowIntentClassifierConfigured() {
    const enabledValue = String(process.env.FLOW_INTENT_CLASSIFIER_ENABLED || '').trim().toLowerCase();
    if (enabledValue === '0' || enabledValue === 'false' || enabledValue === 'off') {
        return false;
    }
    return Boolean(String(process.env.GEMINI_API_KEY || '').trim());
}

function readIntentNumberEnv(name, fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
    const parsed = Number(process.env[name]);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

function normalizeIntentText(value = '') {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeIntentRouteHandle(value = '') {
    const normalized = String(value || '').trim();
    if (!normalized) return 'default';

    const canonical = normalized
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return canonical || normalized.toLowerCase();
}

function parseIntentPhrases(value = '') {
    return String(value || '')
        .split(/[,;\n|]+/)
        .map((item) => normalizeIntentText(item))
        .filter(Boolean);
}

function includesIntentPhrase(normalizedMessage = '', normalizedPhrase = '') {
    if (!normalizedMessage || !normalizedPhrase) return false;
    return ` ${normalizedMessage} `.includes(` ${normalizedPhrase} `);
}

function tokenizeIntentText(value = '') {
    return normalizeIntentText(value)
        .split(' ')
        .map((token) => token.trim())
        .map((token) => normalizeIntentToken(token))
        .filter((token) => token.length >= 2 && !INTENT_STOPWORDS.has(token));
}

function normalizeIntentToken(token = '') {
    let normalized = normalizeIntentText(token);
    if (!normalized) return '';

    if (normalized.length > 4 && normalized.endsWith('s')) {
        normalized = normalized.slice(0, -1);
    }

    const verbSuffixes = [
        'ariam', 'eriam', 'iriam', 'assem', 'essem', 'issem',
        'ando', 'endo', 'indo', 'arei', 'erei', 'irei',
        'aria', 'eria', 'iria', 'aram', 'eram', 'iram',
        'ava', 'iam', 'ado', 'ido', 'ar', 'er', 'ir'
    ];
    for (const suffix of verbSuffixes) {
        if (normalized.length > suffix.length + 2 && normalized.endsWith(suffix)) {
            normalized = normalized.slice(0, -suffix.length);
            break;
        }
    }

    for (const rule of INTENT_TOKEN_CANONICAL_PREFIXES) {
        if (!rule?.canonical || !Array.isArray(rule?.prefixes)) continue;
        const hasPrefixMatch = rule.prefixes.some((prefix) => normalized.startsWith(String(prefix || '').trim()));
        if (hasPrefixMatch) {
            return String(rule.canonical).trim() || normalized;
        }
    }

    return normalized;
}

function sanitizeOutgoingFlowText(value = '') {
    if (value === null || value === undefined) return '';

    return String(value)
        .normalize('NFC')
        .replace(/\r\n/g, '\n')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim();
}

function tokenMatchesIntentRoot(token = '', root = '') {
    const normalizedToken = String(token || '').trim();
    const normalizedRoot = String(root || '').trim();
    if (!normalizedToken || !normalizedRoot) return false;
    return normalizedToken === normalizedRoot || normalizedToken.startsWith(normalizedRoot);
}

function tokenListHasAnyIntentRoot(tokens = [], roots = []) {
    if (!Array.isArray(tokens) || tokens.length === 0) return false;
    if (!Array.isArray(roots) || roots.length === 0) return false;

    return tokens.some((token) => roots.some((root) => tokenMatchesIntentRoot(token, root)));
}

function resolveIntentDirectionGroupMatches(tokens = []) {
    const matchedGroups = new Set();
    for (const group of INTENT_DIRECTION_GROUPS) {
        if (tokenListHasAnyIntentRoot(tokens, group.roots)) {
            matchedGroups.add(group.id);
        }
    }
    return matchedGroups;
}

function hasIntentDirectionConflict(messageTokens = [], phraseTokens = []) {
    const phraseGroups = resolveIntentDirectionGroupMatches(phraseTokens);
    if (phraseGroups.size === 0) return false;

    const messageGroups = resolveIntentDirectionGroupMatches(messageTokens);
    if (messageGroups.size === 0) return false;

    for (const [groupA, groupB] of INTENT_DIRECTION_CONFLICT_PAIRS) {
        if (
            phraseGroups.has(groupA)
            && !phraseGroups.has(groupB)
            && messageGroups.has(groupB)
            && !messageGroups.has(groupA)
        ) {
            return true;
        }

        if (
            phraseGroups.has(groupB)
            && !phraseGroups.has(groupA)
            && messageGroups.has(groupA)
            && !messageGroups.has(groupB)
        ) {
            return true;
        }
    }

    return false;
}

function hasIntentDirectionAnchorMatch(messageTokens = [], phraseTokens = []) {
    const phraseGroups = resolveIntentDirectionGroupMatches(phraseTokens);
    if (phraseGroups.size === 0) return true;

    const messageGroups = resolveIntentDirectionGroupMatches(messageTokens);
    if (messageGroups.size === 0) return false;

    for (const groupId of phraseGroups) {
        if (messageGroups.has(groupId)) return true;
    }

    return false;
}

function getCommonPrefixLength(a = '', b = '') {
    const max = Math.min(a.length, b.length);
    let length = 0;
    for (let i = 0; i < max; i += 1) {
        if (a[i] !== b[i]) break;
        length += 1;
    }
    return length;
}

function isIntentTokenSimilar(messageToken = '', phraseToken = '') {
    if (!messageToken || !phraseToken) return false;
    if (messageToken === phraseToken) return true;

    const commonPrefixLength = getCommonPrefixLength(messageToken, phraseToken);
    if (commonPrefixLength >= 5) return true;
    if (commonPrefixLength >= 4 && Math.abs(messageToken.length - phraseToken.length) <= 2) return true;

    return false;
}

function hasIntentPrefixTokenMatch(messageTokens = [], phraseToken = '') {
    if (!phraseToken || phraseToken.length < 4) return false;
    return messageTokens.some((messageToken) => {
        if (!messageToken || messageToken.length < 4) return false;
        return isIntentTokenSimilar(messageToken, phraseToken);
    });
}

function scoreIntentPhraseMatch(normalizedMessage = '', messageTokens = [], normalizedPhrase = '') {
    if (!normalizedPhrase) return { matched: false, exact: false, score: 0, strongMatches: 0 };

    if (includesIntentPhrase(normalizedMessage, normalizedPhrase)) {
        const exactWordCount = normalizedPhrase.split(' ').filter(Boolean).length;
        return { matched: true, exact: true, score: 100 + exactWordCount, strongMatches: exactWordCount };
    }

    const phraseTokens = tokenizeIntentText(normalizedPhrase);
    if (phraseTokens.length === 0) return { matched: false, exact: false, score: 0, strongMatches: 0 };
    if (hasIntentDirectionConflict(messageTokens, phraseTokens)) {
        return { matched: false, exact: false, score: 0, strongMatches: 0 };
    }
    if (!hasIntentDirectionAnchorMatch(messageTokens, phraseTokens)) {
        return { matched: false, exact: false, score: 0, strongMatches: 0 };
    }

    const messageTokenSet = new Set(messageTokens);
    let strongMatches = 0;
    let weakMatches = 0;

    for (const phraseToken of phraseTokens) {
        if (messageTokenSet.has(phraseToken)) {
            strongMatches += 1;
            continue;
        }

        if (hasIntentPrefixTokenMatch(messageTokens, phraseToken)) {
            weakMatches += 1;
        }
    }

    if (strongMatches === 0 && weakMatches === 0) {
        return { matched: false, exact: false, score: 0, strongMatches: 0 };
    }

    const coverage = (strongMatches + (weakMatches * 0.7)) / phraseTokens.length;
    const unmatchedCount = Math.max(0, phraseTokens.length - strongMatches - weakMatches);
    const minCoverage = unmatchedCount <= 1 ? 0.55 : 0.65;
    const hasEnoughSignal = (
        strongMatches >= 2
        || (phraseTokens.length === 1 && strongMatches >= 1)
        || (strongMatches >= 1 && weakMatches >= 1)
        || (weakMatches >= 2 && phraseTokens.length <= 3)
    );

    if (!hasEnoughSignal || coverage < minCoverage) {
        return { matched: false, exact: false, score: coverage, strongMatches };
    }

    const specificityBoost = Math.min(phraseTokens.length, 5) * 0.12;
    return {
        matched: true,
        exact: false,
        score: coverage + specificityBoost,
        strongMatches
    };
}

function scoreIntentTokenCoverage(messageTokens = [], phraseTokens = []) {
    if (!Array.isArray(messageTokens) || messageTokens.length === 0) return 0;
    if (!Array.isArray(phraseTokens) || phraseTokens.length === 0) return 0;

    const consumedMessageTokens = new Set();
    let matched = 0;

    for (const phraseToken of phraseTokens) {
        const foundIndex = messageTokens.findIndex((messageToken, index) => {
            if (consumedMessageTokens.has(index)) return false;
            return isIntentTokenSimilar(messageToken, phraseToken);
        });

        if (foundIndex >= 0) {
            consumedMessageTokens.add(foundIndex);
            matched += 1;
        }
    }

    return matched / phraseTokens.length;
}

function parseFlowIntentKeywords(value = '') {
    return parseIntentPhrases(value);
}

function resolveFlowIntentKeywordList(flow = null) {
    const keywords = parseFlowIntentKeywords(flow?.trigger_value || '');
    const unique = new Set(keywords);
    return Array.from(unique);
}

function findBestKeywordFlowByHeuristic(normalizedMessage = '', messageTokens = [], candidateFlows = []) {
    if (!normalizedMessage) return null;
    if (!Array.isArray(candidateFlows) || candidateFlows.length === 0) return null;

    let best = null;

    for (const flow of candidateFlows) {
        const flowId = Number(flow?.id);
        if (!Number.isFinite(flowId) || flowId <= 0) continue;

        const priority = Number(flow?.priority) || 0;
        const keywords = resolveFlowIntentKeywordList(flow);
        if (keywords.length === 0) continue;

        let bestFlowKeywordMatch = null;
        for (const keyword of keywords) {
            const currentMatch = scoreIntentPhraseMatch(normalizedMessage, messageTokens, keyword);
            if (!currentMatch.matched) continue;

            if (
                !bestFlowKeywordMatch
                || (currentMatch.exact && !bestFlowKeywordMatch.exact)
                || (
                    currentMatch.exact === bestFlowKeywordMatch.exact
                    && currentMatch.score > bestFlowKeywordMatch.score
                )
                || (
                    currentMatch.exact === bestFlowKeywordMatch.exact
                    && currentMatch.score === bestFlowKeywordMatch.score
                    && currentMatch.strongMatches > bestFlowKeywordMatch.strongMatches
                )
            ) {
                bestFlowKeywordMatch = currentMatch;
            }
        }

        if (!bestFlowKeywordMatch) continue;

        const isBetter = (
            !best
            || (bestFlowKeywordMatch.exact && !best.match.exact)
            || (
                bestFlowKeywordMatch.exact === best.match.exact
                && bestFlowKeywordMatch.score > best.match.score
            )
            || (
                bestFlowKeywordMatch.exact === best.match.exact
                && bestFlowKeywordMatch.score === best.match.score
                && bestFlowKeywordMatch.strongMatches > best.match.strongMatches
            )
            || (
                bestFlowKeywordMatch.exact === best.match.exact
                && bestFlowKeywordMatch.score === best.match.score
                && bestFlowKeywordMatch.strongMatches === best.match.strongMatches
                && priority > best.priority
            )
        );

        if (isBetter) {
            best = {
                flowId,
                priority,
                match: bestFlowKeywordMatch
            };
        }
    }

    return best;
}

function buildKeywordFlowFuzzyCandidates(candidateFlows = []) {
    const candidates = [];

    for (const flow of candidateFlows) {
        const flowId = Number(flow?.id);
        if (!Number.isFinite(flowId) || flowId <= 0) continue;

        const priority = Number(flow?.priority) || 0;
        const keywords = resolveFlowIntentKeywordList(flow);
        const normalizedName = normalizeIntentText(flow?.name || '');
        if (normalizedName) keywords.push(normalizedName);

        const uniqueKeywords = new Set(
            keywords
                .map((keyword) => String(keyword || '').trim())
                .filter(Boolean)
        );

        for (const keyword of uniqueKeywords) {
            const keywordTokens = tokenizeIntentText(keyword);
            if (keywordTokens.length === 0) continue;

            candidates.push({
                flowId,
                priority,
                keyword,
                keywordTokens,
                keywordCompact: keyword.replace(/\s+/g, '')
            });
        }
    }

    return candidates;
}

function findBestKeywordFlowByFuzzy(normalizedMessage = '', messageTokens = [], candidateFlows = []) {
    if (!normalizedMessage) return null;
    if (!Array.isArray(candidateFlows) || candidateFlows.length === 0) return null;

    const candidates = buildKeywordFlowFuzzyCandidates(candidateFlows);
    if (candidates.length === 0) return null;

    const fuzzyThreshold = readIntentNumberEnv('FLOW_INTENT_FUZZY_THRESHOLD', DEFAULT_INTENT_FUZZY_THRESHOLD, 0.1, 0.8);
    const minCombinedScore = readIntentNumberEnv('FLOW_INTENT_FUZZY_MIN_SCORE', DEFAULT_INTENT_FUZZY_MIN_SCORE, 0.35, 0.95);
    const minTokenCoverage = readIntentNumberEnv('FLOW_INTENT_FUZZY_MIN_TOKEN_COVERAGE', DEFAULT_INTENT_FUZZY_MIN_TOKEN_COVERAGE, 0.2, 1);

    const fuse = new Fuse(candidates, {
        includeScore: true,
        threshold: fuzzyThreshold,
        ignoreLocation: true,
        shouldSort: true,
        minMatchCharLength: 3,
        keys: [
            { name: 'keyword', weight: 0.9 },
            { name: 'keywordCompact', weight: 0.1 }
        ]
    });

    const results = fuse.search(normalizedMessage, {
        limit: Math.min(20, candidates.length)
    });

    let best = null;
    for (const result of results) {
        const item = result?.item;
        if (!item?.flowId) continue;
        if (hasIntentDirectionConflict(messageTokens, item.keywordTokens)) continue;
        if (!hasIntentDirectionAnchorMatch(messageTokens, item.keywordTokens)) continue;

        const rawFuseScore = Number(result?.score);
        const normalizedFuseScore = Number.isFinite(rawFuseScore)
            ? Math.max(0, Math.min(1, rawFuseScore))
            : 1;
        const fuzzyConfidence = 1 - normalizedFuseScore;
        const tokenCoverage = scoreIntentTokenCoverage(messageTokens, item.keywordTokens);
        const priorityBoost = Math.max(0, Math.min(0.1, (Number(item.priority) || 0) * 0.005));
        const combinedScore = (fuzzyConfidence * 0.72) + (tokenCoverage * 0.28) + priorityBoost;

        if (tokenCoverage < minTokenCoverage && fuzzyConfidence < 0.9) {
            continue;
        }
        if (combinedScore < minCombinedScore) {
            continue;
        }

        const isBetter = (
            !best
            || combinedScore > best.combinedScore
            || (
                combinedScore === best.combinedScore
                && tokenCoverage > best.tokenCoverage
            )
            || (
                combinedScore === best.combinedScore
                && tokenCoverage === best.tokenCoverage
                && fuzzyConfidence > best.fuzzyConfidence
            )
            || (
                combinedScore === best.combinedScore
                && tokenCoverage === best.tokenCoverage
                && fuzzyConfidence === best.fuzzyConfidence
                && Number(item.priority) > Number(best.priority)
            )
        );

        if (isBetter) {
            best = {
                flowId: Number(item.flowId),
                priority: Number(item.priority) || 0,
                combinedScore,
                tokenCoverage,
                fuzzyConfidence
            };
        }
    }

    return best;
}

function pickKeywordFlowIdByLocalFallback(messageText = '', candidateFlows = []) {
    const normalizedMessage = normalizeIntentText(messageText);
    if (!normalizedMessage) return null;

    const messageTokens = tokenizeIntentText(normalizedMessage);

    const heuristicMatch = findBestKeywordFlowByHeuristic(normalizedMessage, messageTokens, candidateFlows);
    if (heuristicMatch?.flowId) {
        return heuristicMatch.flowId;
    }

    const fuzzyMatch = findBestKeywordFlowByFuzzy(normalizedMessage, messageTokens, candidateFlows);
    return fuzzyMatch?.flowId || null;
}

function resolveFlowStartNodeId(flow = null) {
    const nodes = Array.isArray(flow?.nodes) ? flow.nodes : [];
    if (nodes.length === 0) return null;

    const explicitStartNode = nodes.find((node) => String(node?.id || '') === 'start');
    if (explicitStartNode?.id) return String(explicitStartNode.id);

    const triggerType = String(flow?.trigger_type || '').trim().toLowerCase();
    const triggerSubtype = triggerType === 'keyword' ? 'keyword' : triggerType;

    const isTriggerNodeMatch = (node) => {
        if (String(node?.type || '').trim().toLowerCase() !== 'trigger') return false;
        const nodeSubtype = String(node?.subtype || '').trim().toLowerCase();
        if (!triggerSubtype) return true;
        if (triggerSubtype === 'keyword') {
            return nodeSubtype === 'keyword' || nodeSubtype === 'intent';
        }
        return nodeSubtype === triggerSubtype;
    };

    const matchingTriggerNode = nodes.find(isTriggerNodeMatch);
    if (matchingTriggerNode?.id) return String(matchingTriggerNode.id);

    const anyTriggerNode = nodes.find((node) => String(node?.type || '').trim().toLowerCase() === 'trigger');
    if (anyTriggerNode?.id) return String(anyTriggerNode.id);

    const edges = Array.isArray(flow?.edges) ? flow.edges : [];
    const incomingTargets = new Set(
        edges
            .map((edge) => String(edge?.target || '').trim())
            .filter(Boolean)
    );
    const rootNode = nodes.find((node) => !incomingTargets.has(String(node?.id || '').trim()));
    if (rootNode?.id) return String(rootNode.id);

    return String(nodes[0]?.id || '') || null;
}

function buildIntentFuzzyCandidates(routes = []) {
    const candidates = [];
    for (const route of routes) {
        const routeId = String(route?.id || '').trim();
        if (!routeId) continue;

        const uniquePhrases = new Set(
            (Array.isArray(route?.normalizedPhrases) ? route.normalizedPhrases : [])
                .map((phrase) => String(phrase || '').trim())
                .filter(Boolean)
        );

        const normalizedLabel = normalizeIntentText(route?.label || '');
        if (normalizedLabel) uniquePhrases.add(normalizedLabel);

        for (const phrase of uniquePhrases) {
            const phraseTokens = tokenizeIntentText(phrase);
            if (phraseTokens.length === 0) continue;
            candidates.push({
                routeId,
                phrase,
                phraseTokens,
                phraseCompact: phrase.replace(/\s+/g, '')
            });
        }
    }
    return candidates;
}

function findBestIntentRouteByFuzzy(normalizedMessage = '', messageTokens = [], routes = []) {
    if (!normalizedMessage) return null;
    if (!Array.isArray(routes) || routes.length === 0) return null;

    const candidates = buildIntentFuzzyCandidates(routes);
    if (candidates.length === 0) return null;

    const fuzzyThreshold = readIntentNumberEnv('FLOW_INTENT_FUZZY_THRESHOLD', DEFAULT_INTENT_FUZZY_THRESHOLD, 0.1, 0.8);
    const minCombinedScore = readIntentNumberEnv('FLOW_INTENT_FUZZY_MIN_SCORE', DEFAULT_INTENT_FUZZY_MIN_SCORE, 0.35, 0.95);
    const minTokenCoverage = readIntentNumberEnv('FLOW_INTENT_FUZZY_MIN_TOKEN_COVERAGE', DEFAULT_INTENT_FUZZY_MIN_TOKEN_COVERAGE, 0.2, 1);

    const fuse = new Fuse(candidates, {
        includeScore: true,
        threshold: fuzzyThreshold,
        ignoreLocation: true,
        shouldSort: true,
        minMatchCharLength: 3,
        keys: [
            { name: 'phrase', weight: 0.9 },
            { name: 'phraseCompact', weight: 0.1 }
        ]
    });

    const results = fuse.search(normalizedMessage, {
        limit: Math.min(15, candidates.length)
    });

    let best = null;
    for (const result of results) {
        const item = result?.item;
        if (!item?.routeId) continue;
        if (hasIntentDirectionConflict(messageTokens, item.phraseTokens)) continue;
        if (!hasIntentDirectionAnchorMatch(messageTokens, item.phraseTokens)) continue;

        const rawFuseScore = Number(result?.score);
        const normalizedFuseScore = Number.isFinite(rawFuseScore)
            ? Math.max(0, Math.min(1, rawFuseScore))
            : 1;
        const fuzzyConfidence = 1 - normalizedFuseScore;
        const tokenCoverage = scoreIntentTokenCoverage(messageTokens, item.phraseTokens);
        const combinedScore = (fuzzyConfidence * 0.72) + (tokenCoverage * 0.28);

        if (tokenCoverage < minTokenCoverage && fuzzyConfidence < 0.9) {
            continue;
        }
        if (combinedScore < minCombinedScore) {
            continue;
        }

        const isBetter = (
            !best
            || combinedScore > best.combinedScore
            || (
                combinedScore === best.combinedScore
                && tokenCoverage > best.tokenCoverage
            )
            || (
                combinedScore === best.combinedScore
                && tokenCoverage === best.tokenCoverage
                && fuzzyConfidence > best.fuzzyConfidence
            )
        );

        if (isBetter) {
            best = {
                routeId: item.routeId,
                combinedScore,
                tokenCoverage,
                fuzzyConfidence
            };
        }
    }

    return best;
}

class FlowService extends EventEmitter {
    constructor() {
        super();
        this.sendFunction = null;
        this.activeExecutions = new Map();
    }
    
    /**
     * Inicializar serviço
     */
    init(sendFunction) {
        this.sendFunction = sendFunction;
        console.log('🔄 Serviço de fluxos de automação iniciado');
    }

    pickKeywordFlowByLocalFallback(messageText, candidateFlows = []) {
        return pickKeywordFlowIdByLocalFallback(messageText, candidateFlows);
    }

    resolveStartNodeId(flow) {
        return resolveFlowStartNodeId(flow);
    }

    getExecutionConversationKey(conversationId) {
        const asNumber = Number(conversationId);
        if (Number.isFinite(asNumber) && asNumber > 0) {
            return String(Math.trunc(asNumber));
        }

        const fallback = String(conversationId || '').trim();
        return fallback || null;
    }

    setActiveExecution(conversationId, execution) {
        const key = this.getExecutionConversationKey(conversationId);
        if (!key) return;
        this.activeExecutions.set(key, execution);
    }

    removeActiveExecution(conversationId) {
        const key = this.getExecutionConversationKey(conversationId);
        if (!key) return;
        this.activeExecutions.delete(key);
    }

    async restoreExecutionFromStorage(conversation, lead = null) {
        const conversationId = conversation?.id;
        if (!conversationId) return null;

        const activeRow = await queryOne(`
            SELECT id, uuid, flow_id, conversation_id, lead_id, current_node, variables, started_at
            FROM flow_executions
            WHERE conversation_id = ? AND status = 'running'
            ORDER BY id DESC
            LIMIT 1
        `, [conversationId]);
        if (!activeRow) return null;

        const flow = await Flow.findById(activeRow.flow_id);
        if (!flow) {
            await run(`
                UPDATE flow_executions
                SET status = 'failed', completed_at = CURRENT_TIMESTAMP, error_message = ?
                WHERE id = ?
            `, ['Fluxo associado nao encontrado para continuar execucao.', activeRow.id]);
            return null;
        }

        let parsedVariables = {};
        try {
            const maybeObject = JSON.parse(activeRow.variables || '{}');
            if (maybeObject && typeof maybeObject === 'object') {
                parsedVariables = maybeObject;
            }
        } catch (_) {
            parsedVariables = {};
        }

        let resolvedLead = lead;
        if (!resolvedLead && activeRow.lead_id) {
            resolvedLead = await Lead.findById(activeRow.lead_id);
        }
        if (!resolvedLead) {
            return null;
        }

        const execution = {
            id: activeRow.id,
            uuid: activeRow.uuid,
            flow,
            lead: resolvedLead,
            conversation,
            currentNode: String(activeRow.current_node || '').trim(),
            variables: parsedVariables,
            triggerMessageText: String(parsedVariables?.trigger_message || '').trim(),
            startedAt: activeRow.started_at ? new Date(activeRow.started_at) : new Date()
        };

        if (!execution.currentNode) {
            await this.endFlow(execution, 'failed', 'Execucao sem no atual para continuar.');
            return null;
        }

        this.setActiveExecution(conversationId, execution);
        return execution;
    }

    async resolveActiveExecution(conversation, lead = null) {
        const cached = this.getActiveExecution(conversation?.id);
        if (cached) {
            if (lead) cached.lead = lead;
            if (conversation) cached.conversation = conversation;
            return cached;
        }

        return this.restoreExecutionFromStorage(conversation, lead);
    }
    
    /**
     * Processar mensagem recebida e verificar triggers
     */
    async processIncomingMessage(message, lead, conversation) {
        // Verificar se bot está ativo para esta conversa
        if (conversation && !conversation.is_bot_active) {
            return null;
        }
        
        // Verificar se já há um fluxo em execução
        const activeExecution = await this.resolveActiveExecution(conversation, lead);
        if (activeExecution) {
            return await this.continueFlow(activeExecution, message);
        }
        
        // Procurar fluxo por palavra-chave
        const text = message.text?.trim() || '';
        let flow = null;
        let suppressKeywordFallback = false;

        if (text) {
            const strictIntentRouting = isStrictFlowIntentRoutingEnabled() && isFlowIntentClassifierConfigured();
            const keywordMatches = await Flow.findKeywordMatches(text);
            const semanticCandidates = await Flow.findActiveKeywordFlows();
            if (semanticCandidates.length > 0) {
                const intentDecision = await classifyKeywordFlowIntent(text, semanticCandidates);
                if (intentDecision?.status === 'selected' && intentDecision.flowId) {
                    flow = semanticCandidates.find((item) => Number(item.id) === Number(intentDecision.flowId)) || null;
                } else if (intentDecision?.status === 'no_match') {
                    suppressKeywordFallback = true;
                } else if (strictIntentRouting) {
                    suppressKeywordFallback = true;
                }
            }

            if (!flow && !suppressKeywordFallback && keywordMatches.length > 0) {
                flow = keywordMatches[0];
            }

            if (!flow && !suppressKeywordFallback && semanticCandidates.length > 0) {
                const localFlowId = this.pickKeywordFlowByLocalFallback(text, semanticCandidates);
                if (localFlowId) {
                    flow = semanticCandidates.find((item) => Number(item.id) === Number(localFlowId)) || null;
                    if (flow) {
                        console.info(`[flow-intent] Fallback local selecionou fluxo ${flow.id} (${flow.name || 'sem-nome'})`);
                    }
                }
            }
        }
        
        // Se não encontrou por keyword, verificar se é novo contato
        if (!flow && conversation?.created) {
            flow = await Flow.findByTrigger('new_contact');
        }
        
        if (flow) {
            return await this.startFlow(flow, lead, conversation, message);
        }
        
        return null;
    }
    
    /**
     * Iniciar execução de um fluxo
     */
    async startFlow(flow, lead, conversation, triggerMessage = null) {
        const executionUuid = generateUUID();
        const startNodeId = this.resolveStartNodeId(flow);

        if (!startNodeId) {
            console.warn(`[flow-intent] Fluxo ${flow?.id || 'desconhecido'} sem nó inicial válido; execução encerrada.`);
            return null;
        }
        
        // Criar registro de execução
        const result = await run(`
            INSERT INTO flow_executions (uuid, flow_id, conversation_id, lead_id, current_node, variables, status)
            VALUES (?, ?, ?, ?, ?, ?, 'running')
        `, [
            executionUuid,
            flow.id,
            conversation?.id,
            lead.id,
            startNodeId,
            JSON.stringify({
                lead: {
                    nome: lead.name,
                    telefone: lead.phone,
                    veiculo: lead.vehicle,
                    placa: lead.plate
                },
                trigger_message: triggerMessage?.text
            })
        ]);
        
        const execution = {
            id: result.lastInsertRowid,
            uuid: executionUuid,
            flow,
            lead,
            conversation,
            currentNode: startNodeId,
            variables: {
                nome: lead.name || 'Cliente',
                telefone: lead.phone,
                veiculo: lead.vehicle || '',
                placa: lead.plate || '',
                trigger_message: triggerMessage?.text || ''
            },
            triggerMessageText: triggerMessage?.text || ''
        };
        
        // Armazenar execução ativa
        if (conversation?.id) {
            this.setActiveExecution(conversation.id, execution);
        }
        
        this.emit('flow:started', { 
            flowId: flow.id, 
            flowName: flow.name,
            leadId: lead.id 
        });
        
        // Executar primeiro nó
        await this.executeNode(execution, startNodeId);
        
        return execution;
    }
    
    /**
     * Continuar fluxo em execução
     */
    async continueFlow(execution, message) {
        const currentNode = this.findNode(execution.flow, execution.currentNode);

        if (!currentNode) {
            await this.endFlow(execution, 'completed');
            return null;
        }

        if (currentNode.type === 'intent') {
            execution.variables.last_response = message.text;
            const selectedHandle = await this.pickTriggerIntentHandle(execution, currentNode, message.text);
            await this.goToNextNode(execution, currentNode, selectedHandle);
            return execution;
        }

        if (currentNode.type === 'wait' || currentNode.type === 'condition') {
            execution.variables.last_response = message.text;

            const nextNodeId = this.evaluateCondition(execution.flow, currentNode, message.text);

            if (nextNodeId) {
                await this.executeNode(execution, nextNodeId);
            } else {
                await this.endFlow(execution, 'completed');
            }
        }

        return execution;
    }
    
    /**
     * Executar um nó do fluxo
     */
    async executeNode(execution, nodeId) {
        const node = this.findNode(execution.flow, nodeId);
        
        if (!node) {
            await this.endFlow(execution, 'completed');
            return;
        }
        
        execution.currentNode = nodeId;
        
        // Atualizar registro
        await run(`
            UPDATE flow_executions 
            SET current_node = ?, variables = ?
            WHERE id = ?
        `, [nodeId, JSON.stringify(execution.variables), execution.id]);
        
        try {
            switch (node.type) {
                case 'trigger':
                    await this.executeTriggerNode(execution, node);
                    break;
                    
                case 'message':
                    // Aguardar delay opcional do bloco de mensagem (0 = imediato)
                    const messageDelaySecondsRaw = Number(node?.data?.delaySeconds);
                    const messageDelaySeconds = Number.isFinite(messageDelaySecondsRaw)
                        ? Math.max(0, messageDelaySecondsRaw)
                        : 0;
                    if (messageDelaySeconds > 0) {
                        await this.delay(messageDelaySeconds * 1000);
                    }

                    // Enviar mensagem
                    const rawContent = this.replaceVariables(node?.data?.content, execution.variables);
                    const content = sanitizeOutgoingFlowText(rawContent);
                    const mediaType = String(node?.data?.mediaType || 'text').trim().toLowerCase() || 'text';
                    
                    if (this.sendFunction && (mediaType !== 'text' || content)) {
                        await this.sendFunction({
                            to: execution.lead.phone,
                            jid: execution.lead.jid,
                            sessionId: execution.conversation?.session_id || null,
                            conversationId: execution.conversation?.id || null,
                            content,
                            mediaType,
                            mediaUrl: node?.data?.mediaUrl
                        });
                    } else if (mediaType === 'text' && !content) {
                        console.warn(
                            `[flow-intent] Mensagem de fluxo vazia ignorada `
                            + `(fluxo ${execution?.flow?.id || 'n/a'}, no ${node?.id || 'n/a'}).`
                        );
                    }
                    
                    // Ir para o proximo no
                    await this.goToNextNode(execution, node);
                    break;
                    
                case 'wait':
                    // Aguarda resposta do usuario
                    // O fluxo sera continuado quando chegar nova mensagem
                    break;

                case 'intent':
                    // Aguarda resposta para classificar a intencao no meio do fluxo
                    break;

                case 'condition':
                    // Aguardar resposta para avaliar condição
                    break;
                    
                case 'delay':
                    // Aguardar tempo especificado
                    const delayMs = (node.data.seconds || 5) * 1000;
                    await this.delay(delayMs);
                    await this.goToNextNode(execution, node);
                    break;
                    
                case 'transfer':
                    // Transferir para atendente
                    if (node.data.message && this.sendFunction) {
                        const transferMsg = this.replaceVariables(node.data.message, execution.variables);
                        await this.sendFunction({
                            to: execution.lead.phone,
                            jid: execution.lead.jid,
                            sessionId: execution.conversation?.session_id || null,
                            conversationId: execution.conversation?.id || null,
                            content: transferMsg
                        });
                    }
                    
                    // Desativar bot para esta conversa
                    if (execution.conversation?.id) {
                        await Conversation.update(execution.conversation.id, { is_bot_active: 0 });
                    }
                    
                    await this.endFlow(execution, 'completed');
                    
                    this.emit('flow:transfer', {
                        flowId: execution.flow.id,
                        leadId: execution.lead.id,
                        conversationId: execution.conversation?.id
                    });
                    break;
                    
                case 'tag':
                    // Adicionar tag ao lead
                    const currentTags = JSON.parse(execution.lead.tags || '[]');
                    if (!currentTags.includes(node.data.tag)) {
                        currentTags.push(node.data.tag);
                        await Lead.update(execution.lead.id, { tags: currentTags });
                    }
                    await this.goToNextNode(execution, node);
                    break;
                    
                case 'status':
                    // Alterar status do lead
                    await Lead.update(execution.lead.id, { status: node.data.status });
                    await this.goToNextNode(execution, node);
                    break;
                    
                case 'webhook':
                    // Disparar webhook
                    this.emit('flow:webhook', {
                        url: node.data.url,
                        data: {
                            lead: execution.lead,
                            variables: execution.variables,
                            flowId: execution.flow.id
                        }
                    });
                    await this.goToNextNode(execution, node);
                    break;

                case 'event': {
                    const rawEventId = Number(node?.data?.eventId);
                    const eventKey = String(node?.data?.eventKey || '').trim();
                    const eventName = String(node?.data?.eventName || '').trim();

                    let customEvent = null;
                    if (Number.isFinite(rawEventId) && rawEventId > 0) {
                        customEvent = await CustomEvent.findById(rawEventId);
                    }
                    if (!customEvent && eventKey) {
                        customEvent = await CustomEvent.findByKey(eventKey);
                    }
                    if (!customEvent && eventName) {
                        customEvent = await CustomEvent.findByName(eventName);
                    }

                    if (customEvent) {
                        await CustomEvent.logOccurrence({
                            event_id: customEvent.id,
                            flow_id: execution.flow?.id || null,
                            node_id: node.id || null,
                            lead_id: execution.lead?.id || null,
                            conversation_id: execution.conversation?.id || null,
                            execution_id: execution.id || null,
                            metadata: {
                                source: 'flow',
                                flowName: execution.flow?.name || '',
                                nodeLabel: node?.data?.label || '',
                                triggerMessage: execution.triggerMessageText || ''
                            }
                        });
                        execution.variables.last_custom_event = customEvent.name;
                        execution.variables.last_custom_event_key = customEvent.event_key;
                    } else {
                        console.warn(`Evento personalizado nao encontrado para o no ${node.id}`);
                    }

                    await this.goToNextNode(execution, node);
                    break;
                }
                    
                case 'end':
                    await this.endFlow(execution, 'completed');
                    break;
                    
                default:
                    await this.goToNextNode(execution, node);
            }
        } catch (error) {
            console.error(`❌ Erro ao executar nó ${nodeId}:`, error.message);
            await this.endFlow(execution, 'failed', error.message);
        }
    }
    
    /**
     * Ir para próximo nó
     */
    resolveTriggerIntentRoutes(node) {
        const nodeType = String(node?.type || '').trim().toLowerCase();
        const subtype = String(node?.subtype || '').trim().toLowerCase();
        if (nodeType === 'trigger' && subtype !== 'keyword' && subtype !== 'intent') {
            return [];
        }
        if (nodeType !== 'trigger' && nodeType !== 'intent') {
            return [];
        }

        const routes = Array.isArray(node?.data?.intentRoutes) ? node.data.intentRoutes : [];
        if (routes.length > 0) {
            return routes
                .map((route, index) => {
                    const id = String(route?.id || `intent-${index + 1}`).trim();
                    const label = String(route?.label || '').trim() || `Intencao ${index + 1}`;
                    const phrases = String(route?.phrases || '').trim();
                    const normalizedPhrases = parseIntentPhrases(phrases);
                    if (!id || normalizedPhrases.length === 0) return null;
                    return { id, label, phrases, normalizedPhrases };
                })
                .filter(Boolean);
        }

        const fallbackPhrases = parseIntentPhrases(node?.data?.keyword || '');
        return fallbackPhrases.map((phrase, index) => ({
            id: `intent-${index + 1}`,
            label: `Intencao ${index + 1}`,
            phrases: phrase,
            normalizedPhrases: [phrase]
        }));
    }

    async pickTriggerIntentHandle(execution, node, responseText = null) {
        const routes = this.resolveTriggerIntentRoutes(node);
        if (routes.length === 0) return null;

        const messageText = String(responseText ?? execution?.triggerMessageText ?? execution?.variables?.trigger_message ?? '').trim();
        if (!messageText) return null;
        const strictIntentRouting = isStrictFlowIntentRoutingEnabled() && isFlowIntentClassifierConfigured();
        const nodeType = String(node?.type || '').trim().toLowerCase();

        const semanticDecision = await classifyIntentRoute(messageText, routes);
        if (semanticDecision?.status === 'selected' && semanticDecision.routeId) {
            return String(semanticDecision.routeId);
        }
        if (semanticDecision?.status === 'no_match') {
            if (strictIntentRouting && nodeType === 'trigger') {
                return null;
            }
        }
        if (strictIntentRouting && nodeType === 'trigger') {
            return null;
        }

        const normalizedMessage = normalizeIntentText(messageText);
        if (!normalizedMessage) return null;
        const messageTokens = tokenizeIntentText(normalizedMessage);

        let best = null;
        for (const route of routes) {
            let bestRouteMatch = null;

            for (const phrase of route.normalizedPhrases) {
                const currentMatch = scoreIntentPhraseMatch(normalizedMessage, messageTokens, phrase);
                if (!currentMatch.matched) continue;

                if (
                    !bestRouteMatch
                    || (currentMatch.exact && !bestRouteMatch.exact)
                    || (
                        currentMatch.exact === bestRouteMatch.exact
                        && currentMatch.score > bestRouteMatch.score
                    )
                    || (
                        currentMatch.exact === bestRouteMatch.exact
                        && currentMatch.score === bestRouteMatch.score
                        && currentMatch.strongMatches > bestRouteMatch.strongMatches
                    )
                ) {
                    bestRouteMatch = currentMatch;
                }
            }

            if (!bestRouteMatch) continue;

            const isBetter = (
                !best
                || (bestRouteMatch.exact && !best.match.exact)
                || (
                    bestRouteMatch.exact === best.match.exact
                    && bestRouteMatch.score > best.match.score
                )
                || (
                    bestRouteMatch.exact === best.match.exact
                    && bestRouteMatch.score === best.match.score
                    && bestRouteMatch.strongMatches > best.match.strongMatches
                )
            );

            if (isBetter) {
                best = { id: route.id, match: bestRouteMatch };
            }
        }

        if (best?.id) {
            return best.id;
        }

        const fuzzyMatch = findBestIntentRouteByFuzzy(normalizedMessage, messageTokens, routes);
        return fuzzyMatch?.routeId || null;
    }

    async executeTriggerNode(execution, node) {
        const selectedHandle = await this.pickTriggerIntentHandle(execution, node);

        if (selectedHandle) {
            execution.variables.trigger_intent_handle = selectedHandle;
        } else {
            delete execution.variables.trigger_intent_handle;
        }

        await run(`
            UPDATE flow_executions
            SET variables = ?
            WHERE id = ?
        `, [JSON.stringify(execution.variables), execution.id]);

        await this.goToNextNode(execution, node, selectedHandle);
    }

    async goToNextNode(execution, currentNode, preferredSourceHandle = null) {
        const outgoingEdges = (execution.flow.edges || []).filter((edge) => edge.source === currentNode.id);
        if (outgoingEdges.length === 0) {
            await this.endFlow(execution, 'completed');
            return;
        }

        const subtype = String(currentNode?.subtype || '').trim().toLowerCase();
        const isIntentNode = currentNode?.type === 'intent' || (currentNode?.type === 'trigger' && (subtype === 'keyword' || subtype === 'intent'));
        const rawHandle = (value) => {
            const normalized = String(value || '').trim();
            return normalized || 'default';
        };
        const canonicalHandle = (value) => {
            const raw = rawHandle(value);
            if (raw === 'default') return raw;
            return normalizeIntentRouteHandle(raw);
        };

        let edge = null;
        if (isIntentNode && preferredSourceHandle) {
            const preferredRaw = rawHandle(preferredSourceHandle);
            const preferredCanonical = canonicalHandle(preferredSourceHandle);
            const acceptedHandles = new Set([
                preferredRaw,
                preferredCanonical
            ]);

            const matchingRoute = this.resolveTriggerIntentRoutes(currentNode).find((route) => {
                const routeIdRaw = rawHandle(route?.id);
                const routeIdCanonical = canonicalHandle(route?.id);
                const routeLabelRaw = rawHandle(route?.label);
                const routeLabelCanonical = canonicalHandle(route?.label);
                return (
                    routeIdRaw === preferredRaw
                    || routeIdCanonical === preferredCanonical
                    || routeLabelRaw === preferredRaw
                    || routeLabelCanonical === preferredCanonical
                );
            });

            if (matchingRoute) {
                const aliases = [
                    matchingRoute.id,
                    matchingRoute.label,
                    ...parseIntentPhrases(matchingRoute.phrases || '')
                ];

                for (const alias of aliases) {
                    acceptedHandles.add(rawHandle(alias));
                    acceptedHandles.add(canonicalHandle(alias));
                }
            }

            edge = outgoingEdges.find((item) => {
                const edgeRaw = rawHandle(item.sourceHandle);
                const edgeCanonical = canonicalHandle(item.sourceHandle);
                return acceptedHandles.has(edgeRaw) || acceptedHandles.has(edgeCanonical);
            });
        }

        if (!edge) {
            edge = outgoingEdges.find((item) => rawHandle(item.sourceHandle) === 'default');
        }

        if (!edge && isIntentNode) {
            const intentSpecificEdges = outgoingEdges.filter((item) => rawHandle(item.sourceHandle) !== 'default');
            if (intentSpecificEdges.length === 1) {
                edge = intentSpecificEdges[0];
            }
        }

        if (!edge && !isIntentNode) {
            edge = outgoingEdges[0];
        }

        if (edge) {
            await this.executeNode(execution, edge.target);
        } else {
            if (isIntentNode) {
                const availableHandles = outgoingEdges.map((item) => rawHandle(item.sourceHandle)).join(', ');
                console.warn(
                    `[flow-intent] Sem saida correspondente no no ${currentNode?.id || 'desconhecido'} `
                    + `(fluxo ${execution?.flow?.id || 'n/a'}, conversa ${execution?.conversation?.id || 'n/a'}). `
                    + `Preferido: ${String(preferredSourceHandle || 'null')}. Disponiveis: [${availableHandles}]`
                );
            }
            await this.endFlow(execution, 'completed');
        }
    }
    
    /**
     * Avaliar condição e retornar próximo nó
     */
    evaluateCondition(flow, node, response) {
        const text = response?.toLowerCase().trim() || '';
        
        // Verificar condições definidas no nó
        if (node.data.conditions) {
            for (const condition of node.data.conditions) {
                if (text === condition.value.toLowerCase() || text.includes(condition.value.toLowerCase())) {
                    return condition.next;
                }
            }
        }
        
        // Procurar nas edges
        const edges = flow.edges.filter(e => e.source === node.id);
        
        for (const edge of edges) {
            if (edge.label && (text === edge.label.toLowerCase() || text.includes(edge.label.toLowerCase()))) {
                return edge.target;
            }
        }
        
        // Retornar edge padrão (sem label)
        const defaultEdge = edges.find(e => !e.label);
        return defaultEdge?.target;
    }
    
    /**
     * Encerrar fluxo
     */
    async endFlow(execution, status, errorMessage = null) {
        await run(`
            UPDATE flow_executions 
            SET status = ?, completed_at = CURRENT_TIMESTAMP, error_message = ?
            WHERE id = ?
        `, [status, errorMessage, execution.id]);
        
        // Remover da lista de execuções ativas
        if (execution.conversation?.id) {
            this.removeActiveExecution(execution.conversation.id);
        }
        
        this.emit('flow:ended', {
            flowId: execution.flow.id,
            leadId: execution.lead.id,
            status,
            errorMessage
        });
    }
    
    /**
     * Encontrar nó no fluxo
     */
    findNode(flow, nodeId) {
        return flow.nodes.find(n => n.id === nodeId);
    }
    
    /**
     * Substituir variáveis no texto
     */
    replaceVariables(text, variables) {
        if (!text) return '';
        
        let result = text;
        
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
            result = result.replace(regex, value || '');
        }
        
        return result;
    }
    
    /**
     * Obter execução ativa de uma conversa
     */
    getActiveExecution(conversationId) {
        const key = this.getExecutionConversationKey(conversationId);
        if (!key) return null;
        return this.activeExecutions.get(key) || null;
    }
    
    /**
     * Pausar execução
     */
    async pauseExecution(conversationId) {
        const execution = this.getActiveExecution(conversationId);
        if (execution) {
            await run(`UPDATE flow_executions SET status = 'paused' WHERE id = ?`, [execution.id]);
            this.removeActiveExecution(conversationId);
        }
    }
    
    /**
     * Cancelar execução
     */
    async cancelExecution(conversationId) {
        const execution = this.getActiveExecution(conversationId);
        if (execution) {
            await run(`UPDATE flow_executions SET status = 'cancelled' WHERE id = ?`, [execution.id]);
            this.removeActiveExecution(conversationId);
        }
    }
    
    /**
     * Utilitário de delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new FlowService();
module.exports.FlowService = FlowService;
