/**
 * SELF PROTEÇÃO VEICULAR - Serviço de Fluxos de Automação
 * Executa fluxos de automação baseados em triggers
 */

const { Flow, Lead, Conversation, Message, CustomEvent } = require('../database/models');
const { run, queryOne, generateUUID } = require('../database/connection');
const EventEmitter = require('events');
const Fuse = require('fuse.js');
const { normalizeLeadStatus } = require('../utils/leadStatus');
const { classifyKeywordFlowIntent, classifyIntentRoute } = require('./intentClassifierService');
const INTENT_STOPWORDS = new Set([
    'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos',
    'e', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'uns', 'umas',
    'ao', 'aos', 'para', 'pra', 'pro', 'por', 'com', 'sem',
    'que', 'eu', 'voce', 'voces', 'vc', 'vcs', 'me', 'te', 'se',
    'como', 'onde', 'qual', 'quais', 'quando', 'quanto', 'quanta',
    'posso', 'pode', 'podem', 'quero', 'queria', 'gostaria', 'tem',
    'tenho', 'tinha', 'tiver', 'isso', 'isto', 'aquele', 'aquela',
    'esse', 'essa', 'ir', 'indo', 'vai', 'vou'
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
    {
        canonical: 'agenda',
        prefixes: ['hora', 'horari', 'disponib', 'agenda', 'agend']
    }
];
const INTENT_CONTEXT_HISTORY_KEY = 'intent_node_history_by_node';
const INTENT_NO_MATCH_COUNTERS_KEY = 'intent_no_match_count_by_node';
const LEAD_ONCE_MESSAGE_FLAG_KEY = 'flow_once_message_nodes';
const NODE_ENTRY_HANDLE_MAP_KEY = 'node_entry_handle_by_node';
const PENDING_INCOMING_MESSAGES_KEY = 'pending_incoming_messages';
const INTENT_DEFAULT_MESSAGE_ONCE_REENTRY_KEY = 'intent_default_message_once_reentry';
const FLOW_OUTPUT_ACTION_ERROR_MODES = new Set(['continue', 'required', 'fail_all']);
const FLOW_INPUT_RESPONSE_MODES = new Set(['text', 'menu']);
const FLOW_MENU_ROW_PREFIX = 'flow-handle:';
const FLOW_MENU_BUTTON_TEXT_DEFAULT = 'Ver Menu';
const FLOW_MENU_SECTION_TITLE_DEFAULT = 'Opcoes';
const FLOW_MENU_PROMPT_DEFAULT = 'Selecione uma opcao no menu abaixo:';
const FLOW_END_MENU_PROMPT_DEFAULT = 'Se desejar, escolha uma opcao no menu abaixo:';
const FLOW_END_MENU_SECTION_TITLE_DEFAULT = 'Finalizacao';
const FLOW_END_MENU_ROW_PREFIX = 'flow-end-option:';
const FLOW_END_MENU_MAX_CUSTOM_OPTIONS = 9;
const FLOW_END_MENU_FIXED_FINALIZE_LABEL = 'Finalizar';
const FLOW_END_MENU_FINALIZE_TOKEN = 'finalizar';

function normalizeBooleanFlag(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) && value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'sim', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'nao', 'não', 'off'].includes(normalized)) return false;
    }
    return false;
}

function parseFlowOutputActionErrorMode() {
    const raw = String(process.env.FLOW_OUTPUT_ACTION_ERROR_MODE || '').trim().toLowerCase();
    if (FLOW_OUTPUT_ACTION_ERROR_MODES.has(raw)) return raw;
    return 'required';
}

const FLOW_OUTPUT_ACTION_ERROR_MODE = parseFlowOutputActionErrorMode();

function shouldFailOnOutputActionError(action = {}) {
    if (FLOW_OUTPUT_ACTION_ERROR_MODE === 'fail_all') return true;
    if (FLOW_OUTPUT_ACTION_ERROR_MODE === 'continue') return false;
    return [
        action?.required,
        action?.critical,
        action?.failOnError,
        action?.mustSucceed
    ].some((value) => normalizeBooleanFlag(value));
}

async function resolveOwnerScopeUserIdFromAssignee(...assignees) {
    for (const value of assignees) {
        const userId = Number(value || 0);
        if (!Number.isInteger(userId) || userId <= 0) continue;

        const user = await queryOne(
            'SELECT id, owner_user_id FROM users WHERE id = ?',
            [userId]
        );
        const ownerUserId = Number(user?.owner_user_id || user?.id || 0);
        if (Number.isInteger(ownerUserId) && ownerUserId > 0) {
            return ownerUserId;
        }
    }
    return null;
}

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

function isFlowInlineMenuOptionsEnabled() {
    const raw = String(process.env.FLOW_MENU_INLINE_OPTIONS_TEXT || 'false').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'on';
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
        .replace(/[\u200B\u200C\uFEFF]/g, '')
        .trim();
}

function parseIntentResponseList(value = null, fallbackValue = '') {
    if (Array.isArray(value)) {
        return value
            .map((item) => sanitizeOutgoingFlowText(item))
            .filter(Boolean);
    }

    const fallback = sanitizeOutgoingFlowText(value || fallbackValue || '');
    return fallback ? [fallback] : [];
}

function parseFlowEndOptions(value = null) {
    if (Array.isArray(value)) {
        return value
            .map((item) => sanitizeOutgoingFlowText(item))
            .filter(Boolean)
            .slice(0, FLOW_END_MENU_MAX_CUSTOM_OPTIONS);
    }

    const raw = sanitizeOutgoingFlowText(value || '');
    if (!raw) return [];

    return raw
        .split(/[,;\n|]+/)
        .map((item) => sanitizeOutgoingFlowText(item))
        .filter(Boolean)
        .slice(0, FLOW_END_MENU_MAX_CUSTOM_OPTIONS);
}

function parsePathHandleIndex(handleValue = '') {
    const normalized = String(handleValue || '').trim().toLowerCase();
    if (!normalized || normalized === 'default') return 1;

    const match = normalized.match(/^path-(\d+)$/);
    if (!match) return null;

    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isFinite(parsed) || parsed < 1) return null;
    return parsed;
}

function parseLeadCustomFields(value) {
    if (!value) return {};

    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return { ...value };
    }

    let current = value;
    for (let depth = 0; depth < 3; depth += 1) {
        if (typeof current !== 'string') break;
        const trimmed = current.trim();
        if (!trimmed) return {};
        try {
            current = JSON.parse(trimmed);
        } catch (_) {
            return {};
        }
    }

    if (!current || typeof current !== 'object' || Array.isArray(current)) {
        return {};
    }

    return { ...current };
}

function normalizeSystemMetadataObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return { ...value };
}

function normalizeFlowOnceMessageMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    const normalized = {};
    for (const [rawKey, rawTimestamp] of Object.entries(value)) {
        const key = String(rawKey || '').trim();
        if (!key) continue;
        const timestamp = String(
            (rawTimestamp && typeof rawTimestamp === 'object' && !Array.isArray(rawTimestamp))
                ? (rawTimestamp.seenAt || rawTimestamp.sentAt || rawTimestamp.timestamp || '')
                : rawTimestamp || ''
        ).trim();
        normalized[key] = timestamp || new Date().toISOString();
    }
    return normalized;
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
        this.conversationProcessingChains = new Map();
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

    runConversationSerialized(conversationId, task) {
        if (typeof task !== 'function') {
            return Promise.resolve(null);
        }

        const key = this.getExecutionConversationKey(conversationId);
        if (!key) {
            return Promise.resolve().then(() => task());
        }

        const previousChain = this.conversationProcessingChains.get(key) || Promise.resolve();
        const currentChain = previousChain
            .catch(() => null)
            .then(() => task());

        const trackedChain = currentChain.finally(() => {
            if (this.conversationProcessingChains.get(key) === trackedChain) {
                this.conversationProcessingChains.delete(key);
            }
        });

        this.conversationProcessingChains.set(key, trackedChain);
        return trackedChain;
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
            return this.restoreExecutionFromStorage(conversation, lead);
        }

        if (Number(flow?.is_active || 0) !== 1) {
            await run(`
                UPDATE flow_executions
                SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP, error_message = ?
                WHERE id = ?
            `, ['Execucao cancelada automaticamente: fluxo inativo.', activeRow.id]);
            return this.restoreExecutionFromStorage(conversation, lead);
        }

        if (!this.flowMatchesConversationSession(flow, conversation?.session_id)) {
            await run(`
                UPDATE flow_executions
                SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP, error_message = ?
                WHERE id = ?
            `, ['Execucao cancelada automaticamente: fluxo fora do escopo da sessao.', activeRow.id]);
            return this.restoreExecutionFromStorage(conversation, lead);
        }

        if (this.hasInconsistentMenuMode(flow)) {
            await run(`
                UPDATE flow_executions
                SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP, error_message = ?
                WHERE id = ?
            `, ['Execucao cancelada automaticamente: fluxo com modo inconsistente.', activeRow.id]);
            return this.restoreExecutionFromStorage(conversation, lead);
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
            await run(`
                UPDATE flow_executions
                SET status = 'failed', completed_at = CURRENT_TIMESTAMP, error_message = ?
                WHERE id = ?
            `, ['Lead associado nao encontrado para continuar execucao.', activeRow.id]);
            return this.restoreExecutionFromStorage(conversation, lead);
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

            const cachedFlowId = Number(cached?.flow?.id || 0);
            if (!Number.isInteger(cachedFlowId) || cachedFlowId <= 0) {
                await this.endFlow(cached, 'failed', 'Execucao sem fluxo associado.');
                return null;
            }

            const refreshedFlow = await Flow.findById(cachedFlowId);
            if (!refreshedFlow) {
                await this.endFlow(cached, 'failed', 'Fluxo associado nao encontrado para continuar execucao.');
                return null;
            }

            if (Number(refreshedFlow?.is_active || 0) !== 1) {
                await this.endFlow(cached, 'cancelled', 'Execucao cancelada automaticamente: fluxo inativo.');
                return null;
            }

            if (!this.flowMatchesConversationSession(refreshedFlow, cached?.conversation?.session_id)) {
                await this.endFlow(cached, 'cancelled', 'Execucao cancelada automaticamente: fluxo fora do escopo da sessao.');
                return null;
            }

            if (this.hasInconsistentMenuMode(refreshedFlow)) {
                await this.endFlow(cached, 'cancelled', 'Execucao cancelada automaticamente: fluxo com modo inconsistente.');
                return null;
            }

            cached.flow = refreshedFlow;
            return cached;
        }

        return this.restoreExecutionFromStorage(conversation, lead);
    }

    ensureExecutionVariables(execution) {
        if (!execution.variables || typeof execution.variables !== 'object' || Array.isArray(execution.variables)) {
            execution.variables = {};
        }
        return execution.variables;
    }

    normalizeFlowHandle(value = '') {
        const normalized = String(value || '').trim();
        return normalized || 'default';
    }

    normalizeFlowResponseMode(value = 'text') {
        const normalized = String(value || '').trim().toLowerCase();
        if (FLOW_INPUT_RESPONSE_MODES.has(normalized)) return normalized;
        return 'text';
    }

    normalizeFlowBuilderMode(value = '') {
        return String(value || '').trim().toLowerCase() === 'menu' ? 'menu' : 'humanized';
    }

    inferFlowBuilderModeFromNodes(flow = null) {
        const nodes = Array.isArray(flow?.nodes) ? flow.nodes : [];
        const hasIntentMenuNode = nodes.some((node) => this.isIntentMenuEnabled(node));
        return hasIntentMenuNode ? 'menu' : 'humanized';
    }

    isMenuFlowBuilderMode(flow = null) {
        const explicitModeRaw = String(flow?.flow_builder_mode || flow?.flowBuilderMode || '').trim();
        if (explicitModeRaw) {
            return this.normalizeFlowBuilderMode(explicitModeRaw) === 'menu';
        }

        return this.inferFlowBuilderModeFromNodes(flow) === 'menu';
    }

    normalizeMenuButtonUrl(value = '') {
        const rawValue = String(value || '').trim();
        if (!rawValue) return '';

        const normalizedValue = /^https?:\/\//i.test(rawValue)
            ? rawValue
            : `https://${rawValue}`;

        try {
            const parsed = new URL(normalizedValue);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return '';
            }
            return parsed.toString();
        } catch (_) {
            return '';
        }
    }

    resolveAwaitingInputMode(node = null) {
        return this.normalizeFlowResponseMode(node?.data?.responseMode || 'text');
    }

    isAwaitingInputMenuEnabled(node = null) {
        const nodeType = String(node?.type || '').trim().toLowerCase();
        if (nodeType !== 'wait' && nodeType !== 'condition') return false;
        return this.resolveAwaitingInputMode(node) === 'menu';
    }

    normalizeOutputEntryLabelsMap(value = {}) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {};
        }

        const normalizedMap = {};
        for (const [rawHandle, rawLabel] of Object.entries(value)) {
            const handle = this.normalizeFlowHandle(rawHandle);
            const label = sanitizeOutgoingFlowText(rawLabel);
            if (!label) continue;
            normalizedMap[handle] = label;
        }

        return normalizedMap;
    }

    getAwaitingInputEdges(flow = null, node = null) {
        const nodeId = String(node?.id || '').trim();
        if (!nodeId) return [];

        const edges = (Array.isArray(flow?.edges) ? flow.edges : [])
            .filter((edge) => String(edge?.source || '').trim() === nodeId);
        if (edges.length === 0) return [];

        const uniqueByHandle = new Map();
        for (const edge of edges) {
            const handle = this.normalizeFlowHandle(edge?.sourceHandle);
            if (!uniqueByHandle.has(handle)) {
                uniqueByHandle.set(handle, edge);
            }
        }

        return Array.from(uniqueByHandle.values()).sort((a, b) => {
            const aHandle = this.normalizeFlowHandle(a?.sourceHandle);
            const bHandle = this.normalizeFlowHandle(b?.sourceHandle);
            const aIndex = parsePathHandleIndex(aHandle);
            const bIndex = parsePathHandleIndex(bHandle);

            if (aIndex !== null && bIndex !== null) return aIndex - bIndex;
            if (aIndex !== null) return -1;
            if (bIndex !== null) return 1;
            return aHandle.localeCompare(bHandle, 'pt-BR');
        });
    }

    resolveAwaitingInputOptionLabel(node = null, edge = null, index = 1) {
        const handle = this.normalizeFlowHandle(edge?.sourceHandle);
        const labelsMap = this.normalizeOutputEntryLabelsMap(node?.data?.outputEntryLabels || {});
        const mappedLabel = sanitizeOutgoingFlowText(labelsMap[handle] || '');
        if (mappedLabel) return mappedLabel;

        const inputLabel = sanitizeOutgoingFlowText(edge?.inputLabel || '');
        if (inputLabel) return inputLabel;

        const edgeLabel = sanitizeOutgoingFlowText(edge?.label || '');
        if (edgeLabel && !/^\d+$/.test(edgeLabel)) return edgeLabel;

        const optionIndex = Number.isFinite(index) && index > 0 ? Math.trunc(index) : 1;
        return `Opcao ${optionIndex}`;
    }

    getAwaitingInputMenuOptions(flow = null, node = null) {
        const edges = this.getAwaitingInputEdges(flow, node);
        if (edges.length === 0) return [];

        return edges.map((edge, position) => {
            const handle = this.normalizeFlowHandle(edge?.sourceHandle);
            const index = parsePathHandleIndex(handle) || (position + 1);
            const title = this.resolveAwaitingInputOptionLabel(node, edge, index);
            const rawEdgeLabel = sanitizeOutgoingFlowText(edge?.label || '');
            const description = rawEdgeLabel
                && rawEdgeLabel !== title
                && !/^\d+$/.test(rawEdgeLabel)
                ? rawEdgeLabel
                : '';

            return {
                handle,
                rowId: `${FLOW_MENU_ROW_PREFIX}${handle}`,
                title,
                description
            };
        });
    }

    normalizeFlowHandleFromToken(value = '') {
        const rawToken = String(value || '').trim();
        if (!rawToken) return '';

        const normalizedToken = rawToken.toLowerCase();
        if (normalizedToken.startsWith(FLOW_MENU_ROW_PREFIX)) {
            const rawHandle = normalizedToken.slice(FLOW_MENU_ROW_PREFIX.length);
            return this.normalizeFlowHandleFromToken(rawHandle);
        }

        if (normalizedToken === 'default' || normalizedToken === 'padrao' || normalizedToken === 'padrão') {
            return 'default';
        }

        if (/^\d+$/.test(normalizedToken)) {
            const optionNumber = Number.parseInt(normalizedToken, 10);
            if (Number.isFinite(optionNumber) && optionNumber > 0) {
                return optionNumber <= 1 ? 'default' : `path-${optionNumber}`;
            }
        }

        const pathMatch = normalizedToken.match(/^path-(\d+)$/);
        if (pathMatch) {
            const parsed = Number.parseInt(pathMatch[1], 10);
            if (Number.isFinite(parsed) && parsed > 0) {
                return parsed <= 1 ? 'default' : `path-${parsed}`;
            }
        }

        return '';
    }

    resolveFlowHandleFromInboundMessage(message = {}, responseText = '') {
        const candidates = [
            message?.selectionId,
            message?.selectedRowId,
            message?.optionId,
            message?.choiceId,
            responseText
        ];

        for (const candidate of candidates) {
            const handle = this.normalizeFlowHandleFromToken(candidate);
            if (handle) return handle;
        }

        return '';
    }

    resolveMenuPrompt(node = null, execution = null) {
        const rawPrompt = this.replaceVariables(node?.data?.menuPrompt || '', execution?.variables || {});
        const sanitized = sanitizeOutgoingFlowText(rawPrompt);
        return sanitized || FLOW_MENU_PROMPT_DEFAULT;
    }

    buildInlineMenuPrompt(basePrompt = '', rows = []) {
        const prompt = sanitizeOutgoingFlowText(basePrompt || '') || FLOW_MENU_PROMPT_DEFAULT;
        if (!isFlowInlineMenuOptionsEnabled()) {
            return prompt;
        }

        const normalizedRows = Array.isArray(rows) ? rows : [];
        if (normalizedRows.length === 0) {
            return prompt;
        }

        const numberedOptions = normalizedRows
            .map((row, index) => `${index + 1}. ${sanitizeOutgoingFlowText(row?.title || '')}`)
            .filter((line) => !/^\d+\.\s*$/.test(line));

        if (numberedOptions.length === 0) {
            return prompt;
        }

        return `${prompt}\n\n${numberedOptions.join('\n')}\n\nResponda com o numero da opcao.`;
    }

    resolveMenuButtonText(node = null, execution = null) {
        const rawText = this.replaceVariables(node?.data?.menuButtonText || '', execution?.variables || {});
        const sanitized = sanitizeOutgoingFlowText(rawText);
        return sanitized || FLOW_MENU_BUTTON_TEXT_DEFAULT;
    }

    resolveMenuSectionTitle(node = null, execution = null) {
        const rawText = this.replaceVariables(node?.data?.menuSectionTitle || '', execution?.variables || {});
        const sanitized = sanitizeOutgoingFlowText(rawText);
        if (sanitized) return sanitized;
        if (this.isIntentRoutingNode(node)) return 'Intencoes';
        return FLOW_MENU_SECTION_TITLE_DEFAULT;
    }

    resolveMenuTitle(node = null, execution = null) {
        const rawText = this.replaceVariables(node?.data?.menuTitle || '', execution?.variables || {});
        return sanitizeOutgoingFlowText(rawText);
    }

    resolveMenuFooter(node = null, execution = null) {
        const rawText = this.replaceVariables(node?.data?.menuFooter || '', execution?.variables || {});
        return sanitizeOutgoingFlowText(rawText);
    }

    resolveMenuButtonUrl(node = null, execution = null) {
        const rawText = this.replaceVariables(node?.data?.menuButtonUrl || '', execution?.variables || {});
        return this.normalizeMenuButtonUrl(rawText);
    }

    resolveEndNodeFinalMessage(node = null, execution = null) {
        const rawText = this.replaceVariables(node?.data?.content || '', execution?.variables || {});
        return sanitizeOutgoingFlowText(rawText);
    }

    resolveEndNodeMenuPrompt(node = null, execution = null) {
        const rawText = this.replaceVariables(node?.data?.menuPrompt || '', execution?.variables || {});
        return sanitizeOutgoingFlowText(rawText) || FLOW_END_MENU_PROMPT_DEFAULT;
    }

    resolveEndNodeMenuButtonText(node = null, execution = null) {
        const rawText = this.replaceVariables(node?.data?.menuButtonText || '', execution?.variables || {});
        return sanitizeOutgoingFlowText(rawText) || FLOW_MENU_BUTTON_TEXT_DEFAULT;
    }

    resolveEndNodeMenuSectionTitle(node = null, execution = null) {
        const rawText = this.replaceVariables(node?.data?.menuSectionTitle || '', execution?.variables || {});
        return sanitizeOutgoingFlowText(rawText) || FLOW_END_MENU_SECTION_TITLE_DEFAULT;
    }

    resolveEndNodeMenuOptions(node = null, execution = null) {
        const options = parseFlowEndOptions(node?.data?.endOptions);
        const variables = execution?.variables || {};
        const unique = [];
        const seen = new Set();

        for (const option of options) {
            const rendered = sanitizeOutgoingFlowText(this.replaceVariables(option, variables));
            if (!rendered) continue;
            const normalized = normalizeIntentText(rendered);
            if (!normalized) continue;
            if (normalized === FLOW_END_MENU_FINALIZE_TOKEN) continue;
            if (seen.has(normalized)) continue;
            seen.add(normalized);
            unique.push(rendered);
            if (unique.length >= FLOW_END_MENU_MAX_CUSTOM_OPTIONS) break;
        }

        return unique;
    }

    buildEndNodeMenuEntries(execution = null, node = null) {
        const customOptions = this.resolveEndNodeMenuOptions(node, execution);
        const customEntries = customOptions.map((title, index) => {
            const handle = index === 0 ? 'default' : `path-${index + 1}`;
            return {
                type: 'route',
                handle,
                rowId: `${FLOW_END_MENU_ROW_PREFIX}${handle}`,
                title
            };
        });

        return [
            ...customEntries,
            {
                type: 'finalize',
                handle: FLOW_END_MENU_FINALIZE_TOKEN,
                rowId: `${FLOW_END_MENU_ROW_PREFIX}${FLOW_END_MENU_FINALIZE_TOKEN}`,
                title: FLOW_END_MENU_FIXED_FINALIZE_LABEL
            }
        ];
    }

    hasEndNodeRouteOptions(execution = null, node = null) {
        const entries = this.buildEndNodeMenuEntries(execution, node);
        return entries.some((entry) => String(entry?.type || '').trim().toLowerCase() === 'route');
    }

    buildEndNodeMenuPayload(execution = null, node = null) {
        const entries = this.buildEndNodeMenuEntries(execution, node);
        if (entries.length === 0) return null;
        const rows = entries.map((entry) => ({
            rowId: entry.rowId,
            title: entry.title
        }));

        return {
            mediaType: 'list',
            content: this.resolveEndNodeMenuPrompt(node, execution),
            listButtonText: this.resolveEndNodeMenuButtonText(node, execution),
            listSections: [
                {
                    title: this.resolveEndNodeMenuSectionTitle(node, execution),
                    rows
                }
            ]
        };
    }

    resolveEndNodeSelectionFromInboundMessage(execution = null, node = null, message = {}, responseText = '') {
        const entries = this.buildEndNodeMenuEntries(execution, node);
        if (entries.length === 0) return { action: 'finalize', handle: FLOW_END_MENU_FINALIZE_TOKEN };

        const routeEntryByHandle = new Map();
        const entryByRowId = new Map();
        const entryByTitle = new Map();

        for (const entry of entries) {
            const entryRowId = String(entry?.rowId || '').trim().toLowerCase();
            if (entryRowId) {
                entryByRowId.set(entryRowId, entry);
            }

            if (entry?.type === 'route') {
                const normalizedHandle = this.normalizeFlowHandle(entry?.handle);
                routeEntryByHandle.set(normalizedHandle, entry);
            }

            const normalizedTitle = normalizeIntentText(entry?.title || '');
            if (normalizedTitle && !entryByTitle.has(normalizedTitle)) {
                entryByTitle.set(normalizedTitle, entry);
            }
        }

        const candidates = [
            message?.selectionId,
            message?.selectedRowId,
            message?.optionId,
            message?.choiceId,
            message?.selectionText,
            responseText
        ];

        const resolveEntry = (entry = null) => {
            if (!entry) return null;
            if (entry.type === 'finalize') {
                return { action: 'finalize', handle: FLOW_END_MENU_FINALIZE_TOKEN };
            }
            return { action: 'route', handle: this.normalizeFlowHandle(entry.handle) };
        };

        for (const candidateRaw of candidates) {
            const candidate = String(candidateRaw || '').trim();
            if (!candidate) continue;
            const candidateLower = candidate.toLowerCase();

            const directRowMatch = resolveEntry(entryByRowId.get(candidateLower));
            if (directRowMatch) return directRowMatch;

            if (candidateLower.startsWith(FLOW_END_MENU_ROW_PREFIX)) {
                const token = candidateLower.slice(FLOW_END_MENU_ROW_PREFIX.length).trim();
                if (!token) continue;
                if (token === FLOW_END_MENU_FINALIZE_TOKEN) {
                    return { action: 'finalize', handle: FLOW_END_MENU_FINALIZE_TOKEN };
                }
                const parsedHandle = this.normalizeFlowHandleFromToken(token) || this.normalizeFlowHandle(token);
                const routeMatch = resolveEntry(routeEntryByHandle.get(parsedHandle));
                if (routeMatch) return routeMatch;
            }

            const directHandle = this.normalizeFlowHandleFromToken(candidate);
            if (directHandle) {
                const routeMatch = resolveEntry(routeEntryByHandle.get(directHandle));
                if (routeMatch) return routeMatch;
            }

            if (/^\d+$/.test(candidateLower)) {
                const selectedIndex = Number.parseInt(candidateLower, 10);
                if (Number.isFinite(selectedIndex) && selectedIndex > 0 && selectedIndex <= entries.length) {
                    const indexedEntry = resolveEntry(entries[selectedIndex - 1]);
                    if (indexedEntry) return indexedEntry;
                }
            }

            const normalizedCandidate = normalizeIntentText(candidate);
            if (!normalizedCandidate) continue;
            if (normalizedCandidate === FLOW_END_MENU_FINALIZE_TOKEN) {
                return { action: 'finalize', handle: FLOW_END_MENU_FINALIZE_TOKEN };
            }

            const titleMatch = resolveEntry(entryByTitle.get(normalizedCandidate));
            if (titleMatch) return titleMatch;
        }

        return null;
    }

    async maybeSendEndNodeFinalMessage(execution = null, node = null) {
        if (!this.sendFunction) return false;
        const content = this.resolveEndNodeFinalMessage(node, execution);
        if (!content) return false;

        await this.sendFunction({
            leadId: execution?.lead?.id || null,
            to: execution?.lead?.phone || '',
            jid: execution?.lead?.jid || '',
            sessionId: execution?.conversation?.session_id || null,
            conversationId: execution?.conversation?.id || null,
            flowId: execution?.flow?.id || null,
            nodeId: node?.id || null,
            content
        });
        return true;
    }

    async maybeSendEndNodeMenu(execution = null, node = null) {
        if (!this.sendFunction) return false;
        const payload = this.buildEndNodeMenuPayload(execution, node);
        if (!payload) return false;

        await this.sendFunction({
            leadId: execution?.lead?.id || null,
            to: execution?.lead?.phone || '',
            jid: execution?.lead?.jid || '',
            sessionId: execution?.conversation?.session_id || null,
            conversationId: execution?.conversation?.id || null,
            flowId: execution?.flow?.id || null,
            nodeId: node?.id || null,
            content: payload.content,
            mediaType: payload.mediaType,
            listButtonText: payload.listButtonText,
            listSections: payload.listSections
        });
        return true;
    }

    buildAwaitingInputMenuPayload(execution = null, node = null) {
        if (!this.isAwaitingInputMenuEnabled(node)) return null;

        const options = this.getAwaitingInputMenuOptions(execution?.flow, node);
        if (options.length === 0) return null;

        const rows = options
            .slice(0, 10)
            .map((item) => ({
                rowId: item.rowId,
                title: item.title,
                description: item.description || undefined
            }));
        const sectionTitle = this.resolveMenuSectionTitle(node, execution);
        const menuTitle = this.resolveMenuTitle(node, execution);
        const menuFooter = this.resolveMenuFooter(node, execution);

        return {
            mediaType: 'list',
            content: this.buildInlineMenuPrompt(this.resolveMenuPrompt(node, execution), rows),
            listButtonText: this.resolveMenuButtonText(node, execution),
            listTitle: menuTitle || undefined,
            listFooter: menuFooter || undefined,
            listSections: [
                {
                    title: sectionTitle,
                    rows
                }
            ]
        };
    }

    async maybeSendAwaitingInputMenu(execution = null, node = null) {
        if (!this.sendFunction) return false;
        const payload = this.buildAwaitingInputMenuPayload(execution, node);
        if (!payload) return false;

        await this.sendFunction({
            leadId: execution?.lead?.id || null,
            to: execution?.lead?.phone || '',
            jid: execution?.lead?.jid || '',
            sessionId: execution?.conversation?.session_id || null,
            conversationId: execution?.conversation?.id || null,
            flowId: execution?.flow?.id || null,
            nodeId: node?.id || null,
            content: payload.content,
            mediaType: payload.mediaType,
            listButtonText: payload.listButtonText,
            listTitle: payload.listTitle,
            listFooter: payload.listFooter,
            listSections: payload.listSections
        });
        return true;
    }

    isIntentRoutingNode(node = null) {
        const nodeType = String(node?.type || '').trim().toLowerCase();
        if (nodeType === 'intent') return true;
        return this.isIntentTriggerNode(node);
    }

    isIntentMenuEnabled(node = null) {
        if (!this.isIntentRoutingNode(node)) return false;
        return this.normalizeFlowResponseMode(node?.data?.responseMode || 'text') === 'menu';
    }

    isIntentMenuEnabledForExecution(execution = null, node = null) {
        if (!this.isIntentMenuEnabled(node)) return false;
        const flow = execution?.flow;
        const explicitModeRaw = String(flow?.flow_builder_mode || flow?.flowBuilderMode || '').trim();
        if (explicitModeRaw) {
            return this.normalizeFlowBuilderMode(explicitModeRaw) === 'menu';
        }

        const hasFlowNodes = Array.isArray(flow?.nodes) && flow.nodes.length > 0;
        if (hasFlowNodes) {
            return this.inferFlowBuilderModeFromNodes(flow) === 'menu';
        }

        // Compatibilidade: quando o contexto nao traz metadados do fluxo,
        // usa o proprio no para decidir o modo.
        return true;
    }

    isIntentLinkButtonEnabled(node = null, execution = null) {
        if (!this.isIntentMenuEnabledForExecution(execution, node)) return false;
        return Boolean(this.resolveMenuButtonUrl(node, execution));
    }

    getIntentMenuOptions(flow = null, node = null) {
        if (!this.isIntentRoutingNode(node)) return [];

        const routes = this.resolveTriggerIntentRoutes(node);
        const routeHandleOrder = routes.map((route) => this.normalizeFlowHandle(route?.id || route?.label || ''));
        const routeHandleOrderMap = new Map(routeHandleOrder.map((handle, index) => [handle, index]));
        const outputEntryLabels = this.normalizeOutputEntryLabelsMap(node?.data?.outputEntryLabels || {});
        const outgoingEdges = (Array.isArray(flow?.edges) ? flow.edges : [])
            .filter((edge) => String(edge?.source || '').trim() === String(node?.id || '').trim());

        const handlesFromEdges = [];
        const handlesSeen = new Set();
        for (const edge of outgoingEdges) {
            const handle = this.normalizeFlowHandle(edge?.sourceHandle);
            if (handlesSeen.has(handle)) continue;
            handlesSeen.add(handle);
            handlesFromEdges.push(handle);
        }

        const hasDefaultFromEdges = handlesFromEdges.includes('default');
        const handles = handlesFromEdges.length > 0 ? handlesFromEdges : [];
        if (hasDefaultFromEdges && !handles.includes('default')) {
            handles.push('default');
        }

        const normalizedHandles = handles
            .map((handle) => this.normalizeFlowHandle(handle))
            .filter(Boolean);

        const sortedHandles = normalizedHandles.sort((a, b) => {
            if (a === 'default' && b !== 'default') return 1;
            if (b === 'default' && a !== 'default') return -1;
            const aOrder = routeHandleOrderMap.has(a) ? routeHandleOrderMap.get(a) : Number.MAX_SAFE_INTEGER;
            const bOrder = routeHandleOrderMap.has(b) ? routeHandleOrderMap.get(b) : Number.MAX_SAFE_INTEGER;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.localeCompare(b, 'pt-BR');
        });

        return sortedHandles.map((handle, index) => {
            const route = this.resolveTriggerIntentRouteByHandle(node, handle);
            const mappedLabel = sanitizeOutgoingFlowText(outputEntryLabels[handle] || '');
            const title = handle === 'default'
                ? (mappedLabel || 'Outra resposta')
                : (mappedLabel || sanitizeOutgoingFlowText(route?.label || '') || `Intencao ${index + 1}`);
            const responseDescription = handle === 'default'
                ? ''
                : sanitizeOutgoingFlowText(route?.response || '');
            const description = responseDescription.length > 60
                ? `${responseDescription.slice(0, 57)}...`
                : responseDescription;
            const aliases = [];
            if (handle === 'default') {
                aliases.push('default', 'padrao', 'outra resposta');
            } else {
                aliases.push(handle);
                if (route?.id) aliases.push(String(route.id));
                if (route?.label) aliases.push(String(route.label));
            }

            return {
                handle,
                rowId: `${FLOW_MENU_ROW_PREFIX}${handle}`,
                title,
                description,
                aliases: aliases
                    .map((alias) => normalizeIntentRouteHandle(alias))
                    .filter(Boolean)
            };
        });
    }

    resolveIntentMenuHandleFromInboundMessage(execution = null, node = null, message = {}, responseText = '') {
        const options = this.getIntentMenuOptions(execution?.flow, node);
        if (options.length === 0) return '';

        const optionByHandle = new Map();
        for (const option of options) {
            const handle = this.normalizeFlowHandle(option?.handle);
            optionByHandle.set(handle, option);
        }

        const candidates = [
            message?.selectionId,
            message?.selectedRowId,
            message?.optionId,
            message?.choiceId,
            message?.selectionText,
            responseText
        ];

        for (const candidateRaw of candidates) {
            const candidate = String(candidateRaw || '').trim();
            if (!candidate) continue;

            const candidateLower = candidate.toLowerCase();
            if (candidateLower.startsWith(FLOW_MENU_ROW_PREFIX)) {
                const rowHandle = this.normalizeFlowHandle(candidateLower.slice(FLOW_MENU_ROW_PREFIX.length));
                if (optionByHandle.has(rowHandle)) return rowHandle;
            }

            const directHandle = this.normalizeFlowHandle(candidate);
            if (optionByHandle.has(directHandle)) return directHandle;

            if (/^\d+$/.test(candidateLower)) {
                const index = Number.parseInt(candidateLower, 10);
                if (Number.isFinite(index) && index > 0 && index <= options.length) {
                    return this.normalizeFlowHandle(options[index - 1]?.handle);
                }
            }

            const normalizedCandidate = normalizeIntentRouteHandle(candidate);
            if (!normalizedCandidate) continue;
            const matchedOption = options.find((option) => {
                const aliases = Array.isArray(option?.aliases) ? option.aliases : [];
                return aliases.includes(normalizedCandidate);
            });
            if (matchedOption?.handle) {
                return this.normalizeFlowHandle(matchedOption.handle);
            }
        }

        return '';
    }

    buildIntentNodeMenuPayload(execution = null, node = null) {
        if (!this.isIntentMenuEnabledForExecution(execution, node)) return null;
        if (this.isIntentLinkButtonEnabled(node, execution)) return null;

        const options = this.getIntentMenuOptions(execution?.flow, node);
        if (options.length === 0) return null;

        const rows = options
            .slice(0, 10)
            .map((item) => ({
                rowId: item.rowId,
                title: item.title,
                description: item.description || undefined
            }));

        return {
            mediaType: 'list',
            content: this.buildInlineMenuPrompt(this.resolveMenuPrompt(node, execution), rows),
            listButtonText: this.resolveMenuButtonText(node, execution),
            listTitle: this.resolveMenuTitle(node, execution) || undefined,
            listFooter: this.resolveMenuFooter(node, execution) || undefined,
            listSections: [
                {
                    title: this.resolveMenuSectionTitle(node, execution),
                    rows
                }
            ]
        };
    }

    buildIntentNodeLinkPayload(execution = null, node = null) {
        if (!this.isIntentLinkButtonEnabled(node, execution)) return null;

        const buttonUrl = this.resolveMenuButtonUrl(node, execution);
        if (!buttonUrl) return null;

        return {
            mediaType: 'button_url',
            content: this.resolveMenuPrompt(node, execution),
            buttonText: this.resolveMenuButtonText(node, execution),
            buttonUrl,
            buttonTitle: this.resolveMenuTitle(node, execution) || undefined,
            buttonFooter: this.resolveMenuFooter(node, execution) || undefined
        };
    }

    async maybeSendIntentNodeMenu(execution = null, node = null) {
        if (!this.sendFunction) return false;
        const payload = this.buildIntentNodeMenuPayload(execution, node);
        if (!payload) return false;

        await this.sendFunction({
            leadId: execution?.lead?.id || null,
            to: execution?.lead?.phone || '',
            jid: execution?.lead?.jid || '',
            sessionId: execution?.conversation?.session_id || null,
            conversationId: execution?.conversation?.id || null,
            flowId: execution?.flow?.id || null,
            nodeId: node?.id || null,
            content: payload.content,
            mediaType: payload.mediaType,
            listButtonText: payload.listButtonText,
            listTitle: payload.listTitle,
            listFooter: payload.listFooter,
            listSections: payload.listSections
        });
        return true;
    }

    async maybeSendIntentNodeLinkButton(execution = null, node = null) {
        if (!this.sendFunction) return false;
        const payload = this.buildIntentNodeLinkPayload(execution, node);
        if (!payload) return false;

        await this.sendFunction({
            leadId: execution?.lead?.id || null,
            to: execution?.lead?.phone || '',
            jid: execution?.lead?.jid || '',
            sessionId: execution?.conversation?.session_id || null,
            conversationId: execution?.conversation?.id || null,
            flowId: execution?.flow?.id || null,
            nodeId: node?.id || null,
            content: payload.content,
            mediaType: payload.mediaType,
            buttonText: payload.buttonText,
            buttonUrl: payload.buttonUrl,
            buttonTitle: payload.buttonTitle,
            buttonFooter: payload.buttonFooter
        });
        return true;
    }

    normalizeFlowSessionScope(value = '') {
        const normalized = String(value ?? '').trim();
        return normalized || '';
    }

    flowMatchesConversationSession(flow, conversationOrSessionId = null) {
        const flowSessionId = this.normalizeFlowSessionScope(flow?.session_id);
        if (!flowSessionId) return true;

        const conversationSessionId = typeof conversationOrSessionId === 'string'
            ? this.normalizeFlowSessionScope(conversationOrSessionId)
            : this.normalizeFlowSessionScope(conversationOrSessionId?.session_id);

        if (!conversationSessionId) return false;
        return conversationSessionId === flowSessionId;
    }

    resolveFlowTriggerStartNode(flow = null) {
        const nodes = Array.isArray(flow?.nodes) ? flow.nodes : [];
        if (nodes.length === 0) return null;

        const startNodeId = this.resolveStartNodeId(flow);
        const startNode = nodes.find((item) => String(item?.id || '').trim() === String(startNodeId || '').trim());
        if (String(startNode?.type || '').trim().toLowerCase() === 'trigger') {
            return startNode;
        }

        return nodes.find((item) => String(item?.type || '').trim().toLowerCase() === 'trigger') || null;
    }

    hasInconsistentMenuMode(flow = null) {
        if (!flow) return false;
        const explicitModeRaw = String(flow?.flow_builder_mode || flow?.flowBuilderMode || '').trim();
        if (!explicitModeRaw) return false;
        if (this.normalizeFlowBuilderMode(explicitModeRaw) === 'menu') return false;

        const inferredMode = this.inferFlowBuilderModeFromNodes(flow);
        return inferredMode === 'menu';
    }

    hasDefaultEdgeToMessageOnce(flow = null, sourceNodeId = '') {
        const normalizedSourceId = String(sourceNodeId || '').trim();
        if (!normalizedSourceId) return false;

        const nodes = Array.isArray(flow?.nodes) ? flow.nodes : [];
        const nodeMap = new Map(nodes.map((item) => [String(item?.id || '').trim(), item]));
        const edges = Array.isArray(flow?.edges) ? flow.edges : [];

        return edges.some((edge) => {
            if (String(edge?.source || '').trim() !== normalizedSourceId) return false;
            if (this.normalizeFlowHandle(edge?.sourceHandle) !== 'default') return false;

            const targetNode = nodeMap.get(String(edge?.target || '').trim());
            return this.isOnceMessageNode(targetNode);
        });
    }

    hasDefaultOutgoingEdge(flow = null, sourceNodeId = '') {
        const normalizedSourceId = String(sourceNodeId || '').trim();
        if (!normalizedSourceId) return false;

        const edges = Array.isArray(flow?.edges) ? flow.edges : [];
        return edges.some((edge) => {
            if (String(edge?.source || '').trim() !== normalizedSourceId) return false;
            return this.normalizeFlowHandle(edge?.sourceHandle) === 'default';
        });
    }

    isKeywordFlowWithIntentDefaultOnceFallback(flow = null) {
        const triggerType = String(flow?.trigger_type || '').trim().toLowerCase();
        if (triggerType !== 'keyword') return false;

        const triggerNode = this.resolveFlowTriggerStartNode(flow);
        const nodeSubtype = String(triggerNode?.subtype || '').trim().toLowerCase();
        if (!triggerNode || (nodeSubtype !== 'keyword' && nodeSubtype !== 'intent')) {
            return false;
        }

        return this.hasDefaultEdgeToMessageOnce(flow, triggerNode.id);
    }

    pickKeywordFlowByDefaultRouteFallback(candidateFlows = []) {
        const eligible = (Array.isArray(candidateFlows) ? candidateFlows : [])
            .filter((item) => this.isKeywordFlowWithIntentDefaultOnceFallback(item));

        if (eligible.length === 0) return null;
        if (eligible.length === 1) return eligible[0];

        const highestPriority = Math.max(...eligible.map((item) => Number(item?.priority || 0)));
        const topPriorityFlows = eligible.filter((item) => Number(item?.priority || 0) === highestPriority);
        if (topPriorityFlows.length === 1) return topPriorityFlows[0];

        return null;
    }

    pickScopedFlowByPriority(candidateFlows = [], conversationSessionId = '') {
        const eligible = Array.isArray(candidateFlows) ? candidateFlows.filter(Boolean) : [];
        if (eligible.length === 0) return null;
        if (eligible.length === 1) return eligible[0];

        const normalizedConversationSessionId = this.normalizeFlowSessionScope(conversationSessionId);
        const sessionScoped = eligible.filter((item) => {
            const flowSessionId = this.normalizeFlowSessionScope(item?.session_id);
            return Boolean(flowSessionId) && flowSessionId === normalizedConversationSessionId;
        });

        const pool = sessionScoped.length > 0 ? sessionScoped : eligible;
        if (pool.length === 1) return pool[0];

        const highestPriority = Math.max(...pool.map((item) => Number(item?.priority || 0)));
        const topPriorityFlows = pool.filter((item) => Number(item?.priority || 0) === highestPriority);
        if (topPriorityFlows.length === 1) return topPriorityFlows[0];

        // Em empate de prioridade, seleciona de forma deterministica para
        // evitar que o fluxo deixe de iniciar por ambiguidade.
        return [...topPriorityFlows].sort((a, b) => {
            const idA = Number(a?.id || 0);
            const idB = Number(b?.id || 0);
            if (Number.isFinite(idA) && Number.isFinite(idB) && idA !== idB) {
                return idA - idB;
            }
            const nameA = String(a?.name || '');
            const nameB = String(b?.name || '');
            return nameA.localeCompare(nameB, 'pt-BR');
        })[0] || null;
    }

    isKeywordFlowWithIntentTriggerFirstMessageMenu(flow = null) {
        const triggerType = String(flow?.trigger_type || '').trim().toLowerCase();
        if (triggerType !== 'keyword') return false;
        if (!this.isMenuFlowBuilderMode(flow)) return false;

        const triggerNode = this.resolveFlowTriggerStartNode(flow);
        if (!this.isIntentTriggerNode(triggerNode)) {
            return false;
        }

        return this.isIntentMenuEnabled(triggerNode);
    }

    pickKeywordFlowByIntentTriggerFirstMessageMenu(candidateFlows = [], conversationSessionId = '') {
        const eligible = (Array.isArray(candidateFlows) ? candidateFlows : [])
            .filter((item) => this.isKeywordFlowWithIntentTriggerFirstMessageMenu(item));

        return this.pickScopedFlowByPriority(eligible, conversationSessionId);
    }

    isKeywordFlowWithIntentTriggerCatchAllFallback(flow = null) {
        const triggerType = String(flow?.trigger_type || '').trim().toLowerCase();
        if (triggerType !== 'keyword') return false;

        const triggerNode = this.resolveFlowTriggerStartNode(flow);
        if (!this.isIntentTriggerNode(triggerNode)) {
            return false;
        }

        if (!this.hasDefaultOutgoingEdge(flow, triggerNode.id)) {
            return false;
        }

        const defaultResponse = String(triggerNode?.data?.intentDefaultResponse || '').trim();
        const defaultFollowups = parseIntentResponseList(
            triggerNode?.data?.intentDefaultFollowupResponses,
            triggerNode?.data?.intentDefaultFollowupResponse
        );
        const hasDefaultResponse = Boolean(defaultResponse) || defaultFollowups.length > 0;

        const welcomeConfig = this.resolveTriggerWelcomeConfig(triggerNode);
        const hasWelcomeMessage = Boolean(welcomeConfig?.enabled && String(welcomeConfig?.content || '').trim());

        return hasDefaultResponse || hasWelcomeMessage;
    }

    pickKeywordFlowByIntentTriggerCatchAllFallback(candidateFlows = [], conversationSessionId = '') {
        const eligible = (Array.isArray(candidateFlows) ? candidateFlows : [])
            .filter((item) => this.isKeywordFlowWithIntentTriggerCatchAllFallback(item));
        return this.pickScopedFlowByPriority(eligible, conversationSessionId);
    }

    readNodeEntryHandleMap(execution) {
        const variables = this.ensureExecutionVariables(execution);
        const mapValue = variables[NODE_ENTRY_HANDLE_MAP_KEY];
        if (!mapValue || typeof mapValue !== 'object' || Array.isArray(mapValue)) {
            return {};
        }
        return { ...mapValue };
    }

    getNodeEntryHandle(execution, nodeId = '') {
        const normalizedNodeId = String(nodeId || '').trim();
        if (!normalizedNodeId) return 'default';

        const map = this.readNodeEntryHandleMap(execution);
        return this.normalizeFlowHandle(map[normalizedNodeId]);
    }

    setNodeEntryHandle(execution, nodeId = '', handle = 'default') {
        const normalizedNodeId = String(nodeId || '').trim();
        if (!normalizedNodeId) return;

        const variables = this.ensureExecutionVariables(execution);
        const map = this.readNodeEntryHandleMap(execution);
        map[normalizedNodeId] = this.normalizeFlowHandle(handle);
        variables[NODE_ENTRY_HANDLE_MAP_KEY] = map;
        variables.last_node_entry_handle = map[normalizedNodeId];
    }

    readIntentDefaultMessageOnceReentry(execution) {
        const variables = this.ensureExecutionVariables(execution);
        const value = variables[INTENT_DEFAULT_MESSAGE_ONCE_REENTRY_KEY];
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }

        const triggerNodeId = String(value?.triggerNodeId || '').trim();
        const messageOnceNodeId = String(value?.messageOnceNodeId || '').trim();
        const targetHandle = this.normalizeFlowHandle(value?.targetHandle);
        if (!triggerNodeId || !messageOnceNodeId) {
            return null;
        }

        return {
            triggerNodeId,
            messageOnceNodeId,
            targetHandle,
            fallbackReady: Boolean(value?.fallbackReady)
        };
    }

    setIntentDefaultMessageOnceReentry(execution, payload = {}) {
        const triggerNodeId = String(payload?.triggerNodeId || '').trim();
        const messageOnceNodeId = String(payload?.messageOnceNodeId || '').trim();
        if (!triggerNodeId || !messageOnceNodeId) {
            this.clearIntentDefaultMessageOnceReentry(execution);
            return null;
        }

        const normalized = {
            triggerNodeId,
            messageOnceNodeId,
            targetHandle: this.normalizeFlowHandle(payload?.targetHandle),
            fallbackReady: Boolean(payload?.fallbackReady)
        };

        const variables = this.ensureExecutionVariables(execution);
        variables[INTENT_DEFAULT_MESSAGE_ONCE_REENTRY_KEY] = normalized;
        return normalized;
    }

    clearIntentDefaultMessageOnceReentry(execution) {
        const variables = this.ensureExecutionVariables(execution);
        delete variables[INTENT_DEFAULT_MESSAGE_ONCE_REENTRY_KEY];
    }

    resolveIntentDefaultMessageOnceReentryForNode(execution, node = null) {
        const context = this.readIntentDefaultMessageOnceReentry(execution);
        if (!context) return null;

        const nodeId = String(node?.id || '').trim();
        if (!nodeId || context.messageOnceNodeId !== nodeId) {
            return null;
        }

        return context;
    }

    resolveIntentDefaultMessageOnceFallbackForTrigger(execution, node = null) {
        const context = this.readIntentDefaultMessageOnceReentry(execution);
        if (!context || !context.fallbackReady) return null;

        const triggerNodeId = String(node?.id || '').trim();
        if (!triggerNodeId || context.triggerNodeId !== triggerNodeId) {
            return null;
        }

        const messageOnceNode = this.findNode(execution?.flow, context.messageOnceNodeId);
        if (!this.isOnceMessageNode(messageOnceNode)) {
            return null;
        }

        return {
            ...context,
            messageOnceNode
        };
    }

    isIntentTriggerNode(node = null) {
        const nodeType = String(node?.type || '').trim().toLowerCase();
        const subtype = String(node?.subtype || '').trim().toLowerCase();
        return nodeType === 'trigger' && (subtype === 'keyword' || subtype === 'intent');
    }

    isOnceMessageNode(node = null) {
        const nodeType = String(node?.type || '').trim().toLowerCase();
        if (nodeType === 'message_once') return true;
        if (nodeType !== 'message') return false;
        return Boolean(node?.data?.isOnceMessage);
    }

    isIntentDefaultToMessageOnceBridge(flow, currentNode, edge) {
        if (!this.isIntentTriggerNode(currentNode)) {
            return false;
        }
        if (this.normalizeFlowHandle(edge?.sourceHandle) !== 'default') {
            return false;
        }

        const targetNode = this.findNode(flow, edge?.target);
        return this.isOnceMessageNode(targetNode);
    }

    resolveIntentContextWindowSize() {
        return Math.trunc(
            readIntentNumberEnv('FLOW_INTENT_CONTEXT_WINDOW_MESSAGES', 4, 1, 8)
        );
    }

    resolveIntentDefaultMinAttempts(node = null) {
        const nodeSpecific = Number(node?.data?.defaultAfterAttempts);
        if (Number.isFinite(nodeSpecific) && nodeSpecific > 0) {
            return Math.max(1, Math.min(6, Math.trunc(nodeSpecific)));
        }

        if (this.isIntentTriggerNode(node)) {
            return Math.trunc(
                readIntentNumberEnv('FLOW_INTENT_TRIGGER_DEFAULT_AFTER_ATTEMPTS', 2, 1, 6)
            );
        }

        const nodeType = String(node?.type || '').trim().toLowerCase();
        if (nodeType !== 'intent') {
            return 1;
        }

        return Math.trunc(
            readIntentNumberEnv('FLOW_INTENT_NODE_DEFAULT_AFTER_ATTEMPTS', 2, 1, 6)
        );
    }

    readIntentHistoryMap(execution) {
        const variables = this.ensureExecutionVariables(execution);
        const mapValue = variables[INTENT_CONTEXT_HISTORY_KEY];
        if (!mapValue || typeof mapValue !== 'object' || Array.isArray(mapValue)) {
            return {};
        }
        return { ...mapValue };
    }

    readIntentHistory(execution, nodeId = '') {
        const normalizedNodeId = String(nodeId || '').trim();
        if (!normalizedNodeId) return [];

        const map = this.readIntentHistoryMap(execution);
        const value = map[normalizedNodeId];
        if (!Array.isArray(value)) return [];

        return value
            .map((item) => String(item || '').trim())
            .filter(Boolean);
    }

    appendIntentHistory(execution, nodeId = '', messageText = '') {
        const normalizedNodeId = String(nodeId || '').trim();
        const normalizedMessage = String(messageText || '').trim();
        if (!normalizedNodeId || !normalizedMessage) {
            return this.readIntentHistory(execution, normalizedNodeId);
        }

        const variables = this.ensureExecutionVariables(execution);
        const map = this.readIntentHistoryMap(execution);
        const history = this.readIntentHistory(execution, normalizedNodeId);
        const lastEntry = history[history.length - 1] || '';

        if (normalizeIntentText(lastEntry) !== normalizeIntentText(normalizedMessage)) {
            history.push(normalizedMessage);
        }

        const maxSize = this.resolveIntentContextWindowSize();
        map[normalizedNodeId] = history.slice(-maxSize);
        variables[INTENT_CONTEXT_HISTORY_KEY] = map;
        return map[normalizedNodeId];
    }

    clearIntentHistory(execution, nodeId = '') {
        const normalizedNodeId = String(nodeId || '').trim();
        if (!normalizedNodeId) return;

        const variables = this.ensureExecutionVariables(execution);
        const map = this.readIntentHistoryMap(execution);
        if (!Object.prototype.hasOwnProperty.call(map, normalizedNodeId)) {
            return;
        }

        delete map[normalizedNodeId];
        if (Object.keys(map).length === 0) {
            delete variables[INTENT_CONTEXT_HISTORY_KEY];
            return;
        }

        variables[INTENT_CONTEXT_HISTORY_KEY] = map;
    }

    resolveIntentInputText(execution, node, incomingMessageText = '') {
        const nodeId = String(node?.id || '').trim();
        const history = this.appendIntentHistory(execution, nodeId, incomingMessageText);
        const mergedText = history.join('\n').trim();

        const variables = this.ensureExecutionVariables(execution);
        variables.intent_context_text = mergedText;

        return mergedText || String(incomingMessageText || '').trim();
    }

    readIntentNoMatchCounters(execution) {
        const variables = this.ensureExecutionVariables(execution);
        const value = variables[INTENT_NO_MATCH_COUNTERS_KEY];
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {};
        }
        return { ...value };
    }

    incrementIntentNoMatchCounter(execution, nodeId = '') {
        const normalizedNodeId = String(nodeId || '').trim();
        if (!normalizedNodeId) return 1;

        const variables = this.ensureExecutionVariables(execution);
        const counters = this.readIntentNoMatchCounters(execution);
        const current = Number(counters[normalizedNodeId] || 0);
        const next = Number.isFinite(current) && current > 0
            ? Math.trunc(current) + 1
            : 1;

        counters[normalizedNodeId] = next;
        variables[INTENT_NO_MATCH_COUNTERS_KEY] = counters;
        variables.intent_no_match_count = next;
        return next;
    }

    clearIntentNoMatchCounter(execution, nodeId = '') {
        const normalizedNodeId = String(nodeId || '').trim();
        if (!normalizedNodeId) return;

        const variables = this.ensureExecutionVariables(execution);
        const counters = this.readIntentNoMatchCounters(execution);
        if (Object.prototype.hasOwnProperty.call(counters, normalizedNodeId)) {
            delete counters[normalizedNodeId];
        }

        if (Object.keys(counters).length === 0) {
            delete variables[INTENT_NO_MATCH_COUNTERS_KEY];
        } else {
            variables[INTENT_NO_MATCH_COUNTERS_KEY] = counters;
        }
        delete variables.intent_no_match_count;
    }

    resolvePendingIncomingQueueLimit() {
        return Math.trunc(
            readIntentNumberEnv('FLOW_PENDING_INPUT_QUEUE_LIMIT', 6, 1, 20)
        );
    }

    readPendingIncomingMessages(execution) {
        const variables = this.ensureExecutionVariables(execution);
        const value = variables[PENDING_INCOMING_MESSAGES_KEY];
        if (!Array.isArray(value)) return [];

        return value
            .map((entry) => {
                const text = String(entry?.text || '').trim();
                const selectionId = String(entry?.selectionId || '').trim();
                const selectionText = String(entry?.selectionText || '').trim();
                if (!text && !selectionId && !selectionText) return null;
                return {
                    text,
                    selectionId,
                    selectionText,
                    mediaType: String(entry?.mediaType || 'text').trim().toLowerCase() || 'text',
                    receivedAt: String(entry?.receivedAt || '').trim() || new Date().toISOString()
                };
            })
            .filter(Boolean);
    }

    enqueuePendingIncomingMessage(execution, message = {}) {
        const text = String(message?.text || '').trim();
        const selectionId = String(message?.selectionId || '').trim();
        const selectionText = String(message?.selectionText || '').trim();
        if (!text && !selectionId && !selectionText) return 0;

        const variables = this.ensureExecutionVariables(execution);
        const queue = this.readPendingIncomingMessages(execution);
        const normalizedText = normalizeIntentText(text || selectionText || selectionId);
        const lastEntry = queue[queue.length - 1] || null;
        const lastText = normalizeIntentText(lastEntry?.text || lastEntry?.selectionText || lastEntry?.selectionId || '');
        if (normalizedText && normalizedText === lastText) {
            return queue.length;
        }

        queue.push({
            text,
            selectionId,
            selectionText,
            mediaType: String(message?.mediaType || 'text').trim().toLowerCase() || 'text',
            receivedAt: new Date().toISOString()
        });

        const maxQueueSize = this.resolvePendingIncomingQueueLimit();
        const boundedQueue = queue.slice(-maxQueueSize);
        variables[PENDING_INCOMING_MESSAGES_KEY] = boundedQueue;
        return boundedQueue.length;
    }

    dequeuePendingIncomingMessage(execution) {
        const variables = this.ensureExecutionVariables(execution);
        const queue = this.readPendingIncomingMessages(execution);
        if (queue.length === 0) return null;

        const [nextMessage, ...remaining] = queue;
        if (remaining.length === 0) {
            delete variables[PENDING_INCOMING_MESSAGES_KEY];
        } else {
            variables[PENDING_INCOMING_MESSAGES_KEY] = remaining;
        }

        return nextMessage;
    }

    isNodeAwaitingInput(node = null) {
        const nodeType = String(node?.type || '').trim().toLowerCase();
        const nodeSubtype = String(node?.subtype || '').trim().toLowerCase();

        if (nodeType === 'wait' || nodeType === 'condition' || nodeType === 'intent') {
            return true;
        }

        if (nodeType === 'end') {
            return true;
        }

        if (nodeType === 'trigger' && (nodeSubtype === 'keyword' || nodeSubtype === 'intent')) {
            return true;
        }

        return false;
    }

    async drainPendingIncomingMessages(execution) {
        let guard = 0;
        while (guard < 8) {
            guard += 1;

            const currentNode = this.findNode(execution?.flow, execution?.currentNode);
            if (!this.isNodeAwaitingInput(currentNode)) break;

            const queuedMessage = this.dequeuePendingIncomingMessage(execution);
            if (!queuedMessage) break;

            await this.persistExecutionVariables(execution);
            await this.continueFlow(execution, queuedMessage);
        }
    }

    async persistExecutionVariables(execution) {
        await run(`
            UPDATE flow_executions
            SET variables = ?
            WHERE id = ?
        `, [JSON.stringify(execution.variables), execution.id]);
    }

    resolveOnceMessageNodeKey(execution, node) {
        const explicitKey = String(node?.data?.onceKey || '').trim();
        if (explicitKey) {
            return explicitKey.slice(0, 180);
        }

        const nodeId = String(node?.id || '').trim();
        if (!nodeId) return '';

        const flowId = Number(execution?.flow?.id || 0);
        if (Number.isInteger(flowId) && flowId > 0) {
            return `flow:${flowId}:node:${nodeId}`;
        }

        return `node:${nodeId}`;
    }

    resolveOnceMessageRepeatConfig(node = null) {
        const modeRaw = String(node?.data?.onceRepeatMode || 'always').trim().toLowerCase();
        const mode = ['always', 'hours', 'days'].includes(modeRaw)
            ? modeRaw
            : 'always';

        const rawValue = Number(node?.data?.onceRepeatValue);
        const value = Number.isFinite(rawValue) && rawValue > 0
            ? Math.max(1, Math.trunc(rawValue))
            : 1;

        return { mode, value };
    }

    resolveOnceMessageCooldownMs(node = null) {
        const config = this.resolveOnceMessageRepeatConfig(node);
        if (config.mode === 'hours') {
            return config.value * 60 * 60 * 1000;
        }
        if (config.mode === 'days') {
            return config.value * 24 * 60 * 60 * 1000;
        }
        return Number.POSITIVE_INFINITY;
    }

    readLeadOnceMessageMap(lead) {
        const customFields = parseLeadCustomFields(lead?.custom_fields);
        const systemMetadata = normalizeSystemMetadataObject(customFields.__system);
        return normalizeFlowOnceMessageMap(systemMetadata[LEAD_ONCE_MESSAGE_FLAG_KEY]);
    }

    hasLeadSeenOnceMessageNode(execution, node) {
        const onceKey = this.resolveOnceMessageNodeKey(execution, node);
        if (!onceKey) return false;
        const onceMap = this.readLeadOnceMessageMap(execution?.lead);
        const seenAtRaw = String(onceMap[onceKey] || '').trim();
        if (!seenAtRaw) return false;

        const repeatConfig = this.resolveOnceMessageRepeatConfig(node);
        if (repeatConfig.mode === 'always') {
            return true;
        }

        const seenAtTime = new Date(seenAtRaw).getTime();
        if (!Number.isFinite(seenAtTime) || seenAtTime <= 0) {
            return true;
        }

        const cooldownMs = this.resolveOnceMessageCooldownMs(node);
        const elapsedMs = Date.now() - seenAtTime;
        return elapsedMs < cooldownMs;
    }

    async markLeadOnceMessageNodeSeen(execution, node) {
        const onceKey = this.resolveOnceMessageNodeKey(execution, node);
        if (!onceKey || !execution?.lead?.id) return false;

        const customFields = parseLeadCustomFields(execution.lead.custom_fields);
        const systemMetadata = normalizeSystemMetadataObject(customFields.__system);
        const onceMap = normalizeFlowOnceMessageMap(systemMetadata[LEAD_ONCE_MESSAGE_FLAG_KEY]);
        const nowIso = new Date().toISOString();
        onceMap[onceKey] = nowIso;
        customFields.__system = {
            ...systemMetadata,
            [LEAD_ONCE_MESSAGE_FLAG_KEY]: onceMap
        };

        await Lead.update(execution.lead.id, { custom_fields: customFields });
        execution.lead.custom_fields = JSON.stringify(customFields);
        this.ensureExecutionVariables(execution).last_once_message_key = onceKey;
        this.ensureExecutionVariables(execution).last_once_message_seen_at = nowIso;
        return true;
    }
    
    /**
     * Processar mensagem recebida e verificar triggers
     */
    async processIncomingMessage(message, lead, conversation) {
        return this.runConversationSerialized(
            conversation?.id,
            () => this.processIncomingMessageInternal(message, lead, conversation)
        );
    }

    async processIncomingMessageInternal(message, lead, conversation) {
        // Verificar se bot está ativo para esta conversa
        if (conversation && !conversation.is_bot_active) {
            return null;
        }
        
        // Verificar se já há um fluxo em execução
        const activeExecution = await this.resolveActiveExecution(conversation, lead);
        if (activeExecution) {
            try {
                return await this.continueFlow(activeExecution, message);
            } catch (error) {
                const details = String(error?.message || error || 'Erro ao continuar fluxo');
                console.error(
                    `[flow] Falha ao continuar fluxo ${activeExecution?.flow?.id || 'n/a'} `
                    + `na conversa ${activeExecution?.conversation?.id || 'n/a'}: ${details}`
                );
                await this.endFlow(activeExecution, 'failed', details);
                return null;
            }
        }
        
        // Procurar fluxo por palavra-chave
        const text = message.text?.trim() || '';
        let flow = null;
        let suppressKeywordFallback = false;
        const conversationSessionId = this.normalizeFlowSessionScope(conversation?.session_id);
        const ownerScopeUserId = await resolveOwnerScopeUserIdFromAssignee(
            conversation?.assigned_to,
            lead?.assigned_to,
            lead?.owner_user_id
        );
        const flowScopeOptions = ownerScopeUserId
            ? { owner_user_id: ownerScopeUserId, session_id: conversationSessionId || undefined }
            : { session_id: conversationSessionId || undefined };
        let activeKeywordFlowsCache = null;
        const loadActiveKeywordFlows = async () => {
            if (activeKeywordFlowsCache !== null) {
                return activeKeywordFlowsCache;
            }

            const scopedFlows = (await Flow.findActiveKeywordFlows(flowScopeOptions))
                .filter((item) => this.flowMatchesConversationSession(item, conversationSessionId));

            const inconsistentFlows = scopedFlows.filter((item) => this.hasInconsistentMenuMode(item));
            if (inconsistentFlows.length > 0) {
                console.warn(
                    `[flow-intent] Ignorando ${inconsistentFlows.length} fluxo(s) com modo inconsistente `
                    + `(humanized + no de menu): ${inconsistentFlows.map((item) => item?.id).join(', ')}`
                );
            }

            activeKeywordFlowsCache = scopedFlows.filter((item) => !this.hasInconsistentMenuMode(item));

            return activeKeywordFlowsCache;
        };

        if (conversation?.created) {
            const activeKeywordFlows = await loadActiveKeywordFlows();
            const firstMessageMenuFlow = this.pickKeywordFlowByIntentTriggerFirstMessageMenu(
                activeKeywordFlows,
                conversationSessionId
            );

            if (firstMessageMenuFlow) {
                flow = firstMessageMenuFlow;
                console.info(
                    `[flow-intent] Fluxo menu selecionado na primeira mensagem ${flow.id} `
                    + `(${flow.name || 'sem-nome'}).`
                );
            }
        }

        if (!flow && text) {
            const strictIntentRouting = isStrictFlowIntentRoutingEnabled() && isFlowIntentClassifierConfigured();
            const keywordMatches = (await Flow.findKeywordMatches(text, flowScopeOptions))
                .filter((item) => this.flowMatchesConversationSession(item, conversationSessionId));
            const semanticCandidates = await loadActiveKeywordFlows();
            const hasExactKeywordMatch = keywordMatches.length > 0;

            if (semanticCandidates.length > 0) {
                const intentDecision = await classifyKeywordFlowIntent(text, semanticCandidates);
                if (intentDecision?.status === 'selected' && intentDecision.flowId) {
                    flow = semanticCandidates.find((item) => Number(item.id) === Number(intentDecision.flowId)) || null;
                } else if (intentDecision?.status === 'no_match' && !hasExactKeywordMatch) {
                    suppressKeywordFallback = true;
                } else if (strictIntentRouting && !hasExactKeywordMatch) {
                    suppressKeywordFallback = true;
                }
            }

            // Match direto por keyword nunca deve ser suprimido pelo classificador.
            if (!flow && keywordMatches.length > 0) {
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

            if (!flow && semanticCandidates.length > 0) {
                // Permite iniciar pelo "Outra resposta" quando o gatilho de intencao
                // direciona o default para um bloco de Mensagem Unica.
                const defaultFallbackFlow = this.pickKeywordFlowByDefaultRouteFallback(semanticCandidates);
                if (defaultFallbackFlow) {
                    flow = defaultFallbackFlow;
                    console.info(
                        `[flow-intent] Fallback por rota padrao selecionou fluxo ${flow.id} `
                        + `(${flow.name || 'sem-nome'}) para mensagem sem match explicito.`
                    );
                }
            }

            if (!flow && semanticCandidates.length > 0) {
                // Se houver apenas um fluxo de intencao elegivel para fallback no escopo da sessao,
                // inicia pelo gatilho para permitir boas-vindas + rota default ("nao entendi").
                const catchAllFallbackFlow = this.pickKeywordFlowByIntentTriggerCatchAllFallback(
                    semanticCandidates,
                    conversationSessionId
                );
                if (catchAllFallbackFlow) {
                    flow = catchAllFallbackFlow;
                    console.info(
                        `[flow-intent] Fallback catch-all selecionou fluxo ${flow.id} `
                        + `(${flow.name || 'sem-nome'}) para mensagem sem match explicito.`
                    );
                }
            }
        }
        
        // Se não encontrou por keyword, tenta fallback para menu interativo
        // mesmo em conversas já existentes (sem execução ativa).
        if (!flow) {
            const activeKeywordFlows = await loadActiveKeywordFlows();
            const menuFallbackFlow = this.pickKeywordFlowByIntentTriggerFirstMessageMenu(
                activeKeywordFlows,
                conversationSessionId
            );

            if (menuFallbackFlow) {
                flow = menuFallbackFlow;
                console.info(
                    `[flow-intent] Fallback de menu selecionou fluxo ${flow.id} `
                    + `(${flow.name || 'sem-nome'}) para conversa sem execucao ativa.`
                );
            }
        }

        if (!flow && conversation?.created) {
            flow = await Flow.findByTrigger('new_contact', null, flowScopeOptions);
            if (flow && !this.flowMatchesConversationSession(flow, conversationSessionId)) {
                flow = null;
            }
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
        const incomingText = String(message?.text || '').trim();
        const selectionText = String(message?.selectionText || '').trim();
        const selectionId = String(message?.selectionId || '').trim();
        const messageText = incomingText || selectionText || selectionId;

        if (!currentNode) {
            await this.endFlow(execution, 'completed');
            return null;
        }

        const currentSubtype = String(currentNode?.subtype || '').trim().toLowerCase();
        const isIntentNode = currentNode.type === 'intent'
            || (currentNode.type === 'trigger' && (currentSubtype === 'keyword' || currentSubtype === 'intent'));

        if (isIntentNode) {
            await this.maybeSendTriggerWelcomeMessage(execution, currentNode);
            this.ensureExecutionVariables(execution).last_response = messageText;
            const intentMenuEnabled = this.isIntentMenuEnabledForExecution(execution, currentNode);
            let selectedHandle = intentMenuEnabled
                ? this.resolveIntentMenuHandleFromInboundMessage(execution, currentNode, message, messageText)
                : '';
            const intentInputText = this.resolveIntentInputText(execution, currentNode, messageText);
            if (!selectedHandle) {
                selectedHandle = await this.pickTriggerIntentHandle(execution, currentNode, intentInputText);
                const normalizedIntentContext = normalizeIntentText(intentInputText);
                const normalizedLatestMessage = normalizeIntentText(messageText);
                if (
                    !selectedHandle
                    && normalizedLatestMessage
                    && normalizedIntentContext
                    && normalizedLatestMessage !== normalizedIntentContext
                ) {
                    // O contexto historico ajuda em muitos casos, mas pode diluir respostas curtas
                    // como "Gostei". Sem match no contexto, tentamos a ultima mensagem isolada.
                    selectedHandle = await this.pickTriggerIntentHandle(execution, currentNode, messageText);
                }
            }

            if (selectedHandle) {
                this.clearIntentNoMatchCounter(execution, currentNode.id);
                this.clearIntentHistory(execution, currentNode.id);
                this.clearIntentDefaultMessageOnceReentry(execution);
            } else {
                const readyFallback = this.resolveIntentDefaultMessageOnceFallbackForTrigger(execution, currentNode);
                if (readyFallback) {
                    this.clearIntentNoMatchCounter(execution, currentNode.id);
                    this.clearIntentHistory(execution, currentNode.id);
                    this.clearIntentDefaultMessageOnceReentry(execution);
                    this.setNodeEntryHandle(
                        execution,
                        readyFallback.messageOnceNode.id,
                        readyFallback.targetHandle
                    );
                    await this.goToNextNode(execution, readyFallback.messageOnceNode);
                    return execution;
                }

                const outgoingEdges = (execution.flow?.edges || []).filter((edge) => edge.source === currentNode.id);
                const hasDefaultRoute = outgoingEdges.some((edge) => {
                    const handle = String(edge?.sourceHandle || '').trim().toLowerCase();
                    return !handle || handle === 'default';
                });
                const hasSpecificRoutes = outgoingEdges.some((edge) => {
                    const handle = String(edge?.sourceHandle || '').trim().toLowerCase();
                    return Boolean(handle) && handle !== 'default';
                });
                const noMatchCount = this.incrementIntentNoMatchCounter(execution, currentNode.id);
                const minAttemptsBeforeDefault = this.resolveIntentDefaultMinAttempts(currentNode);
                const shouldWaitForMoreInput = hasSpecificRoutes
                    && (!hasDefaultRoute || noMatchCount < minAttemptsBeforeDefault);
                const normalizedMessageText = normalizeIntentText(messageText);
                const normalizedTriggerMessage = normalizeIntentText(
                    execution?.triggerMessageText
                    || execution?.variables?.trigger_message
                    || ''
                );
                const isInitialTriggerReplay = Boolean(
                    noMatchCount === 1
                    && normalizedMessageText
                    && normalizedTriggerMessage
                    && normalizedMessageText === normalizedTriggerMessage
                );

                // Sem match: mantem aguardando novas mensagens antes de cair no padrao.
                if (shouldWaitForMoreInput) {
                    if (intentMenuEnabled && !isInitialTriggerReplay) {
                        await this.maybeSendIntentNodeMenu(execution, currentNode);
                    }
                    await this.persistExecutionVariables(execution);

                    console.info(
                        `[flow-intent] Nenhuma rota correspondeu no no ${currentNode?.id || 'desconhecido'} `
                        + `(fluxo ${execution?.flow?.id || 'n/a'}, conversa ${execution?.conversation?.id || 'n/a'}). `
                        + `Tentativa ${noMatchCount}/${hasDefaultRoute ? minAttemptsBeforeDefault : 'sem-limite'}; `
                        + 'execucao mantida aguardando nova resposta.'
                    );
                    return execution;
                }

                this.clearIntentNoMatchCounter(execution, currentNode.id);
                this.clearIntentHistory(execution, currentNode.id);
            }

            await this.goToNextNode(execution, currentNode, selectedHandle);
            return execution;
        }

        if (currentNode.type === 'wait' || currentNode.type === 'condition') {
            execution.variables.last_response = messageText;

            const currentEntryHandle = this.getNodeEntryHandle(execution, currentNode.id);
            const nextEdge = this.evaluateConditionEdge(
                execution.flow,
                currentNode,
                messageText,
                currentEntryHandle,
                message
            );
            const nextNodeId = nextEdge?.target || null;
            const nextTargetHandle = this.normalizeFlowHandle(nextEdge?.targetHandle);
            const nextSourceHandle = this.normalizeFlowHandle(nextEdge?.sourceHandle);

            if (nextNodeId) {
                await this.executeOutputActions(execution, currentNode, nextSourceHandle);
                await this.executeNode(execution, nextNodeId, nextTargetHandle);
            } else {
                if (this.isAwaitingInputMenuEnabled(currentNode)) {
                    await this.persistExecutionVariables(execution);
                    return execution;
                }
                await this.endFlow(execution, 'completed');
            }

            return execution;
        }

        if (currentNode.type === 'end') {
            execution.variables.last_response = messageText;
            const endSelection = this.resolveEndNodeSelectionFromInboundMessage(
                execution,
                currentNode,
                message,
                messageText
            );

            if (!endSelection) {
                if (this.hasEndNodeRouteOptions(execution, currentNode)) {
                    await this.maybeSendEndNodeMenu(execution, currentNode);
                    await this.persistExecutionVariables(execution);
                } else {
                    await this.maybeSendEndNodeFinalMessage(execution, currentNode);
                    await this.endFlow(execution, 'completed');
                }
                return execution;
            }

            if (endSelection.action === 'finalize') {
                await this.maybeSendEndNodeFinalMessage(execution, currentNode);
                await this.endFlow(execution, 'completed');
                return execution;
            }

            this.setNodeEntryHandle(execution, currentNode.id, endSelection.handle);
            await this.goToNextNode(execution, currentNode);
            return execution;
        }

        const queuedCount = this.enqueuePendingIncomingMessage(execution, message);
        if (queuedCount > 0) {
            await this.persistExecutionVariables(execution);
            console.info(
                `[flow-intent] Mensagem recebida antes de um no de entrada ` +
                `(fluxo ${execution?.flow?.id || 'n/a'}, conversa ${execution?.conversation?.id || 'n/a'}, ` +
                `no ${currentNode?.id || 'desconhecido'}). Fila pendente: ${queuedCount}.`
            );
        }

        return execution;
    }
    
    /**
     * Executar um nó do fluxo
     */
    async executeNode(execution, nodeId, incomingTargetHandle = null) {
        const node = this.findNode(execution.flow, nodeId);
        
        if (!node) {
            await this.endFlow(execution, 'completed');
            return;
        }

        if (incomingTargetHandle !== null && incomingTargetHandle !== undefined) {
            this.setNodeEntryHandle(execution, nodeId, incomingTargetHandle);
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
                case 'message_once': {
                    const isOnceMessage = this.isOnceMessageNode(node);
                    const onceReentryContext = isOnceMessage
                        ? this.resolveIntentDefaultMessageOnceReentryForNode(execution, node)
                        : null;
                    const alreadySent = isOnceMessage && this.hasLeadSeenOnceMessageNode(execution, node);
                    if (alreadySent) {
                        if (onceReentryContext) {
                            this.setIntentDefaultMessageOnceReentry(execution, {
                                ...onceReentryContext,
                                fallbackReady: true
                            });
                            execution.currentNode = onceReentryContext.triggerNodeId;
                            this.setNodeEntryHandle(
                                execution,
                                onceReentryContext.triggerNodeId,
                                onceReentryContext.targetHandle
                            );
                            await run(`
                                UPDATE flow_executions
                                SET current_node = ?, variables = ?
                                WHERE id = ?
                            `, [onceReentryContext.triggerNodeId, JSON.stringify(execution.variables), execution.id]);
                            break;
                        }
                        await this.goToNextNode(execution, node);
                        break;
                    }

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
                    let sentSuccessfully = false;

                    if (this.sendFunction && (mediaType !== 'text' || content)) {
                        await this.sendFunction({
                            leadId: execution.lead?.id || null,
                            to: execution.lead.phone,
                            jid: execution.lead.jid,
                            sessionId: execution.conversation?.session_id || null,
                            conversationId: execution.conversation?.id || null,
                            flowId: execution.flow?.id || null,
                            nodeId: node?.id || null,
                            content,
                            mediaType,
                            mediaUrl: node?.data?.mediaUrl
                        });
                        sentSuccessfully = true;
                    } else if (mediaType === 'text' && !content) {
                        console.warn(
                            `[flow-intent] Mensagem de fluxo vazia ignorada `
                            + `(fluxo ${execution?.flow?.id || 'n/a'}, no ${node?.id || 'n/a'}).`
                        );
                    }

                    if (isOnceMessage && sentSuccessfully) {
                        await this.markLeadOnceMessageNodeSeen(execution, node);
                    }

                    if (onceReentryContext) {
                        this.setIntentDefaultMessageOnceReentry(execution, {
                            ...onceReentryContext,
                            fallbackReady: true
                        });
                        execution.currentNode = onceReentryContext.triggerNodeId;
                        this.setNodeEntryHandle(
                            execution,
                            onceReentryContext.triggerNodeId,
                            onceReentryContext.targetHandle
                        );

                        await run(`
                            UPDATE flow_executions
                            SET current_node = ?, variables = ?
                            WHERE id = ?
                        `, [onceReentryContext.triggerNodeId, JSON.stringify(execution.variables), execution.id]);
                        break;
                    }

                    if (isOnceMessage) {
                        this.clearIntentDefaultMessageOnceReentry(execution);
                    }

                    // Ir para o proximo no
                    await this.goToNextNode(execution, node);
                    break;
                }
                    
                case 'wait':
                    // Aguarda resposta do usuario
                    // O fluxo sera continuado quando chegar nova mensagem
                    if (this.isAwaitingInputMenuEnabled(node)) {
                        const pendingBeforeWait = this.readPendingIncomingMessages(execution);
                        if (pendingBeforeWait.length === 0) {
                            await this.maybeSendAwaitingInputMenu(execution, node);
                        }
                    }
                    await this.drainPendingIncomingMessages(execution);
                    break;

                case 'intent':
                    // Aguarda resposta para classificar a intencao no meio do fluxo
                    if (this.isIntentLinkButtonEnabled(node, execution)) {
                        await this.maybeSendIntentNodeLinkButton(execution, node);
                        await this.goToNextNode(execution, node, 'default');
                        break;
                    }

                    if (this.isIntentMenuEnabledForExecution(execution, node)) {
                        const pendingBeforeIntent = this.readPendingIncomingMessages(execution);
                        if (pendingBeforeIntent.length === 0) {
                            await this.maybeSendIntentNodeMenu(execution, node);
                        }
                    }
                    await this.drainPendingIncomingMessages(execution);
                    break;

                case 'condition':
                    if (this.isAwaitingInputMenuEnabled(node)) {
                        const pendingBeforeCondition = this.readPendingIncomingMessages(execution);
                        if (pendingBeforeCondition.length === 0) {
                            await this.maybeSendAwaitingInputMenu(execution, node);
                        }
                    }
                    await this.drainPendingIncomingMessages(execution);
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
                            leadId: execution.lead?.id || null,
                            to: execution.lead.phone,
                            jid: execution.lead.jid,
                            sessionId: execution.conversation?.session_id || null,
                            conversationId: execution.conversation?.id || null,
                            flowId: execution.flow?.id || null,
                            nodeId: node?.id || null,
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
                    await this.executeLeadTagAction(execution, node?.data || {});
                    await this.goToNextNode(execution, node);
                    break;
                    
                case 'status':
                    await this.executeLeadStatusAction(execution, node?.data || {});
                    await this.goToNextNode(execution, node);
                    break;
                    
                case 'webhook':
                    await this.executeWebhookAction(execution, node?.data || {});
                    await this.goToNextNode(execution, node);
                    break;

                case 'event': {
                    await this.executeCustomEventAction(execution, node?.data || {}, {
                        nodeId: node?.id || null,
                        nodeLabel: node?.data?.label || ''
                    });
                    await this.goToNextNode(execution, node);
                    break;
                }
                    
                case 'end':
                    if (this.sendFunction && this.hasEndNodeRouteOptions(execution, node)) {
                        await this.maybeSendEndNodeMenu(execution, node);
                        await this.drainPendingIncomingMessages(execution);
                    } else {
                        await this.maybeSendEndNodeFinalMessage(execution, node);
                        await this.endFlow(execution, 'completed');
                    }
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
        const allowPhraseLessRoutes = this.isIntentMenuEnabled(node);
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
                    const response = String(route?.response || '').trim();
                    const followupResponses = parseIntentResponseList(
                        route?.followupResponses,
                        route?.followupResponse
                    );
                    const followupResponse = followupResponses[0] || '';
                    const normalizedPhrases = parseIntentPhrases(phrases);
                    if (!id) return null;
                    if (!allowPhraseLessRoutes && normalizedPhrases.length === 0) return null;
                    return { id, label, phrases, response, followupResponse, followupResponses, normalizedPhrases };
                })
                .filter(Boolean);
        }

        const fallbackPhrases = parseIntentPhrases(node?.data?.keyword || '');
        return fallbackPhrases.map((phrase, index) => ({
            id: `intent-${index + 1}`,
            label: `Intencao ${index + 1}`,
            phrases: phrase,
            response: '',
            followupResponse: '',
            followupResponses: [],
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

    resolveIntentResponseDelayMs(node = null) {
        const rawSeconds = Number(node?.data?.intentResponseDelaySeconds);
        if (!Number.isFinite(rawSeconds) || rawSeconds <= 0) return 0;
        return Math.max(0, Math.trunc(rawSeconds)) * 1000;
    }

    resolveTriggerIntentRouteByHandle(node = null, selectedHandle = null) {
        const routes = this.resolveTriggerIntentRoutes(node);
        if (routes.length === 0 || !selectedHandle) return null;

        const rawHandle = String(selectedHandle || '').trim() || 'default';
        const canonicalHandle = rawHandle === 'default'
            ? 'default'
            : normalizeIntentRouteHandle(rawHandle);

        return routes.find((route) => {
            const aliases = [
                route?.id,
                route?.label
            ];

            return aliases.some((alias) => {
                const aliasRaw = String(alias || '').trim();
                if (!aliasRaw) return false;
                const aliasCanonical = normalizeIntentRouteHandle(aliasRaw);
                return aliasRaw === rawHandle || aliasCanonical === canonicalHandle;
            });
        }) || null;
    }

    resolveIntentResponseTexts(node = null, selectedHandle = null) {
        const normalizedHandle = this.normalizeFlowHandle(selectedHandle);
        if (normalizedHandle === 'default') {
            const defaultMessage = String(node?.data?.intentDefaultResponse || '').trim();
            const defaultFollowupMessages = parseIntentResponseList(
                node?.data?.intentDefaultFollowupResponses,
                node?.data?.intentDefaultFollowupResponse
            );
            return [defaultMessage, ...defaultFollowupMessages].filter(Boolean);
        }

        const matchedRoute = this.resolveTriggerIntentRouteByHandle(node, normalizedHandle);
        const primaryMessage = String(matchedRoute?.response || '').trim();
        const followupMessages = parseIntentResponseList(
            matchedRoute?.followupResponses,
            matchedRoute?.followupResponse
        );
        return [primaryMessage, ...followupMessages].filter(Boolean);
    }

    async sendIntentRouteResponse(execution, node = null, selectedHandle = null) {
        const messages = this.resolveIntentResponseTexts(node, selectedHandle);
        if (messages.length === 0) return;
        if (!this.sendFunction) return;

        for (const rawMessage of messages) {
            const content = sanitizeOutgoingFlowText(
                this.replaceVariables(rawMessage, this.ensureExecutionVariables(execution))
            );
            if (!content) continue;

            const delayMs = this.resolveIntentResponseDelayMs(node);
            if (delayMs > 0) {
                await this.delay(delayMs);
            }

            await this.sendFunction({
                leadId: execution.lead?.id || null,
                to: execution.lead?.phone,
                jid: execution.lead?.jid,
                sessionId: execution.conversation?.session_id || null,
                conversationId: execution.conversation?.id || null,
                flowId: execution.flow?.id || null,
                nodeId: node?.id || null,
                content
            });
        }
    }

    resolveTriggerWelcomeConfig(node = null) {
        return {
            enabled: Boolean(node?.data?.triggerWelcomeEnabled),
            content: String(node?.data?.triggerWelcomeContent || '').trim(),
            delaySeconds: Number.isFinite(Number(node?.data?.triggerWelcomeDelaySeconds))
                ? Math.max(0, Math.trunc(Number(node?.data?.triggerWelcomeDelaySeconds)))
                : 0,
            repeatMode: String(node?.data?.triggerWelcomeRepeatMode || 'always').trim().toLowerCase(),
            repeatValue: Number.isFinite(Number(node?.data?.triggerWelcomeRepeatValue))
                ? Math.max(1, Math.trunc(Number(node?.data?.triggerWelcomeRepeatValue)))
                : 1
        };
    }

    buildTriggerWelcomeOnceNode(execution, node = null) {
        const flowId = Number(execution?.flow?.id || 0);
        const flowScope = Number.isInteger(flowId) && flowId > 0 ? `flow:${flowId}` : 'flow:unknown';
        const nodeScope = String(node?.id || 'trigger').trim() || 'trigger';
        return {
            id: `${nodeScope}:welcome`,
            data: {
                onceRepeatMode: String(node?.data?.triggerWelcomeRepeatMode || 'always').trim().toLowerCase(),
                onceRepeatValue: Number(node?.data?.triggerWelcomeRepeatValue),
                onceKey: `${flowScope}:node:${nodeScope}:welcome`
            }
        };
    }

    async maybeSendTriggerWelcomeMessage(execution, node = null) {
        if (!this.isIntentTriggerNode(node)) return false;
        if (this.isIntentMenuEnabledForExecution(execution, node)) return false;
        if (!this.sendFunction) return false;

        const config = this.resolveTriggerWelcomeConfig(node);
        if (!config.enabled || !config.content) return false;

        const onceNode = this.buildTriggerWelcomeOnceNode(execution, node);
        if (this.hasLeadSeenOnceMessageNode(execution, onceNode)) {
            return false;
        }

        const content = sanitizeOutgoingFlowText(
            this.replaceVariables(config.content, this.ensureExecutionVariables(execution))
        );
        if (!content) return false;

        const delayMs = config.delaySeconds * 1000;
        if (delayMs > 0) {
            await this.delay(delayMs);
        }

        await this.sendFunction({
            leadId: execution.lead?.id || null,
            to: execution.lead?.phone,
            jid: execution.lead?.jid,
            sessionId: execution.conversation?.session_id || null,
            conversationId: execution.conversation?.id || null,
            flowId: execution.flow?.id || null,
            nodeId: node?.id || null,
            content
        });

        await this.markLeadOnceMessageNodeSeen(execution, onceNode);
        return true;
    }

    async executeTriggerNode(execution, node) {
        const welcomeSent = await this.maybeSendTriggerWelcomeMessage(execution, node);
        if (this.isIntentLinkButtonEnabled(node, execution)) {
            delete execution.variables.trigger_intent_handle;
            this.clearIntentNoMatchCounter(execution, node?.id);
            this.clearIntentHistory(execution, node?.id);
            this.clearIntentDefaultMessageOnceReentry(execution);

            await this.maybeSendIntentNodeLinkButton(execution, node);

            await run(`
                UPDATE flow_executions
                SET variables = ?
                WHERE id = ?
            `, [JSON.stringify(execution.variables), execution.id]);

            await this.goToNextNode(execution, node, 'default');
            return;
        }

        if (this.isIntentMenuEnabledForExecution(execution, node)) {
            delete execution.variables.trigger_intent_handle;
            this.clearIntentNoMatchCounter(execution, node?.id);
            this.clearIntentHistory(execution, node?.id);
            this.clearIntentDefaultMessageOnceReentry(execution);

            const pendingBeforeTriggerIntentMenu = this.readPendingIncomingMessages(execution);
            if (pendingBeforeTriggerIntentMenu.length === 0) {
                await this.maybeSendIntentNodeMenu(execution, node);
            }

            await run(`
                UPDATE flow_executions
                SET variables = ?
                WHERE id = ?
            `, [JSON.stringify(execution.variables), execution.id]);

            await this.drainPendingIncomingMessages(execution);
            return;
        }

        if (welcomeSent && this.isIntentTriggerNode(node)) {
            delete execution.variables.trigger_intent_handle;

            await run(`
                UPDATE flow_executions
                SET variables = ?
                WHERE id = ?
            `, [JSON.stringify(execution.variables), execution.id]);

            return;
        }

        const selectedHandle = await this.pickTriggerIntentHandle(execution, node);
        let shouldWaitForMoreInput = false;
        let noMatchCount = 0;
        let minAttemptsBeforeDefault = 1;

        if (selectedHandle) {
            execution.variables.trigger_intent_handle = selectedHandle;
            this.clearIntentNoMatchCounter(execution, node?.id);
            this.clearIntentHistory(execution, node?.id);
            this.clearIntentDefaultMessageOnceReentry(execution);
        } else {
            delete execution.variables.trigger_intent_handle;

            if (this.isIntentTriggerNode(node)) {
                const outgoingEdges = (execution.flow?.edges || []).filter((edge) => edge.source === node.id);
                const hasDefaultRoute = outgoingEdges.some((edge) => {
                    const handle = String(edge?.sourceHandle || '').trim().toLowerCase();
                    return !handle || handle === 'default';
                });
                const hasSpecificRoutes = outgoingEdges.some((edge) => {
                    const handle = String(edge?.sourceHandle || '').trim().toLowerCase();
                    return Boolean(handle) && handle !== 'default';
                });

                noMatchCount = this.incrementIntentNoMatchCounter(execution, node.id);
                minAttemptsBeforeDefault = this.resolveIntentDefaultMinAttempts(node);
                shouldWaitForMoreInput = hasSpecificRoutes
                    && (!hasDefaultRoute || noMatchCount < minAttemptsBeforeDefault);

                if (!shouldWaitForMoreInput) {
                    this.clearIntentNoMatchCounter(execution, node.id);
                    this.clearIntentHistory(execution, node.id);
                }
            }
        }

        await run(`
            UPDATE flow_executions
            SET variables = ?
            WHERE id = ?
        `, [JSON.stringify(execution.variables), execution.id]);

        if (shouldWaitForMoreInput) {
            console.info(
                `[flow-intent] Nenhuma rota correspondeu no no ${node?.id || 'desconhecido'} `
                + `(fluxo ${execution?.flow?.id || 'n/a'}, conversa ${execution?.conversation?.id || 'n/a'}). `
                + `Tentativa ${noMatchCount}/${minAttemptsBeforeDefault}; `
                + 'execucao mantida aguardando nova resposta.'
            );
            return;
        }

        await this.goToNextNode(execution, node, selectedHandle);
    }

    normalizeOutputActionType(value = '') {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'tag' || normalized === 'status' || normalized === 'webhook' || normalized === 'event') {
            return normalized;
        }
        return '';
    }

    resolveOutputActionsForHandle(node = null, sourceHandle = 'default') {
        const outputActions = node?.data?.outputActions;
        if (!outputActions || typeof outputActions !== 'object' || Array.isArray(outputActions)) {
            return [];
        }

        const handle = this.normalizeFlowHandle(sourceHandle);
        const rawActions = outputActions[handle];
        if (!Array.isArray(rawActions)) return [];

        return rawActions
            .map((item, index) => {
                if (!item || typeof item !== 'object' || Array.isArray(item)) {
                    return null;
                }
                const type = this.normalizeOutputActionType(item.type);
                if (!type) return null;
                return {
                    ...item,
                    id: String(item.id || `${handle}-${index + 1}`),
                    type
                };
            })
            .filter(Boolean);
    }

    readLeadTags(value = null) {
        if (Array.isArray(value)) {
            return value
                .map((item) => String(item || '').trim())
                .filter(Boolean);
        }

        if (!value) return [];

        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed
                    .map((item) => String(item || '').trim())
                    .filter(Boolean);
            }
        } catch (_) {
            // ignore parse failure
        }

        return [];
    }

    async executeLeadTagAction(execution, payload = {}) {
        const nextTag = String(payload?.tag || '').trim();
        if (!nextTag) return;

        const currentTags = this.readLeadTags(execution?.lead?.tags);
        if (currentTags.includes(nextTag)) return;

        const nextTags = [...currentTags, nextTag];
        await Lead.update(execution.lead.id, { tags: nextTags });
        execution.lead.tags = JSON.stringify(nextTags);
    }

    async executeLeadStatusAction(execution, payload = {}) {
        const nextStatus = normalizeLeadStatus(payload?.status, null);
        if (nextStatus === null) return;
        await Lead.update(execution.lead.id, { status: nextStatus });
        execution.lead.status = nextStatus;
    }

    async executeWebhookAction(execution, payload = {}) {
        const url = String(payload?.url || '').trim();
        if (!url) return;

        this.emit('flow:webhook', {
            url,
            data: {
                lead: execution.lead,
                variables: execution.variables,
                flowId: execution.flow.id
            }
        });
    }

    async executeCustomEventAction(execution, payload = {}, options = {}) {
        const rawEventId = Number(payload?.eventId);
        const eventKey = String(payload?.eventKey || '').trim();
        const eventName = String(payload?.eventName || '').trim();
        const ownerScopeUserId = await resolveOwnerScopeUserIdFromAssignee(
            execution?.flow?.created_by,
            execution?.conversation?.assigned_to,
            execution?.lead?.assigned_to
        );
        const customEventScopeOptions = ownerScopeUserId
            ? { owner_user_id: ownerScopeUserId }
            : {};

        let customEvent = null;
        if (Number.isFinite(rawEventId) && rawEventId > 0) {
            customEvent = await CustomEvent.findById(rawEventId, customEventScopeOptions);
        }
        if (!customEvent && eventKey) {
            customEvent = await CustomEvent.findByKey(eventKey, customEventScopeOptions);
        }
        if (!customEvent && eventName) {
            customEvent = await CustomEvent.findByName(eventName, customEventScopeOptions);
        }

        if (!customEvent) {
            if (options?.nodeId) {
                console.warn(`Evento personalizado nao encontrado para o no ${options.nodeId}`);
            }
            return;
        }

        await CustomEvent.logOccurrence({
            event_id: customEvent.id,
            flow_id: execution.flow?.id || null,
            node_id: options?.nodeId || null,
            lead_id: execution.lead?.id || null,
            conversation_id: execution.conversation?.id || null,
            execution_id: execution.id || null,
            metadata: {
                source: 'flow',
                flowName: execution.flow?.name || '',
                nodeLabel: options?.nodeLabel || '',
                triggerMessage: execution.triggerMessageText || ''
            }
        });

        execution.variables.last_custom_event = customEvent.name;
        execution.variables.last_custom_event_key = customEvent.event_key;
    }

    async executeOutputActions(execution, currentNode, sourceHandle = 'default') {
        const actions = this.resolveOutputActionsForHandle(currentNode, sourceHandle);
        if (actions.length === 0) return;

        for (const action of actions) {
            try {
                if (action.type === 'tag') {
                    await this.executeLeadTagAction(execution, action);
                    continue;
                }

                if (action.type === 'status') {
                    await this.executeLeadStatusAction(execution, action);
                    continue;
                }

                if (action.type === 'webhook') {
                    await this.executeWebhookAction(execution, action);
                    continue;
                }

                if (action.type === 'event') {
                    await this.executeCustomEventAction(execution, action, {
                        nodeId: currentNode?.id || null,
                        nodeLabel: currentNode?.data?.label || ''
                    });
                }
            } catch (error) {
                const actionType = String(action?.type || 'desconhecida').trim() || 'desconhecida';
                const details = String(error?.message || error || 'erro desconhecido');
                const baseMessage = `[flow-actions] Falha ao executar acao de saida (${actionType}) no no ${currentNode?.id || 'n/a'}: ${details}`;
                if (shouldFailOnOutputActionError(action)) {
                    throw new Error(baseMessage);
                }
                console.error(`${baseMessage}. Fluxo mantido em execucao.`);
            }
        }
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
                const edgeLabelRaw = rawHandle(item.label);
                const edgeLabelCanonical = canonicalHandle(item.label);
                return (
                    acceptedHandles.has(edgeRaw)
                    || acceptedHandles.has(edgeCanonical)
                    || acceptedHandles.has(edgeLabelRaw)
                    || acceptedHandles.has(edgeLabelCanonical)
                );
            });
        }

        if (isIntentNode) {
            if (!edge) {
                edge = outgoingEdges.find((item) => rawHandle(item.sourceHandle) === 'default');
            }

            if (!edge) {
                const intentSpecificEdges = outgoingEdges.filter((item) => rawHandle(item.sourceHandle) !== 'default');
                if (intentSpecificEdges.length === 1) {
                    edge = intentSpecificEdges[0];
                }
            }
        } else {
            const entryHandle = this.getNodeEntryHandle(execution, currentNode?.id);
            edge = outgoingEdges.find((item) => rawHandle(item.sourceHandle) === entryHandle);

            if (!edge) {
                edge = outgoingEdges.find((item) => rawHandle(item.sourceHandle) === 'default');
            }

            if (!edge) {
                edge = outgoingEdges[0];
            }
        }

        if (edge) {
            const selectedSourceHandle = rawHandle(edge.sourceHandle);
            const nextTargetHandle = rawHandle(edge.targetHandle);
            if (this.isIntentDefaultToMessageOnceBridge(execution.flow, currentNode, edge)) {
                this.setIntentDefaultMessageOnceReentry(execution, {
                    triggerNodeId: currentNode?.id,
                    messageOnceNodeId: edge.target,
                    targetHandle: nextTargetHandle,
                    fallbackReady: false
                });
            } else {
                this.clearIntentDefaultMessageOnceReentry(execution);
            }

            const shouldSendIntentRouteResponse = isIntentNode
                && !(this.isIntentLinkButtonEnabled(currentNode, execution) && selectedSourceHandle === 'default');
            if (shouldSendIntentRouteResponse) {
                await this.sendIntentRouteResponse(execution, currentNode, selectedSourceHandle);
            }
            await this.executeOutputActions(execution, currentNode, selectedSourceHandle);
            this.setNodeEntryHandle(execution, edge.target, nextTargetHandle);
            await this.executeNode(execution, edge.target, nextTargetHandle);
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
    evaluateConditionEdge(flow, node, response, preferredSourceHandle = 'default', message = {}) {
        const responseText = String(response || '').trim();
        const text = responseText.toLowerCase();
        const normalizedText = normalizeIntentText(responseText);
        const edges = (flow?.edges || []).filter((edge) => edge.source === node?.id);
        if (edges.length === 0) return null;

        const normalizedPreferredHandle = this.normalizeFlowHandle(preferredSourceHandle);
        const explicitHandle = this.resolveFlowHandleFromInboundMessage(message, responseText);
        if (explicitHandle) {
            const explicitEdge = edges.find((edge) => this.normalizeFlowHandle(edge?.sourceHandle) === explicitHandle);
            if (explicitEdge) {
                return explicitEdge;
            }
        }

        if (node?.data?.conditions) {
            for (const condition of node.data.conditions) {
                const conditionValueRaw = String(condition?.value || '').trim();
                if (!conditionValueRaw) continue;

                const conditionValue = conditionValueRaw.toLowerCase();
                const normalizedConditionValue = normalizeIntentText(conditionValueRaw);
                const hasTextMatch = (
                    (text && (text === conditionValue || text.includes(conditionValue)))
                    || (normalizedText && normalizedConditionValue && (
                        normalizedText === normalizedConditionValue
                        || normalizedText.includes(normalizedConditionValue)
                    ))
                );

                if (!hasTextMatch) continue;

                const explicitNext = String(condition?.next || '').trim();
                if (explicitNext) {
                    return {
                        source: node?.id,
                        target: explicitNext,
                        sourceHandle: 'default',
                        targetHandle: 'default'
                    };
                }
            }
        }

        const outputEntryLabels = this.normalizeOutputEntryLabelsMap(node?.data?.outputEntryLabels || {});

        for (const edge of edges) {
            const edgeHandle = this.normalizeFlowHandle(edge?.sourceHandle);
            const edgeLabel = String(edge?.label || '').trim();
            const edgeInputLabel = String(edge?.inputLabel || '').trim();
            const mapLabel = String(outputEntryLabels[edgeHandle] || '').trim();
            const handleIndex = parsePathHandleIndex(edgeHandle);
            const aliases = [
                edgeLabel,
                edgeInputLabel,
                mapLabel,
                handleIndex ? String(handleIndex) : '',
                edgeHandle === 'default' ? 'default' : edgeHandle,
                edgeHandle === 'default' ? 'padrao' : ''
            ]
                .map((value) => normalizeIntentText(value))
                .filter(Boolean);

            if (aliases.length === 0 || !normalizedText) continue;
            const hasAliasMatch = aliases.some((alias) => (
                normalizedText === alias || normalizedText.includes(alias)
            ));
            if (hasAliasMatch) {
                return edge;
            }
        }

        const unlabeledEdges = edges.filter((edge) => {
            const handle = this.normalizeFlowHandle(edge?.sourceHandle);
            const edgeLabel = String(edge?.label || '').trim();
            const edgeInputLabel = String(edge?.inputLabel || '').trim();
            const mapLabel = String(outputEntryLabels[handle] || '').trim();
            return !edgeLabel && !edgeInputLabel && !mapLabel;
        });
        const preferredEdge = unlabeledEdges.find((edge) => this.normalizeFlowHandle(edge?.sourceHandle) === normalizedPreferredHandle);
        if (preferredEdge) return preferredEdge;

        const defaultEdge = unlabeledEdges.find((edge) => this.normalizeFlowHandle(edge?.sourceHandle) === 'default');
        if (defaultEdge) return defaultEdge;

        if (unlabeledEdges.length > 0) return unlabeledEdges[0];
        const preferredAnyEdge = edges.find((edge) => this.normalizeFlowHandle(edge?.sourceHandle) === normalizedPreferredHandle);
        if (preferredAnyEdge) return preferredAnyEdge;
        return edges[0] || null;
    }

    evaluateCondition(flow, node, response) {
        const edge = this.evaluateConditionEdge(flow, node, response, 'default');
        return edge?.target || null;
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
