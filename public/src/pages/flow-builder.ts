// Flow builder page logic migrated to module

// Estado do construtor
type NodeType = 'trigger' | 'intent' | 'message' | 'wait' | 'condition' | 'delay' | 'transfer' | 'tag' | 'status' | 'webhook' | 'event' | 'end';
type NodeData = {
    label: string;
    collapsed?: boolean;
    keyword?: string;
    intentRoutes?: Array<{ id: string; label: string; phrases: string }>;
    content?: string;
    delaySeconds?: number;
    timeout?: number;
    conditions?: Array<{ value: string; next?: string }>;
    seconds?: number;
    message?: string;
    tag?: string;
    status?: number;
    url?: string;
    eventId?: number | null;
    eventKey?: string;
    eventName?: string;
};

type FlowNode = {
    id: string;
    type: NodeType;
    subtype?: string;
    position: { x: number; y: number };
    data: NodeData;
};

type Edge = {
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
    label?: string;
};

type AiGeneratedFlowDraft = {
    name?: string;
    description?: string;
    nodes?: FlowNode[];
    edges?: Edge[];
    assumptions?: string[];
    is_active?: number | boolean;
};

type AiGenerateFlowResponse = {
    success?: boolean;
    error?: string;
    provider?: string;
    intent?: string;
    context?: Record<string, any>;
    draft?: AiGeneratedFlowDraft | null;
};

type AiFlowGenerationRunResult = {
    provider?: string;
    assumptions?: string[];
    cancelled?: boolean;
};

type AiFlowGenerationRunOptions = {
    confirmReplace?: boolean;
};

type FlowSummary = {
    id: number;
    name: string;
    trigger_type?: string;
    nodes?: FlowNode[];
    is_active?: boolean;
};

type ContactField = {
    key: string;
    label: string;
    placeholder?: string;
    is_default?: boolean;
    required?: boolean;
    source?: string;
};

type CustomEventOption = {
    id: number;
    name: string;
    event_key?: string;
    is_active?: number;
};

let nodes: FlowNode[] = [];
let edges: Edge[] = [];
let selectedNode: FlowNode | null = null;
let currentFlowId: number | null = null;
let currentFlowName = '';
let currentFlowIsActive = true;
let flowHasUnsavedChanges = false;
let flowsCache: FlowSummary[] = [];
let renamingFlowId: number | null = null;
let renamingFlowDraft = '';
let zoom = 1;
let pan = { x: 0, y: 0 };
let isDragging = false;
let dragNode: FlowNode | null = null;
let dragOffset = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
let panOrigin = { x: 0, y: 0 };
let isConnecting = false;
let connectionStart: { nodeId: string; portType: string; handle: string; label?: string } | null = null;
let connectionStartPort: HTMLElement | null = null;
let connectionPreviewPath: SVGPathElement | null = null;
let lastPointer = { x: 0, y: 0 };
let hasGlobalCanvasListeners = false;
let contactFieldsCache: ContactField[] = [];
let customEventsCache: CustomEventOption[] = [];

type ToastType = 'success' | 'error' | 'warning' | 'info';
type ToastFn = (type: ToastType, title: string, message: string, duration?: number) => void;
type FlowDialogMode = 'alert' | 'confirm' | 'prompt';
type FlowDialogOptions = {
    mode: FlowDialogMode;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    defaultValue?: string;
    placeholder?: string;
};
type FlowDialogElements = {
    overlay: HTMLElement;
    title: HTMLElement;
    message: HTMLElement;
    inputWrap: HTMLElement;
    input: HTMLInputElement;
    cancelBtn: HTMLButtonElement;
    confirmBtn: HTMLButtonElement;
    closeBtn: HTMLButtonElement;
};

type FlowAiAssistantMessage = {
    role: 'assistant' | 'user' | 'system';
    text: string;
};

const DEFAULT_HANDLE = 'default';
const LAST_OPEN_FLOW_ID_STORAGE_KEY = 'flow_builder:last_open_flow_id';
const DEFAULT_CONTACT_FIELDS: ContactField[] = [
    { key: 'nome', label: 'Nome', source: 'name', is_default: true, required: true, placeholder: 'Nome completo' },
    { key: 'telefone', label: 'Telefone', source: 'phone', is_default: true, required: true, placeholder: 'Somente números com DDD' },
    { key: 'email', label: 'Email', source: 'email', is_default: true, required: false, placeholder: 'email@exemplo.com' }
];

let activeFlowDialogDismiss: (() => void) | null = null;
let flowAiAssistantOpen = false;
let flowAiAssistantLoading = false;
let flowAiAssistantBound = false;
let flowAiAssistantHasOpenedOnce = false;
let flowAiAssistantMessages: FlowAiAssistantMessage[] = [];

function getFlowDialogElements(): FlowDialogElements | null {
    const overlay = document.getElementById('flowDialogModal') as HTMLElement | null;
    const title = document.getElementById('flowDialogTitle') as HTMLElement | null;
    const message = document.getElementById('flowDialogMessage') as HTMLElement | null;
    const inputWrap = document.getElementById('flowDialogInputWrap') as HTMLElement | null;
    const input = document.getElementById('flowDialogInput') as HTMLInputElement | null;
    const cancelBtn = document.getElementById('flowDialogCancelBtn') as HTMLButtonElement | null;
    const confirmBtn = document.getElementById('flowDialogConfirmBtn') as HTMLButtonElement | null;
    const closeBtn = document.getElementById('flowDialogCloseBtn') as HTMLButtonElement | null;

    if (!overlay || !title || !message || !inputWrap || !input || !cancelBtn || !confirmBtn || !closeBtn) {
        return null;
    }

    return {
        overlay,
        title,
        message,
        inputWrap,
        input,
        cancelBtn,
        confirmBtn,
        closeBtn
    };
}

function fallbackNativeDialog(options: FlowDialogOptions): Promise<any> {
    if (options.mode === 'alert') {
        window.alert(options.message);
        return Promise.resolve();
    }

    if (options.mode === 'confirm') {
        return Promise.resolve(window.confirm(options.message));
    }

    const value = window.prompt(options.message, options.defaultValue || '');
    return Promise.resolve(value === null ? null : String(value));
}

function openStyledFlowDialog(options: FlowDialogOptions): Promise<any> {
    const elements = getFlowDialogElements();
    if (!elements) {
        return fallbackNativeDialog(options);
    }

    if (typeof activeFlowDialogDismiss === 'function') {
        activeFlowDialogDismiss();
    }

    return new Promise((resolve) => {
        const {
            overlay,
            title,
            message,
            inputWrap,
            input,
            cancelBtn,
            confirmBtn,
            closeBtn
        } = elements;

        let settled = false;
        const isPrompt = options.mode === 'prompt';
        const isAlert = options.mode === 'alert';

        const finish = (result: any) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(result);
        };

        const cancelResult = () => {
            if (isAlert) return undefined;
            if (isPrompt) return null;
            return false;
        };

        const cleanup = () => {
            activeFlowDialogDismiss = null;
            overlay.classList.remove('active');
            overlay.onclick = null;
            cancelBtn.onclick = null;
            confirmBtn.onclick = null;
            closeBtn.onclick = null;
            input.onkeydown = null;
            document.removeEventListener('keydown', onKeydown, true);
        };

        const onKeydown = (event: KeyboardEvent) => {
            if (!overlay.classList.contains('active')) return;

            if (event.key === 'Escape') {
                event.preventDefault();
                finish(cancelResult());
                return;
            }

            if (event.key === 'Enter' && (isPrompt || options.mode === 'confirm')) {
                const target = event.target as HTMLElement | null;
                if (!isPrompt || target === input) {
                    event.preventDefault();
                    finish(isPrompt ? input.value : true);
                }
            }
        };

        activeFlowDialogDismiss = () => finish(cancelResult());

        title.textContent = String(options.title || (isPrompt ? 'Digite um valor' : isAlert ? 'Aviso' : 'Confirmacao'));
        message.textContent = String(options.message || '');

        inputWrap.classList.toggle('active', isPrompt);
        input.value = isPrompt ? String(options.defaultValue || '') : '';
        input.placeholder = isPrompt ? String(options.placeholder || '') : '';

        cancelBtn.style.display = isAlert ? 'none' : '';
        cancelBtn.textContent = String(options.cancelLabel || 'Cancelar');
        confirmBtn.textContent = String(options.confirmLabel || (isPrompt ? 'Aplicar' : 'OK'));

        overlay.onclick = (event) => {
            if (event.target === overlay) {
                finish(cancelResult());
            }
        };
        cancelBtn.onclick = () => finish(cancelResult());
        closeBtn.onclick = () => finish(cancelResult());
        confirmBtn.onclick = () => finish(isPrompt ? input.value : (isAlert ? undefined : true));
        input.onkeydown = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                finish(input.value);
            }
        };

        document.addEventListener('keydown', onKeydown, true);
        overlay.classList.add('active');

        requestAnimationFrame(() => {
            if (isPrompt) {
                input.focus();
                input.select();
                return;
            }
            if (!isAlert) {
                confirmBtn.focus();
                return;
            }
            closeBtn.focus();
        });
    });
}

function showFlowAlertDialog(message: string, title = 'Aviso') {
    return openStyledFlowDialog({
        mode: 'alert',
        title,
        message,
        confirmLabel: 'OK'
    });
}

function showFlowConfirmDialog(message: string, title = 'Confirmacao') {
    return openStyledFlowDialog({
        mode: 'confirm',
        title,
        message,
        confirmLabel: 'OK',
        cancelLabel: 'Cancelar'
    }) as Promise<boolean>;
}

function showFlowPromptDialog(message: string, options: { title?: string; defaultValue?: string; placeholder?: string; confirmLabel?: string; cancelLabel?: string } = {}) {
    return openStyledFlowDialog({
        mode: 'prompt',
        title: options.title,
        message,
        defaultValue: options.defaultValue,
        placeholder: options.placeholder,
        confirmLabel: options.confirmLabel || 'OK',
        cancelLabel: options.cancelLabel || 'Cancelar'
    }) as Promise<string | null>;
}

function notify(type: ToastType, title: string, message: string, fallbackMessage?: string) {
    const globalToast = (window as Window & { showToast?: ToastFn }).showToast;
    if (typeof globalToast === 'function') {
        globalToast(type, title, message);
        return;
    }

    void showFlowAlertDialog(fallbackMessage || message, title || 'Aviso');
}

function getFlowAiAssistantElements() {
    return {
        launchBtn: document.getElementById('flowAiAssistantLaunchBtn') as HTMLButtonElement | null,
        launchLabel: document.getElementById('flowAiAssistantLaunchLabel') as HTMLElement | null,
        panel: document.getElementById('flowAiAssistantPanel') as HTMLElement | null,
        messages: document.getElementById('flowAiAssistantMessages') as HTMLElement | null,
        input: document.getElementById('flowAiAssistantInput') as HTMLTextAreaElement | null,
        sendBtn: document.getElementById('flowAiAssistantSendBtn') as HTMLButtonElement | null,
        status: document.getElementById('flowAiAssistantStatus') as HTMLElement | null,
        closeBtn: document.getElementById('flowAiAssistantCloseBtn') as HTMLButtonElement | null
    };
}

function ensureFlowAiAssistantWelcome() {
    if (flowAiAssistantMessages.length > 0) return;
    flowAiAssistantMessages = [
        {
            role: 'assistant',
            text: 'Descreva o que a IA deve fazer no fluxo (criar ou ajustar). Ex.: "gere um fluxo de conversa que receba novos leads e feche vendas".'
        }
    ];
}

function renderFlowAiAssistantMessages() {
    const { messages } = getFlowAiAssistantElements();
    if (!messages) return;

    ensureFlowAiAssistantWelcome();

    messages.innerHTML = flowAiAssistantMessages
        .map((item) => `<div class="flow-ai-assistant-message ${item.role}">${escapeHtml(item.text || '')}</div>`)
        .join('');

    messages.scrollTop = messages.scrollHeight;
}

function autoResizeFlowAiAssistantInput() {
    const { input } = getFlowAiAssistantElements();
    if (!input) return;
    input.style.height = 'auto';
    const nextHeight = Math.min(Math.max(input.scrollHeight, 42), 110);
    input.style.height = `${nextHeight}px`;
}

function renderFlowAiAssistantState() {
    const { launchBtn, launchLabel, panel, sendBtn, status, input } = getFlowAiAssistantElements();

    if (launchBtn) {
        launchBtn.hidden = flowAiAssistantOpen;
        launchBtn.classList.toggle('is-hidden', flowAiAssistantOpen);
    }
    if (launchLabel) {
        launchLabel.textContent = flowAiAssistantHasOpenedOnce ? 'Chat IA' : 'Gerar com IA';
    }
    if (panel) {
        panel.hidden = !flowAiAssistantOpen;
    }

    if (status) {
        status.textContent = flowAiAssistantLoading ? 'Gerando...' : 'Pronta';
    }

    if (sendBtn) {
        const hasText = Boolean(String(input?.value || '').trim());
        sendBtn.disabled = flowAiAssistantLoading || !hasText;
    }

    if (flowAiAssistantOpen) {
        renderFlowAiAssistantMessages();
        autoResizeFlowAiAssistantInput();
    }
}

function appendFlowAiAssistantMessage(role: FlowAiAssistantMessage['role'], text: string) {
    const normalized = String(text || '').trim();
    if (!normalized) return;
    flowAiAssistantMessages.push({ role, text: normalized });
    renderFlowAiAssistantMessages();
}

function setFlowAiAssistantOpen(forceOpen?: boolean) {
    const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : !flowAiAssistantOpen;
    flowAiAssistantOpen = nextOpen;
    if (nextOpen) {
        flowAiAssistantHasOpenedOnce = true;
    }
    ensureFlowAiAssistantWelcome();
    renderFlowAiAssistantState();

    if (flowAiAssistantOpen) {
        window.requestAnimationFrame(() => {
            const { input } = getFlowAiAssistantElements();
            input?.focus();
            if (input) {
                const end = input.value.length;
                input.setSelectionRange(end, end);
            }
        });
    }
}

function toggleFlowAiAssistant(forceOpen?: boolean) {
    setFlowAiAssistantOpen(forceOpen);
}

function closeFlowAiAssistant() {
    setFlowAiAssistantOpen(false);
}

function handleFlowAiAssistantInputKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    if (event.shiftKey) return;
    event.preventDefault();
    void sendFlowAiAssistantPrompt();
}

function bindFlowAiAssistant() {
    if (flowAiAssistantBound) return;
    const { panel, input, closeBtn } = getFlowAiAssistantElements();
    if (!panel || !input) return;

    flowAiAssistantBound = true;

    const stopWheelPropagation = (event: Event) => {
        event.stopPropagation();
    };
    panel.addEventListener('wheel', stopWheelPropagation, { passive: true });
    panel.addEventListener('mousedown', (event) => event.stopPropagation());
    panel.addEventListener('click', (event) => event.stopPropagation());

    input.addEventListener('input', () => {
        autoResizeFlowAiAssistantInput();
        renderFlowAiAssistantState();
    });

    closeBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeFlowAiAssistant();
    });

    renderFlowAiAssistantState();
}

async function sendFlowAiAssistantPrompt() {
    const { input } = getFlowAiAssistantElements();
    if (!input || flowAiAssistantLoading) return;

    const promptText = String(input.value || '').trim();
    if (!promptText) {
        renderFlowAiAssistantState();
        return;
    }

    appendFlowAiAssistantMessage('user', promptText);
    input.value = '';
    flowAiAssistantLoading = true;
    renderFlowAiAssistantState();

    try {
        const result = await runGenerateFlowWithAiPrompt(promptText, { confirmReplace: false });
        if (result.cancelled) {
            appendFlowAiAssistantMessage('system', 'Geração cancelada.');
            return;
        }

        const provider = String(result.provider || 'IA').toUpperCase();
        const assumptions = Array.isArray(result.assumptions) ? result.assumptions : [];
        const summary = assumptions.length
            ? `Rascunho gerado (${provider}). Revise, ajuste se necessário e salve.\n\nObservações:\n- ${assumptions.join('\n- ')}`
            : `Rascunho gerado (${provider}). Revise, ajuste se necessário e salve.`;
        appendFlowAiAssistantMessage('assistant', summary);
    } catch (error) {
        await showFlowAlertDialog(
            'Erro ao gerar fluxo com IA: ' + (error instanceof Error ? error.message : 'Falha inesperada'),
            'Gerar fluxo com IA'
        );
    } finally {
        flowAiAssistantLoading = false;
        renderFlowAiAssistantState();
        window.requestAnimationFrame(() => {
            input.focus();
        });
    }
}

function isIntentTrigger(node?: FlowNode | null) {
    if (!node) return false;
    if (node.type === 'intent') return true;
    return node.type === 'trigger' && (node.subtype === 'keyword' || node.subtype === 'intent');
}

function normalizeRouteId(value: string) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || `intent-${Date.now()}`;
}

function parsePhraseList(value: string) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function buildRouteLabel(route: { label?: string; phrases?: string }, index: number) {
    const explicitLabel = String(route.label || '').trim();
    if (explicitLabel) return explicitLabel;
    const firstPhrase = parsePhraseList(route.phrases || '')[0];
    if (firstPhrase) return firstPhrase;
    return `Intenção ${index + 1}`;
}

function getIntentRoutes(node?: FlowNode | null) {
    if (!isIntentTrigger(node)) return [];

    const routes = Array.isArray(node?.data?.intentRoutes) ? node.data.intentRoutes : [];
    if (routes.length > 0) {
        const usedIds = new Set<string>();
        return routes.map((route, index) => {
            const baseId = normalizeRouteId(route.id || route.label || `intent-${index + 1}`);
            let id = baseId;
            let suffix = 1;
            while (usedIds.has(id)) {
                id = `${baseId}-${suffix}`;
                suffix += 1;
            }
            usedIds.add(id);
            return {
                id,
                label: buildRouteLabel(route, index),
                phrases: String(route.phrases || '').trim()
            };
        });
    }

    const fallbackPhrases = parsePhraseList(node?.data?.keyword || '');
    return fallbackPhrases.map((phrase, index) => ({
        id: normalizeRouteId(`intent-${index + 1}`),
        label: phrase,
        phrases: phrase
    }));
}

function syncIntentRoutesFromNode(node?: FlowNode | null) {
    if (!isIntentTrigger(node)) return;
    const routes = getIntentRoutes(node);
    node!.data.intentRoutes = routes;
    const allPhrases = routes.flatMap((route) => parsePhraseList(route.phrases));
    node!.data.keyword = Array.from(new Set(allPhrases)).join(', ');
}

function getOutputHandles(node: FlowNode) {
    if (!isIntentTrigger(node)) {
        return [{ handle: DEFAULT_HANDLE, label: '' }];
    }

    const routes = getIntentRoutes(node);
    const routeHandles = routes.map((route) => ({
        handle: route.id || normalizeRouteId(route.label || route.phrases || ''),
        label: route.label || route.phrases || 'Intenção'
    }));

    return [...routeHandles, { handle: DEFAULT_HANDLE, label: 'Padrão' }];
}

function edgeHandle(handle?: string) {
    const normalized = String(handle || '').trim();
    return normalized || DEFAULT_HANDLE;
}

function isSameEdge(a: Edge, b: Edge) {
    return (
        a.source === b.source &&
        a.target === b.target &&
        edgeHandle(a.sourceHandle) === edgeHandle(b.sourceHandle) &&
        edgeHandle(a.targetHandle) === edgeHandle(b.targetHandle)
    );
}

function findPortByHandle(nodeEl: Element, selector: string, handle?: string) {
    const normalizedHandle = edgeHandle(handle);
    const ports = Array.from(nodeEl.querySelectorAll(selector)) as HTMLElement[];
    const exact = ports.find((port) => edgeHandle(port.dataset.handle) === normalizedHandle);
    return exact || ports[0] || null;
}

function truncateLabel(value: string, max = 18) {
    const text = String(value || '').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
}

function escapeHtml(value: string) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeContactFieldKey(value: string) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);
}

function normalizeContactFieldLabel(value: string) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

function sanitizeContactFields(fields: ContactField[]) {
    const dedupe = new Set<string>();
    const result: ContactField[] = [];

    for (const field of fields || []) {
        const key = normalizeContactFieldKey(field?.key || '');
        const label = normalizeContactFieldLabel(field?.label || field?.key || '');
        if (!key || !label || key === '__system') continue;
        if (dedupe.has(key)) continue;
        dedupe.add(key);
        result.push({
            key,
            label,
            placeholder: String(field?.placeholder || '').trim(),
            is_default: Boolean(field?.is_default),
            required: Boolean(field?.required),
            source: String(field?.source || '')
        });
    }

    return result;
}

function getAvailableContactFields() {
    return contactFieldsCache.length ? contactFieldsCache : DEFAULT_CONTACT_FIELDS;
}

function renderFlowVariableTags() {
    const container = document.getElementById('flowVariablesList') as HTMLElement | null;
    if (!container) return;

    const fields = getAvailableContactFields();
    container.innerHTML = fields
        .map((field) => `
            <span class="variable-tag" title="${escapeHtml(field.label)}" onclick="insertVariable('${escapeHtml(field.key)}')">{{${escapeHtml(field.key)}}}</span>
        `)
        .join('');
}

async function loadFlowVariableFields() {
    try {
        const response = await fetch('/api/contact-fields', {
            headers: buildAuthHeaders(false)
        });
        const result = await response.json();
        const fields = sanitizeContactFields(Array.isArray(result?.fields) ? result.fields : []);
        contactFieldsCache = fields.length ? fields : [...DEFAULT_CONTACT_FIELDS];
    } catch (error) {
        contactFieldsCache = [...DEFAULT_CONTACT_FIELDS];
    }

    renderFlowVariableTags();
}

function normalizeCustomEventOption(raw: any): CustomEventOption | null {
    const id = Number(raw?.id);
    const name = String(raw?.name || '').trim();
    const eventKey = String(raw?.event_key || raw?.eventKey || '').trim();
    const isActive = Number(raw?.is_active ?? raw?.isActive ?? 1);

    if (!Number.isFinite(id) || id <= 0) return null;
    if (!name) return null;

    return {
        id: Math.trunc(id),
        name,
        event_key: eventKey,
        is_active: Number.isFinite(isActive) ? isActive : 1
    };
}

function getAvailableCustomEvents() {
    return customEventsCache.filter((eventItem) => Number(eventItem.is_active) !== 0);
}

function syncEventNodeData(node?: FlowNode | null) {
    if (!node || node.type !== 'event') return;

    const eventId = Number(node.data?.eventId);
    const eventKey = String(node.data?.eventKey || '').trim();
    const eventName = String(node.data?.eventName || '').trim();
    let matched: CustomEventOption | undefined;

    if (Number.isFinite(eventId) && eventId > 0) {
        matched = customEventsCache.find((item) => Number(item.id) === Math.trunc(eventId));
    }

    if (!matched && eventKey) {
        const normalizedKey = eventKey.toLowerCase();
        matched = customEventsCache.find((item) => String(item.event_key || '').toLowerCase() === normalizedKey);
    }

    if (!matched && eventName) {
        const normalizedName = eventName.toLowerCase();
        matched = customEventsCache.find((item) => item.name.toLowerCase() === normalizedName);
    }

    if (!matched) {
        node.data.eventId = Number.isFinite(eventId) && eventId > 0 ? Math.trunc(eventId) : null;
        node.data.eventKey = eventKey;
        node.data.eventName = eventName;
        return;
    }

    node.data.eventId = matched.id;
    node.data.eventKey = String(matched.event_key || '').trim();
    node.data.eventName = matched.name;
}

async function loadCustomEventsCatalog(options: { silent?: boolean } = {}) {
    try {
        const response = await fetch('/api/custom-events?active=1', {
            headers: buildAuthHeaders(false)
        });
        const result = await response.json();
        const list = Array.isArray(result?.events) ? result.events : [];
        customEventsCache = list
            .map((item: any) => normalizeCustomEventOption(item))
            .filter(Boolean) as CustomEventOption[];

        nodes.forEach((node) => syncEventNodeData(node));
    } catch (error) {
        customEventsCache = [];
        if (!options.silent) {
            void showFlowAlertDialog('Nao foi possivel atualizar a lista de eventos personalizados.', 'Eventos');
        }
    }

    if (selectedNode?.type === 'event') {
        renderProperties();
    }
}

function reloadCustomEventsCatalog() {
    loadCustomEventsCatalog();
}

function getNodeTypeLabel(node: FlowNode) {
    if (node.type === 'trigger') {
        if (isIntentTrigger(node)) return 'Intenção';
        return 'Novo Contato';
    }

    const labels: Record<NodeType, string> = {
        trigger: 'Gatilho',
        intent: 'Intenção',
        message: 'Enviar Mensagem',
        wait: 'Aguardar Resposta',
        condition: 'Condição',
        delay: 'Delay',
        transfer: 'Transferir',
        tag: 'Adicionar Tag',
        status: 'Alterar Status',
        webhook: 'Webhook',
        event: 'Registrar Evento',
        end: 'Finalizar'
    };

    return labels[node.type] || 'Bloco';
}

function clientToFlowCoords(clientX: number, clientY: number) {
    const flowCanvas = document.getElementById('flowCanvas') as HTMLElement | null;
    if (!flowCanvas) return { x: 0, y: 0 };

    const rect = flowCanvas.getBoundingClientRect();
    return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom
    };
}

function getSessionToken() {
    return sessionStorage.getItem('selfDashboardToken');
}

function readLastOpenFlowId() {
    try {
        const raw = localStorage.getItem(LAST_OPEN_FLOW_ID_STORAGE_KEY);
        if (!raw) return null;
        const parsed = Number.parseInt(raw, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    } catch (_) {
        return null;
    }
}

function persistLastOpenFlowId(flowId: number | null) {
    try {
        if (Number.isFinite(flowId) && Number(flowId) > 0) {
            localStorage.setItem(LAST_OPEN_FLOW_ID_STORAGE_KEY, String(Math.trunc(Number(flowId))));
        } else {
            localStorage.removeItem(LAST_OPEN_FLOW_ID_STORAGE_KEY);
        }
    } catch (_) {
        // ignore storage failure
    }
}

function buildAuthHeaders(includeJson = false): Record<string, string> {
    const headers: Record<string, string> = {};
    const token = getSessionToken();
    if (includeJson) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

function toBoolean(value: unknown, fallback = true) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    }
    return fallback;
}

function setCurrentFlowActive(value: unknown) {
    currentFlowIsActive = toBoolean(value, true);
    renderFlowStatusControls();
}

function renderFlowStatusControls() {
    const statusSelect = document.getElementById('flowStatus') as HTMLSelectElement | null;
    if (statusSelect) {
        statusSelect.value = currentFlowIsActive ? '1' : '0';
    }
    renderCurrentFlowStatusIndicator();
}

function renderCurrentFlowStatusIndicator() {
    const statusDisplay = document.getElementById('currentFlowStatusDisplay') as HTMLElement | null;
    if (!statusDisplay) return;

    if (!currentFlowId) {
        statusDisplay.textContent = 'Não salvo';
        statusDisplay.className = 'flow-name-highlight-status draft';
        return;
    }

    if (currentFlowIsActive) {
        statusDisplay.textContent = 'Ativo';
        statusDisplay.className = 'flow-name-highlight-status active';
        return;
    }

    statusDisplay.textContent = 'Inativo';
    statusDisplay.className = 'flow-name-highlight-status inactive';
}

function renderCurrentFlowName() {
    const flowNameDisplay = document.getElementById('currentFlowNameDisplay') as HTMLElement | null;
    if (!flowNameDisplay) return;

    const name = String(currentFlowName || '').trim();
    if (name) {
        flowNameDisplay.textContent = name;
        flowNameDisplay.title = name;
        renderCurrentFlowStatusIndicator();
        return;
    }

    flowNameDisplay.textContent = currentFlowId
        ? 'Sem nome'
        : 'Novo fluxo (não salvo)';
    flowNameDisplay.title = '';
    renderCurrentFlowStatusIndicator();
}

function renderFlowSaveButtonVisibility() {
    const saveBtn = document.getElementById('flowCanvasSaveBtn') as HTMLButtonElement | null;
    if (!saveBtn) return;

    saveBtn.classList.toggle('is-hidden', !flowHasUnsavedChanges);
    saveBtn.toggleAttribute('hidden', !flowHasUnsavedChanges);
}

function setFlowDirtyState(nextDirty: boolean) {
    const normalized = !!nextDirty;
    flowHasUnsavedChanges = normalized;
    renderFlowSaveButtonVisibility();
}

function markFlowDirty() {
    if (flowHasUnsavedChanges) return;
    setFlowDirtyState(true);
}

function updateFlowStatusFromSelect() {
    const statusSelect = document.getElementById('flowStatus') as HTMLSelectElement | null;
    if (!statusSelect) return;
    const nextActive = statusSelect.value === '1';
    if (nextActive === currentFlowIsActive) return;
    setCurrentFlowActive(nextActive);
    markFlowDirty();
}

function toggleFlowActive() {
    setCurrentFlowActive(!currentFlowIsActive);
    markFlowDirty();
}

async function restoreLastFlowOrOpenModal() {
    const fallbackFlowId = currentFlowId || readLastOpenFlowId();
    if (!fallbackFlowId) {
        openFlowsModal();
        return;
    }

    const restored = await loadFlow(fallbackFlowId, {
        silent: true,
        keepModalClosed: true
    });

    if (!restored) {
        openFlowsModal();
    }
}

// Inicializacao
function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

function initFlowBuilder() {
    const canvas = document.getElementById('flowCanvas') as HTMLElement | null;
    if (!canvas) return;
    if (canvas.dataset.flowBuilderReady === '1') return;
    canvas.dataset.flowBuilderReady = '1';

    if (currentFlowId === null) {
        setCurrentFlowActive(true);
    }
    renderCurrentFlowName();
    setFlowDirtyState(false);
    bindFlowAiAssistant();
    renderFlowVariableTags();
    loadFlowVariableFields();
    loadCustomEventsCatalog({ silent: true });
    setupDragAndDrop();
    setupCanvasEvents();
    applyZoom();
    restoreLastFlowOrOpenModal();
}

onReady(initFlowBuilder);

// Configurar drag and drop dos nos
function setupDragAndDrop() {
    const nodeItems = document.querySelectorAll('.node-item');
    const flowCanvas = document.getElementById('flowCanvas') as HTMLElement | null;
    const canvasContainer = document.getElementById('canvasContainer') as HTMLElement | null;
    if (!flowCanvas) return;
    
    nodeItems.forEach(item => {
        const nodeItem = item as HTMLElement;
        if (nodeItem.dataset.flowDragBound === '1') return;
        nodeItem.dataset.flowDragBound = '1';

        nodeItem.addEventListener('dragstart', (e) => {
            e.dataTransfer?.setData('nodeType', item.dataset.type || '');
            e.dataTransfer?.setData('nodeSubtype', item.dataset.subtype || '');
        });
    });

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const type = e.dataTransfer?.getData('nodeType') || '';
        const subtype = e.dataTransfer?.getData('nodeSubtype') || '';
        if (!type) return;

        const position = clientToFlowCoords(e.clientX, e.clientY);
        const x = position.x;
        const y = position.y;

        addNode(type as NodeType, subtype, x, y);
    };

    const dropTargets = [flowCanvas, canvasContainer].filter(Boolean) as HTMLElement[];
    dropTargets.forEach((target) => {
        if (target.dataset.flowDropBound === '1') return;
        target.dataset.flowDropBound = '1';
        target.addEventListener('dragenter', handleDragOver);
        target.addEventListener('dragover', handleDragOver);
        target.addEventListener('drop', handleDrop);
    });
}

// Configurar eventos do canvas
function setupCanvasEvents() {
    const canvas = document.getElementById('flowCanvas') as HTMLElement | null;
    if (!canvas) return;

    if (canvas.dataset.flowCanvasEventsBound !== '1') {
        canvas.dataset.flowCanvasEventsBound = '1';

        canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            const target = e.target as HTMLElement | null;
            const isCanvasBackground =
                target === canvas ||
                target?.id === 'canvasContainer' ||
                target?.id === 'connectionsSvg' ||
                target?.classList.contains('connections-svg') ||
                target?.classList.contains('empty-canvas');

            if (!isCanvasBackground) return;
            startPan(e.clientX, e.clientY, canvas);
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.1 : -0.1;
            setZoom(zoom + delta);
        }, { passive: false });
    }

    if (!hasGlobalCanvasListeners) {
        document.addEventListener('mousemove', handleDocumentMouseMove);
        document.addEventListener('mouseup', handleDocumentMouseUp);
        hasGlobalCanvasListeners = true;
    }
}

// Adicionar no
function addNode(type: NodeType, subtype: string, x: number, y: number) {
    if (type === 'condition') {
        return;
    }

    const emptyCanvas = document.getElementById('emptyCanvas') as HTMLElement | null;
    if (emptyCanvas) emptyCanvas.style.display = 'none';
    
    const id = 'node_' + Date.now();
    const node: FlowNode = {
        id,
        type,
        subtype,
        position: { x, y },
        data: getDefaultNodeData(type, subtype)
    };
    
    nodes.push(node);
    renderNode(node);
    selectNode(id);
    markFlowDirty();
}

// Dados padrao do no
function getDefaultNodeData(type: NodeType, subtype?: string): NodeData {
    const defaults = {
        trigger: { label: subtype === 'keyword' || subtype === 'intent' ? 'Intenção' : 'Novo Contato', collapsed: false, keyword: '', intentRoutes: [] },
        intent: { label: 'Intenção', collapsed: false, keyword: '', intentRoutes: [] },
        message: { label: 'Mensagem', collapsed: false, content: 'Olá! Como posso ajudar?', delaySeconds: 0 },
        wait: { label: 'Aguardar Resposta', collapsed: false, timeout: 300 },
        condition: { label: 'Condição', collapsed: false, conditions: [] },
        delay: { label: 'Delay', collapsed: false, seconds: 5 },
        transfer: { label: 'Transferir', collapsed: false, message: 'Transferindo para um atendente...' },
        tag: { label: 'Adicionar Tag', collapsed: false, tag: '' },
        status: { label: 'Alterar Status', collapsed: false, status: 2 },
        webhook: { label: 'Webhook', collapsed: false, url: '' },
        event: { label: 'Registrar Evento', collapsed: false, eventId: null, eventKey: '', eventName: '' },
        end: { label: 'Fim', collapsed: false }
    };
    return defaults[type] || { label: type };
}

function getNodeOutputPortsMarkup(node: FlowNode) {
    if (node.type === 'end') return '<div></div>';

    const handles = getOutputHandles(node);
    return `
        <div class="node-output-ports">
            ${handles.map((item) => `
                <div class="node-output-port">
                    ${item.label ? `<span class="node-output-label" title="${escapeHtml(item.label)}">${escapeHtml(truncateLabel(item.label))}</span>` : ''}
                    <div class="port output" data-port="output" data-handle="${escapeHtml(item.handle)}" data-label="${escapeHtml(item.label || '')}" title="${escapeHtml(item.label || 'Saída')}"></div>
                </div>
            `).join('')}
        </div>
    `;
}

// Renderizar no
function renderNode(node: FlowNode) {
    const container = document.getElementById('canvasContainer') as HTMLElement | null;
    if (!container) return;
    
    const nodeEl = document.createElement('div');
    const isCollapsed = Boolean(node.data?.collapsed);
    nodeEl.className = `flow-node${isCollapsed ? ' is-collapsed' : ''}`;
    nodeEl.id = node.id;
    nodeEl.style.left = node.position.x + 'px';
    nodeEl.style.top = node.position.y + 'px';
    
    const icons = {
        trigger: 'icon-bolt',
        intent: 'icon-bolt',
        message: 'icon-message',
        wait: 'icon-clock',
        condition: 'icon-bolt',
        delay: 'icon-clock',
        transfer: 'icon-user',
        tag: 'icon-tag',
        status: 'icon-chart-bar',
        webhook: 'icon-link',
        event: 'icon-target',
        end: 'icon-check'
    };
    
    nodeEl.innerHTML = `
        <div class="flow-node-header ${node.type}">
            <span class="icon ${icons[node.type] || 'icon-empty'}"></span>
            <div class="title-group">
                <span class="node-kind">${escapeHtml(getNodeTypeLabel(node))}</span>
                <span class="title">${escapeHtml(String(node.data.label || '').trim() || getNodeTypeLabel(node))}</span>
            </div>
            <button class="duplicate-btn" title="Duplicar bloco" onclick="duplicateNode('${node.id}', event)">Copiar</button>
            <button class="collapse-btn" title="${isCollapsed ? 'Expandir bloco' : 'Recolher bloco'}" onclick="toggleNodeCollapsed('${node.id}', event)">
                ${isCollapsed ? '▸' : '▾'}
            </button>
            <button class="delete-btn" onclick="deleteNode('${node.id}')">&times;</button>
        </div>
        <div class="flow-node-body">
            ${escapeHtml(getNodePreview(node))}
        </div>
        <div class="flow-node-ports">
            ${node.type !== 'trigger' ? '<div class="port input" data-port="input" data-handle="default"></div>' : '<div></div>'}
            ${getNodeOutputPortsMarkup(node)}
        </div>
    `;
    
    // Eventos de arrastar
    nodeEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;

        const target = e.target as HTMLElement | null;
        if (target?.classList.contains('port')) {
            e.preventDefault();
            e.stopPropagation();
            startConnection(
                node.id,
                target.dataset.port || '',
                target.dataset.handle || DEFAULT_HANDLE,
                target.dataset.label || '',
                target
            );
            return;
        }
        if (
            target?.classList.contains('delete-btn')
            || target?.classList.contains('collapse-btn')
            || target?.classList.contains('duplicate-btn')
        ) return;
        
        isDragging = true;
        dragNode = node;
        const point = clientToFlowCoords(e.clientX, e.clientY);
        dragOffset = {
            x: point.x - node.position.x,
            y: point.y - node.position.y
        };
        selectNode(node.id);
    });
    
    container.appendChild(nodeEl);
}

function startPan(clientX: number, clientY: number, canvas: HTMLElement) {
    if (isConnecting) {
        cancelConnection();
    }

    isPanning = true;
    panStart = { x: clientX, y: clientY };
    panOrigin = { ...pan };
    canvas.classList.add('is-panning');
}

function stopPan() {
    isPanning = false;
    const canvas = document.getElementById('flowCanvas') as HTMLElement | null;
    canvas?.classList.remove('is-panning');
}

function handleDocumentMouseMove(e: MouseEvent) {
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;

    if (isPanning) {
        pan.x = panOrigin.x + (e.clientX - panStart.x);
        pan.y = panOrigin.y + (e.clientY - panStart.y);
        applyZoom();
        return;
    }

    if (isDragging && dragNode) {
        const point = clientToFlowCoords(e.clientX, e.clientY);
        const nextX = point.x - dragOffset.x;
        const nextY = point.y - dragOffset.y;
        const moved = nextX !== dragNode.position.x || nextY !== dragNode.position.y;
        dragNode.position.x = nextX;
        dragNode.position.y = nextY;

        const nodeEl = document.getElementById(dragNode.id) as HTMLElement | null;
        if (nodeEl) {
            nodeEl.style.left = dragNode.position.x + 'px';
            nodeEl.style.top = dragNode.position.y + 'px';
        }

        renderConnections();
        if (moved) {
            markFlowDirty();
        }
    }

    if (isConnecting) {
        updateConnectionPreview(e.clientX, e.clientY);
        highlightConnectionTarget(e.clientX, e.clientY);
    }
}

function handleDocumentMouseUp(e: MouseEvent) {
    isDragging = false;
    dragNode = null;

    if (isPanning) {
        stopPan();
    }

    if (!isConnecting || !connectionStart) return;

    const target = e.target instanceof Element ? e.target : null;
    const targetPort = target?.closest('.port.input') as HTMLElement | null;
    const targetNode = targetPort?.closest('.flow-node') as HTMLElement | null;

    if (targetPort && targetNode?.id) {
        endConnection(targetNode.id, targetPort.dataset.port || '');
        return;
    }

    cancelConnection();
}

function getLeadStatusLabel(value: unknown) {
    const status = Number(value);
    const labels: Record<number, string> = {
        1: 'Etapa 1 - Novo',
        2: 'Etapa 2 - Em Negociação',
        3: 'Etapa 3 - Fechado',
        4: 'Etapa 4 - Perdido'
    };
    return labels[status] || 'Etapa não definida';
}

// Preview do no
function getNodePreview(node: FlowNode) {
    switch (node.type) {
        case 'message':
            return node.data.content?.substring(0, 50) + (node.data.content?.length > 50 ? '...' : '') || 'Clique para editar';
        case 'condition':
            return `${node.data.conditions?.length || 0} condições`;
        case 'delay':
            return `Aguardar ${node.data.seconds}s`;
        case 'transfer': {
            const transferMessage = String(node.data.message || '').trim();
            if (!transferMessage) return 'Mensagem de transferência não definida';
            return transferMessage.length > 55 ? `${transferMessage.substring(0, 55)}...` : transferMessage;
        }
        case 'status':
            return getLeadStatusLabel(node.data.status);
        case 'event':
            return node.data.eventName || node.data.eventKey || 'Selecione um evento personalizado';
        case 'trigger':
        case 'intent':
            if (isIntentTrigger(node)) {
                const routes = getIntentRoutes(node);
                if (routes.length === 0) return 'Defina as intenções para iniciar o fluxo';
                return `${routes.length} intenção(ões) configurada(s)`;
            }
            return 'Novo contato';
        default:
            return '';
    }
}

// Selecionar no
function selectNode(id: string) {
    deselectNode();
    selectedNode = nodes.find(n => n.id === id);
    
    const nodeEl = document.getElementById(id);
    if (nodeEl) nodeEl.classList.add('selected');
    
    renderProperties();
}

// Deselecionar no
function deselectNode() {
    if (selectedNode) {
        const nodeEl = document.getElementById(selectedNode.id);
        if (nodeEl) nodeEl.classList.remove('selected');
    }
    selectedNode = null;
    const propertiesContent = document.getElementById('propertiesContent') as HTMLElement | null;
    if (propertiesContent) {
        propertiesContent.innerHTML = '<p style="color: var(--gray); font-size: 14px;">Selecione um bloco para editar suas propriedades</p>';
    }
}

// Deletar no
function deleteNode(id: string) {
    if (connectionStart?.nodeId === id) {
        cancelConnection();
    }

    nodes = nodes.filter(n => n.id !== id);
    edges = edges.filter(e => e.source !== id && e.target !== id);
    
    const nodeEl = document.getElementById(id);
    if (nodeEl) nodeEl.remove();
    
    if (selectedNode?.id === id) {
        deselectNode();
    }
    
    renderConnections();
    
    if (nodes.length === 0) {
        const emptyCanvas = document.getElementById('emptyCanvas') as HTMLElement | null;
        if (emptyCanvas) emptyCanvas.style.display = 'block';
    }

    markFlowDirty();
}

function duplicateNode(id: string, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();

    const sourceNode = nodes.find((node) => node.id === id);
    if (!sourceNode) return;

    const duplicate: FlowNode = {
        id: `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        type: sourceNode.type,
        subtype: sourceNode.subtype,
        position: {
            x: sourceNode.position.x + 36,
            y: sourceNode.position.y + 36
        },
        data: JSON.parse(JSON.stringify(sourceNode.data || {}))
    };

    if (typeof duplicate.data?.collapsed !== 'boolean') {
        duplicate.data.collapsed = false;
    }

    nodes.push(duplicate);
    renderNode(duplicate);
    renderConnections();
    selectNode(duplicate.id);
    markFlowDirty();
}

// Renderizar propriedades
function renderProperties() {
    if (!selectedNode) return;
    
    const container = document.getElementById('propertiesContent') as HTMLElement | null;
    if (!container) return;
    let html = '';
    const selectedTypeLabel = getNodeTypeLabel(selectedNode);
    
    html += `
        <div class="property-type-summary">
            <h4 class="property-type-summary-value">${escapeHtml(selectedTypeLabel)}</h4>
        </div>
        <div class="property-group">
            <label>Nome do Bloco</label>
            <input type="text" value="${selectedNode.data.label}" onchange="updateNodeProperty('label', this.value)">
        </div>
    `;
    
    switch (selectedNode.type) {
        case 'trigger':
        case 'intent':
            if (isIntentTrigger(selectedNode)) {
                syncIntentRoutesFromNode(selectedNode);
                const routes = getIntentRoutes(selectedNode);
                html += `
                    <div class="property-group">
                        <label>Intenções</label>
                        <div class="intent-routes-intro">Defina um título curto para a saída e as frases que devem acionar essa intenção.</div>
                        <div class="intent-routes-editor">
                            ${routes.map((route, index) => `
                                <div class="intent-route-card">
                                    <div class="intent-route-card-header">
                                        <span class="intent-route-badge">Intenção ${index + 1}</span>
                                        <button class="remove-btn" title="Remover intenção" onclick="removeIntentRoute(${index})">×</button>
                                    </div>
                                    <div class="intent-route-field">
                                        <label>Título da saída</label>
                                        <input class="intent-route-name-input" type="text" value="${escapeHtml(route.label)}" title="${escapeHtml(route.label)}" placeholder="Ex.: Comprar óculos" onchange="updateIntentRoute(${index}, 'label', this.value)">
                                    </div>
                                    <div class="intent-route-field">
                                        <label>Frases que ativam esta intenção</label>
                                        <input class="intent-route-phrases-input" type="text" value="${escapeHtml(route.phrases)}" title="${escapeHtml(route.phrases)}" placeholder="Ex.: onde posso comprar, como comprar óculos" onchange="updateIntentRoute(${index}, 'phrases', this.value)">
                                        <div class="intent-route-field-hint">Separe variações por vírgula.</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <button class="add-condition-btn" onclick="addIntentRoute()">+ Adicionar Intenção</button>
                        <div class="hint">Conecte cada saída do bloco para o caminho correspondente. A saída "Padrão" cobre casos sem match.</div>
                    </div>
                `;
            }
            break;
            
        case 'message':
            const messageDelaySeconds = Number.isFinite(Number(selectedNode.data.delaySeconds))
                ? Math.max(0, Number(selectedNode.data.delaySeconds))
                : 0;
            html += `
                <div class="property-group">
                    <label>Conteúdo da Mensagem</label>
                    <textarea id="messageContent" onchange="updateNodeProperty('content', this.value)">${selectedNode.data.content || ''}</textarea>
                    <div class="hint">Use as variáveis de Campos Dinâmicos para personalizar</div>
                </div>
                <div class="property-group">
                    <label>Delay antes de enviar (segundos)</label>
                    <input type="number" min="0" step="1" value="${messageDelaySeconds}" onchange="updateNodeProperty('delaySeconds', Math.max(0, parseInt(this.value || '0', 10) || 0))">
                    <div class="hint">Use 0 para envio imediato</div>
                </div>
            `;
            break;
            
        case 'wait':
            html += `
                <div class="property-group">
                    <label>Timeout (segundos)</label>
                    <input type="number" value="${selectedNode.data.timeout || 300}" onchange="updateNodeProperty('timeout', parseInt(this.value))">
                    <div class="hint">Tempo máximo de espera pela resposta</div>
                </div>
            `;
            break;
            
        case 'condition':
            html += `
                <div class="property-group">
                    <label>Condições</label>
                    <div class="conditions-editor" id="conditionsEditor">
                        ${(selectedNode.data.conditions || []).map((c, i) => `
                            <div class="condition-row">
                                <input type="text" value="${c.value}" placeholder="Valor" onchange="updateCondition(${i}, 'value', this.value)">
                                <button class="remove-btn" onclick="removeCondition(${i})">×</button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="add-condition-btn" onclick="addCondition()">+ Adicionar Condição</button>
                </div>
            `;
            break;
            
        case 'delay':
            html += `
                <div class="property-group">
                    <label>Tempo de Espera (segundos)</label>
                    <input type="number" value="${selectedNode.data.seconds || 5}" onchange="updateNodeProperty('seconds', parseInt(this.value))">
                </div>
            `;
            break;
            
        case 'transfer':
            html += `
                <div class="property-group">
                    <label>Mensagem de Transferência</label>
                    <textarea onchange="updateNodeProperty('message', this.value)">${selectedNode.data.message || ''}</textarea>
                </div>
            `;
            break;
            
        case 'tag':
            html += `
                <div class="property-group">
                    <label>Nome da Tag</label>
                    <input type="text" value="${selectedNode.data.tag || ''}" onchange="updateNodeProperty('tag', this.value)">
                </div>
            `;
            break;
            
        case 'status':
            html += `
                <div class="property-group">
                    <label>Novo Status</label>
                    <select onchange="updateNodeProperty('status', parseInt(this.value))">
                        <option value="1" ${selectedNode.data.status === 1 ? 'selected' : ''}>Etapa 1 - Novo</option>
                        <option value="2" ${selectedNode.data.status === 2 ? 'selected' : ''}>Etapa 2 - Em Negociação</option>
                        <option value="3" ${selectedNode.data.status === 3 ? 'selected' : ''}>Etapa 3 - Fechado</option>
                        <option value="4" ${selectedNode.data.status === 4 ? 'selected' : ''}>Etapa 4 - Perdido</option>
                    </select>
                </div>
            `;
            break;

        case 'event':
            const availableEvents = getAvailableCustomEvents();
            const selectedEventId = Number(selectedNode.data.eventId);
            const selectedEvent = availableEvents.find((item) => Number(item.id) === selectedEventId) || null;

            html += `
                <div class="property-group">
                    <label>Evento Personalizado</label>
                    <select onchange="updateEventNodeSelection(this.value)">
                        <option value="">Selecione um evento</option>
                        ${availableEvents.map((eventItem) => `
                            <option value="${eventItem.id}" ${Number(eventItem.id) === selectedEventId ? 'selected' : ''}>
                                ${escapeHtml(eventItem.name)}
                            </option>
                        `).join('')}
                    </select>
                    <div class="hint">Crie eventos em Painel de Controle &gt; Eventos personalizados.</div>
                    ${selectedEvent?.event_key ? `<div class="hint">Chave: <code>${escapeHtml(selectedEvent.event_key)}</code></div>` : ''}
                    <button class="add-condition-btn" style="margin-top: 8px;" onclick="reloadCustomEventsCatalog()">Atualizar lista</button>
                </div>
            `;

            if (availableEvents.length === 0) {
                html += `
                    <div class="property-group">
                        <div class="hint">Nenhum evento ativo cadastrado no momento.</div>
                    </div>
                `;
            }
            break;
            
        case 'webhook':
            html += `
                <div class="property-group">
                    <label>URL do Webhook</label>
                    <input type="url" value="${selectedNode.data.url || ''}" onchange="updateNodeProperty('url', this.value)" placeholder="https://...">
                </div>
            `;
            break;
    }
    
    container.innerHTML = html;
}

// Atualizar propriedade do no
function updateNodeProperty(key: keyof NodeData, value: any) {
    if (!selectedNode) return;
    
    selectedNode.data[key] = value;

    if (isIntentTrigger(selectedNode) && key === 'keyword') {
        selectedNode.data.intentRoutes = parsePhraseList(String(value || '')).map((phrase, index) => ({
            id: normalizeRouteId(`intent-${index + 1}`),
            label: phrase,
            phrases: phrase
        }));
    }

    rerenderNode(selectedNode.id);
    markFlowDirty();
}

function updateEventNodeSelection(value: string) {
    if (!selectedNode || selectedNode.type !== 'event') return;

    const eventId = Number.parseInt(String(value || '').trim(), 10);
    if (!Number.isFinite(eventId) || eventId <= 0) {
        selectedNode.data.eventId = null;
        selectedNode.data.eventKey = '';
        selectedNode.data.eventName = '';
        rerenderNode(selectedNode.id);
        renderProperties();
        markFlowDirty();
        return;
    }

    const selected = customEventsCache.find((item) => Number(item.id) === eventId);
    selectedNode.data.eventId = eventId;
    selectedNode.data.eventKey = String(selected?.event_key || '').trim();
    selectedNode.data.eventName = String(selected?.name || '').trim();
    rerenderNode(selectedNode.id);
    renderProperties();
    markFlowDirty();
}

function rerenderNode(nodeId: string) {
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) return;

    const wasSelected = selectedNode?.id === nodeId;
    const oldNodeEl = document.getElementById(nodeId);
    oldNodeEl?.remove();

    renderNode(node);

    if (wasSelected) {
        const nodeEl = document.getElementById(nodeId);
        nodeEl?.classList.add('selected');
    }

    cleanupInvalidEdgesForNode(nodeId);
    renderConnections();
}

function getNodeSize(nodeId: string) {
    const nodeEl = document.getElementById(nodeId) as HTMLElement | null;
    return {
        width: nodeEl?.offsetWidth || 220,
        height: nodeEl?.offsetHeight || 120
    };
}

function applyNodePosition(node: FlowNode) {
    const nodeEl = document.getElementById(node.id) as HTMLElement | null;
    if (!nodeEl) return;
    nodeEl.style.left = `${node.position.x}px`;
    nodeEl.style.top = `${node.position.y}px`;
}

function resolveNodeCollisions() {
    const minGap = 24;
    const maxIterations = 16;

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        let moved = false;
        const ordered = [...nodes].sort((a, b) => a.position.y - b.position.y);

        for (let i = 0; i < ordered.length; i += 1) {
            const upper = ordered[i];
            const upperSize = getNodeSize(upper.id);

            for (let j = i + 1; j < ordered.length; j += 1) {
                const lower = ordered[j];
                const lowerSize = getNodeSize(lower.id);

                const overlapX = !(
                    upper.position.x + upperSize.width + minGap <= lower.position.x
                    || lower.position.x + lowerSize.width + minGap <= upper.position.x
                );
                if (!overlapX) continue;

                const requiredY = upper.position.y + upperSize.height + minGap;
                if (lower.position.y >= requiredY) continue;

                lower.position.y = requiredY;
                applyNodePosition(lower);
                moved = true;
            }
        }

        if (!moved) break;
    }
}

function adjustNodesForResize(anchorId: string, deltaHeight: number) {
    if (!deltaHeight) return;

    const anchor = nodes.find((node) => node.id === anchorId);
    if (!anchor) return;

    const anchorSize = getNodeSize(anchorId);
    const anchorCenterX = anchor.position.x + anchorSize.width / 2;
    const horizontalSlack = 140;

    nodes.forEach((node) => {
        if (node.id === anchorId) return;
        if (node.position.y <= anchor.position.y) return;

        const nodeSize = getNodeSize(node.id);
        const nodeCenterX = node.position.x + nodeSize.width / 2;
        const isNearHorizontally = Math.abs(anchorCenterX - nodeCenterX) <= ((anchorSize.width + nodeSize.width) / 2 + horizontalSlack);
        if (!isNearHorizontally) return;

        node.position.y = Math.max(0, node.position.y + deltaHeight);
        applyNodePosition(node);
    });

    resolveNodeCollisions();
    renderConnections();
}

function toggleNodeCollapsed(id: string, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();

    const node = nodes.find((item) => item.id === id);
    if (!node) return;

    const previousHeight = getNodeSize(id).height;
    node.data.collapsed = !Boolean(node.data?.collapsed);
    rerenderNode(id);
    const currentHeight = getNodeSize(id).height;
    const deltaHeight = currentHeight - previousHeight;

    if (deltaHeight) {
        adjustNodesForResize(id, deltaHeight);
    }

    if (selectedNode?.id === id) {
        renderProperties();
    }

    markFlowDirty();
}

function cleanupInvalidEdgesForNode(nodeId: string) {
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) return;

    const validHandles = new Set(getOutputHandles(node).map((item) => edgeHandle(item.handle)));
    edges = edges.filter((edge) => {
        if (edge.source !== nodeId) return true;
        return validHandles.has(edgeHandle(edge.sourceHandle));
    });
}

function addIntentRoute() {
    if (!selectedNode || !isIntentTrigger(selectedNode)) return;
    syncIntentRoutesFromNode(selectedNode);

    const nextIndex = (selectedNode.data.intentRoutes?.length || 0) + 1;
    const nextRoute = {
        id: normalizeRouteId(`intent-${Date.now()}-${nextIndex}`),
        label: `Intenção ${nextIndex}`,
        phrases: ''
    };

    selectedNode.data.intentRoutes = [...(selectedNode.data.intentRoutes || []), nextRoute];
    syncIntentRoutesFromNode(selectedNode);
    rerenderNode(selectedNode.id);
    renderProperties();
    markFlowDirty();
}

function updateIntentRoute(index: number, key: 'label' | 'phrases', value: string) {
    if (!selectedNode || !isIntentTrigger(selectedNode)) return;
    syncIntentRoutesFromNode(selectedNode);

    if (!selectedNode.data.intentRoutes?.[index]) return;
    selectedNode.data.intentRoutes[index][key] = String(value || '');
    syncIntentRoutesFromNode(selectedNode);
    rerenderNode(selectedNode.id);
    renderProperties();
    markFlowDirty();
}

function removeIntentRoute(index: number) {
    if (!selectedNode || !isIntentTrigger(selectedNode)) return;
    syncIntentRoutesFromNode(selectedNode);

    if (!selectedNode.data.intentRoutes) return;
    selectedNode.data.intentRoutes.splice(index, 1);
    syncIntentRoutesFromNode(selectedNode);
    rerenderNode(selectedNode.id);
    renderProperties();
    markFlowDirty();
}

// Condicoes
function addCondition() {
    if (!selectedNode || selectedNode.type !== 'condition') return;
    
    if (!selectedNode.data.conditions) {
        selectedNode.data.conditions = [];
    }
    
    selectedNode.data.conditions.push({ value: '', next: '' });
    renderProperties();
    markFlowDirty();
}

function updateCondition(index: number, key: 'value' | 'next', value: string) {
    if (!selectedNode) return;
    selectedNode.data.conditions[index][key] = value;
    markFlowDirty();
}

function removeCondition(index: number) {
    if (!selectedNode) return;
    selectedNode.data.conditions.splice(index, 1);
    renderProperties();
    markFlowDirty();
}

// Inserir variavel
function insertVariable(variable: string) {
    const textarea = document.getElementById('messageContent') as HTMLTextAreaElement | null;
    if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        textarea.value = text.substring(0, start) + `{{${variable}}}` + text.substring(end);
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + variable.length + 4;
        updateNodeProperty('content', textarea.value);
    }
}

// Conexoes
function startConnection(
    nodeId: string,
    portType: string,
    handle = DEFAULT_HANDLE,
    label = '',
    sourcePortOverride?: HTMLElement | null
) {
    if (portType !== 'output') return;

    const sourceNode = document.getElementById(nodeId);
    const sourcePort = sourcePortOverride
        || (sourceNode ? findPortByHandle(sourceNode, '.port.output', handle) : null);
    const svg = document.getElementById('connectionsSvg') as SVGSVGElement | null;
    if (!sourcePort || !svg) return;

    cancelConnection();

    isConnecting = true;
    connectionStart = {
        nodeId,
        portType,
        handle: edgeHandle(handle),
        label: String(label || '').trim()
    };
    connectionStartPort = sourcePort;
    connectionStartPort.classList.add('is-connecting');

    connectionPreviewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    connectionPreviewPath.setAttribute('class', 'connection-line connection-line-preview');

    const sourcePoint = getPortCenter(sourcePort, svg);
    const sourceRect = sourcePort.getBoundingClientRect();
    lastPointer = {
        x: sourceRect.left + sourceRect.width / 2,
        y: sourceRect.top + sourceRect.height / 2
    };
    connectionPreviewPath.setAttribute('d', buildConnectionPath(sourcePoint.x, sourcePoint.y, sourcePoint.x, sourcePoint.y));
    svg.appendChild(connectionPreviewPath);
}

function endConnection(nodeId: string, portType: string) {
    if (!isConnecting || !connectionStart) return;

    if (portType !== 'input' || connectionStart.nodeId === nodeId) {
        cancelConnection();
        return;
    }

    const newEdge: Edge = {
        source: connectionStart.nodeId,
        target: nodeId,
        sourceHandle: edgeHandle(connectionStart.handle),
        targetHandle: DEFAULT_HANDLE,
        label: connectionStart.label || undefined
    };
    const exists = edges.some((edge) => isSameEdge(edge, newEdge));
    if (!exists) {
        const sourceNode = nodes.find((node) => node.id === newEdge.source);
        if (isIntentTrigger(sourceNode)) {
            edges = edges.filter((edge) => !(
                edge.source === newEdge.source
                && edgeHandle(edge.sourceHandle) === edgeHandle(newEdge.sourceHandle)
            ));
        }

        edges.push(newEdge);
        renderConnections();
        if (selectedNode?.id === newEdge.source) {
            renderProperties();
        }
        markFlowDirty();
    }

    cancelConnection();
}

function cancelConnection() {
    isConnecting = false;
    connectionStart = null;
    connectionStartPort?.classList.remove('is-connecting');
    connectionStartPort = null;
    connectionPreviewPath?.remove();
    connectionPreviewPath = null;
    clearConnectionTargetHighlights();
}

function updateConnectionPreview(clientX: number, clientY: number) {
    if (!isConnecting || !connectionStartPort || !connectionPreviewPath) return;

    const svg = document.getElementById('connectionsSvg') as SVGSVGElement | null;
    if (!svg) return;

    const sourcePoint = getPortCenter(connectionStartPort, svg);
    const targetPoint = getCanvasPointFromClient(clientX, clientY, svg);
    connectionPreviewPath.setAttribute('d', buildConnectionPath(sourcePoint.x, sourcePoint.y, targetPoint.x, targetPoint.y));
}

function highlightConnectionTarget(clientX: number, clientY: number) {
    clearConnectionTargetHighlights();

    const hovered = document.elementFromPoint(clientX, clientY);
    if (!(hovered instanceof Element)) return;

    const hoveredPort = hovered.closest('.port.input') as HTMLElement | null;
    const hoveredNode = hoveredPort?.closest('.flow-node') as HTMLElement | null;
    if (!hoveredPort || !hoveredNode?.id) return;
    if (hoveredNode.id === connectionStart?.nodeId) return;

    hoveredPort.classList.add('connection-target');
}

function clearConnectionTargetHighlights() {
    document.querySelectorAll('.port.connection-target').forEach((port) => {
        port.classList.remove('connection-target');
    });
}

function getCanvasPointFromClient(clientX: number, clientY: number, svg: SVGSVGElement) {
    const canvasRect = svg.getBoundingClientRect();
    return {
        x: clientX - canvasRect.left,
        y: clientY - canvasRect.top
    };
}

function getPortCenter(port: HTMLElement, svg: SVGSVGElement) {
    const rect = port.getBoundingClientRect();
    return getCanvasPointFromClient(rect.left + rect.width / 2, rect.top + rect.height / 2, svg);
}

function buildConnectionPath(x1: number, y1: number, x2: number, y2: number) {
    const curve = Math.max(Math.abs(x2 - x1) * 0.5, 40);
    return `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`;
}

function renderConnections() {
    const svg = document.getElementById('connectionsSvg') as SVGSVGElement | null;
    if (!svg) return;
    svg.innerHTML = '';

    edges.forEach(edge => {
        const sourceNode = document.getElementById(edge.source);
        const targetNode = document.getElementById(edge.target);

        if (!sourceNode || !targetNode) return;

        const sourcePort = findPortByHandle(sourceNode, '.port.output', edge.sourceHandle);
        const targetPort = findPortByHandle(targetNode, '.port.input', edge.targetHandle);

        if (!sourcePort || !targetPort) return;

        const sourcePoint = getPortCenter(sourcePort, svg);
        const targetPoint = getPortCenter(targetPort, svg);
        const pathData = buildConnectionPath(sourcePoint.x, sourcePoint.y, targetPoint.x, targetPoint.y);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('class', 'connection-line');

        const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitPath.setAttribute('d', pathData);
        hitPath.setAttribute('class', 'connection-hit');
        hitPath.setAttribute('data-source', edge.source);
        hitPath.setAttribute('data-target', edge.target);

        const removeConnection = () => {
            edges = edges.filter((item) => !isSameEdge(item, edge));
            renderConnections();
            markFlowDirty();
        };

        hitPath.addEventListener('mouseenter', () => {
            path.classList.add('is-hover');
        });

        hitPath.addEventListener('mouseleave', () => {
            path.classList.remove('is-hover');
        });

        hitPath.addEventListener('click', (event) => {
            event.stopPropagation();
            removeConnection();
        });

        svg.appendChild(path);
        svg.appendChild(hitPath);
    });

    if (isConnecting && connectionPreviewPath && connectionStartPort) {
        svg.appendChild(connectionPreviewPath);
        const sourcePoint = getPortCenter(connectionStartPort, svg);
        const targetPoint = getCanvasPointFromClient(lastPointer.x, lastPointer.y, svg);
        connectionPreviewPath.setAttribute('d', buildConnectionPath(sourcePoint.x, sourcePoint.y, targetPoint.x, targetPoint.y));
    }
}

function setZoom(value: number) {
    zoom = Math.max(0.3, Math.min(value, 2));
    applyZoom();
}

function zoomIn() {
    zoom = Math.min(zoom + 0.1, 2);
    applyZoom();
}

function zoomOut() {
    zoom = Math.max(zoom - 0.1, 0.3);
    applyZoom();
}

function resetZoom() {
    zoom = 1;
    pan = { x: 0, y: 0 };
    applyZoom();
}

function applyZoom() {
    const container = document.getElementById('canvasContainer') as HTMLElement | null;
    const zoomLevel = document.getElementById('zoomLevel') as HTMLElement | null;
    if (container) container.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    if (zoomLevel) zoomLevel.textContent = Math.round(zoom * 100) + '%';
    renderConnections();
}

// Limpar canvas
async function clearCanvas() {
    if (!await showFlowConfirmDialog('Limpar todo o fluxo?', 'Limpar fluxo')) return;
    resetEditorState();
}

function resetEditorState() {
    cancelConnection();
    stopPan();
    deselectNode();

    nodes = [];
    edges = [];
    currentFlowId = null;
    currentFlowName = '';
    currentFlowIsActive = true;
    zoom = 1;
    pan = { x: 0, y: 0 };

    const canvasContainer = document.getElementById('canvasContainer') as HTMLElement | null;
    if (canvasContainer) {
        canvasContainer.innerHTML = `
        <div class="empty-canvas" id="emptyCanvas">
            <div class="icon icon-flows"></div>
            <h3>Arraste os blocos para começar</h3>
            <p>Crie seu fluxo de automação visual</p>
        </div>
    `;
    }

    const connectionsSvg = document.getElementById('connectionsSvg') as HTMLElement | null;
    if (connectionsSvg) connectionsSvg.innerHTML = '';

    renderFlowStatusControls();
    renderCurrentFlowName();
    setFlowDirtyState(false);
    applyZoom();
}

function buildTriggerPayload(trigger?: FlowNode) {
    if (!trigger) {
        return { triggerType: 'manual', triggerValue: null as string | null };
    }

    const subtype = String(trigger.subtype || '').trim().toLowerCase();
    if (subtype === 'keyword' || subtype === 'intent') {
        syncIntentRoutesFromNode(trigger);
        const routes = getIntentRoutes(trigger);
        const allPhrases = routes.flatMap((route) => parsePhraseList(route.phrases));
        const uniquePhrases = Array.from(new Set(allPhrases));
        return {
            triggerType: 'keyword',
            triggerValue: uniquePhrases.length > 0 ? uniquePhrases.join(', ') : null
        };
    }

    return {
        triggerType: subtype || 'manual',
        triggerValue: trigger.data?.keyword || null
    };
}

function normalizeLoadedFlowData() {
    nodes = nodes.map((node) => {
        if (typeof node.data?.collapsed !== 'boolean') {
            node.data.collapsed = false;
        }
        if (!String(node.data?.label || '').trim()) {
            node.data.label = getNodeTypeLabel(node);
        }
        if (node.type === 'message') {
            const rawDelay = Number(node.data?.delaySeconds);
            node.data.delaySeconds = Number.isFinite(rawDelay) ? Math.max(0, rawDelay) : 0;
        }

        if (node.type === 'event') {
            const legacyEventId = Number((node.data as any)?.event_id);
            const rawEventId = Number(node.data?.eventId);
            const normalizedEventId = Number.isFinite(rawEventId) && rawEventId > 0
                ? Math.trunc(rawEventId)
                : (Number.isFinite(legacyEventId) && legacyEventId > 0 ? Math.trunc(legacyEventId) : null);
            const legacyEventKey = String((node.data as any)?.event_key || '').trim();
            const legacyEventName = String((node.data as any)?.event_name || '').trim();

            node.data.eventId = normalizedEventId;
            node.data.eventKey = String(node.data?.eventKey || legacyEventKey || '').trim();
            node.data.eventName = String(node.data?.eventName || legacyEventName || '').trim();
            if (!String(node.data?.label || '').trim()) {
                node.data.label = 'Registrar Evento';
            }
            syncEventNodeData(node);
        }

        if (isIntentTrigger(node)) {
            if (node.type === 'trigger') {
                node.subtype = 'keyword';
            }
            if (!node.data.label || node.data.label.toLowerCase() === 'palavra-chave') {
                node.data.label = 'Intenção';
            }
            syncIntentRoutesFromNode(node);
        }
        return node;
    });

    edges = (edges || []).map((edge) => ({
        ...edge,
        sourceHandle: edgeHandle(edge.sourceHandle),
        targetHandle: edgeHandle(edge.targetHandle)
    }));
}

// Salvar fluxo
async function saveFlow() {
    let name = String(currentFlowName || '').trim();
    if (!name) {
        const typedName = await showFlowPromptDialog('Digite um nome para o fluxo:', {
            title: 'Salvar fluxo',
            defaultValue: 'Novo Fluxo',
            placeholder: 'Nome do fluxo',
            confirmLabel: 'Salvar'
        });
        if (!typedName) return;
        name = typedName.trim();
    }
    if (!name) {
        await showFlowAlertDialog('Digite um nome para o fluxo', 'Salvar fluxo');
        return;
    }

    if (nodes.length === 0) {
        await showFlowAlertDialog('Adicione pelo menos um bloco ao fluxo', 'Salvar fluxo');
        return;
    }

    const token = getSessionToken();
    if (!token) {
        await showFlowAlertDialog('Sessão expirada. Faça login novamente.', 'Sessao');
        return;
    }

    const trigger = nodes.find(n => n.type === 'trigger');
    const triggerPayload = buildTriggerPayload(trigger);

    const flowData = {
        name,
        description: '',
        trigger_type: triggerPayload.triggerType,
        trigger_value: triggerPayload.triggerValue,
        nodes,
        edges,
        is_active: currentFlowIsActive ? 1 : 0
    };

    try {
        const url = currentFlowId ? `/api/flows/${currentFlowId}` : '/api/flows';
        const method = currentFlowId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: buildAuthHeaders(true),
            body: JSON.stringify(flowData)
        });

        const result = await response.json();

        if (result.success) {
            currentFlowId = result.flow.id;
            currentFlowName = String(result.flow?.name || name).trim();
            persistLastOpenFlowId(currentFlowId);
            setCurrentFlowActive(result.flow?.is_active);
            renderCurrentFlowName();
            setFlowDirtyState(false);
            notify('success', 'Sucesso', 'Fluxo salvo com sucesso!');
        } else {
            await showFlowAlertDialog('Erro ao salvar: ' + result.error, 'Salvar fluxo');
        }
    } catch (error) {
        await showFlowAlertDialog('Erro ao salvar fluxo: ' + (error instanceof Error ? error.message : 'Falha inesperada'), 'Salvar fluxo');
    }
}

// Carregar fluxos
async function loadFlows() {
    const container = document.getElementById('flowsList') as HTMLElement | null;
    if (container) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray);">Carregando fluxos...</p>';
    }

    try {
        const response = await fetch('/api/flows', {
            headers: buildAuthHeaders(false)
        });
        const result = await response.json();

        if (result.success) {
            renderFlowsList(result.flows as FlowSummary[]);
        } else {
            renderFlowsError(result.error || 'Não foi possível carregar os fluxos.');
        }
    } catch (error) {
        renderFlowsError(error instanceof Error ? error.message : 'Falha ao carregar fluxos.');
    }
}

function renderFlowsError(message: string) {
    const container = document.getElementById('flowsList') as HTMLElement | null;
    if (!container) return;
    container.innerHTML = `<p style="text-align: center; color: var(--danger);">${message}</p>`;
}

// Renderizar lista de fluxos
function renderFlowsList(flows: FlowSummary[]) {
    const container = document.getElementById('flowsList') as HTMLElement | null;
    if (!container) return;
    flowsCache = Array.isArray(flows) ? [...flows] : [];

    if (renamingFlowId !== null && !flowsCache.some((flow) => Number(flow.id) === Number(renamingFlowId))) {
        renamingFlowId = null;
        renamingFlowDraft = '';
    }

    if (flows.length === 0) {
        container.innerHTML = '<p class="flow-list-empty">Nenhum fluxo criado ainda. Crie um novo para começar.</p>';
        return;
    }

    const getTriggerLabel = (triggerType?: string) => {
        if (triggerType === 'keyword') return 'intenção';
        if (triggerType === 'new_contact') return 'novo contato';
        if (triggerType === 'manual') return 'manual';
        return triggerType || 'manual';
    };

    container.innerHTML = flows.map(flow => {
        const isActive = toBoolean(flow.is_active, true);
        const isCurrent = Number(flow.id) === Number(currentFlowId);
        const isRenaming = Number(flow.id) === Number(renamingFlowId);
        const flowName = String(flow.name || '').trim() || 'Sem nome';
        const escapedFlowName = escapeHtml(flowName);
        const encodedName = encodeURIComponent(flowName);
        const inputValue = escapeHtml(renamingFlowDraft);
        return `
        <div class="flow-list-item ${isCurrent ? 'is-current' : ''} ${isRenaming ? 'is-renaming' : ''}" onclick="loadFlow(${flow.id})">
            <div class="icon icon-flows"></div>
            <div class="info">
                ${isRenaming
                    ? `
                        <div class="name-row name-row-editing" onclick="event.stopPropagation()">
                            <input
                                type="text"
                                id="flowRenameInput-${flow.id}"
                                class="flow-inline-name-input"
                                value="${inputValue}"
                                oninput="updateRenameFlowDraft(this.value)"
                                onkeydown="handleRenameFlowKeydown(${flow.id}, event)"
                                onclick="event.stopPropagation()"
                            />
                            <div class="flow-inline-actions">
                                <button class="flow-inline-icon flow-inline-icon-save" title="Salvar nome" onclick="saveFlowRenameInline(${flow.id}, event)">✓</button>
                                <button class="flow-inline-icon flow-inline-icon-cancel" title="Cancelar edição" onclick="cancelRenameFlow(event)">×</button>
                            </div>
                        </div>
                    `
                    : `
                        <div class="name-row">
                            <div class="name">${escapedFlowName}</div>
                            <button class="flow-inline-icon" title="Editar nome" onclick="renameFlow(${flow.id}, decodeURIComponent('${encodedName}'), event)">
                                <span class="icon icon-edit icon-sm"></span>
                            </button>
                        </div>
                    `
                }
                <div class="meta">Gatilho: ${getTriggerLabel(flow.trigger_type)} | ${flow.nodes?.length || 0} blocos | ${isActive ? 'Ativo' : 'Inativo'}</div>
            </div>
            <div class="flow-list-actions">
                <button class="flow-list-btn flow-list-toggle ${isActive ? 'is-active' : 'is-inactive'}" title="${isActive ? 'Desativar fluxo' : 'Ativar fluxo'}" onclick="toggleFlowActivation(${flow.id}, event)">
                    ${isActive ? 'Desativar' : 'Ativar'}
                </button>
                <button class="flow-list-btn flow-list-icon-btn flow-list-duplicate" title="Duplicar fluxo" onclick="duplicateFlow(${flow.id}, event)">
                    <span class="icon icon-templates icon-sm"></span>
                </button>
                <button class="flow-list-btn flow-list-icon-btn flow-list-delete" title="Descartar fluxo" onclick="discardFlow(${flow.id}, event)">
                    <span class="icon icon-delete icon-sm"></span>
                </button>
            </div>
        </div>
    `;
    }).join('');
}

function focusRenameFlowInput(id: number) {
    setTimeout(() => {
        const input = document.getElementById(`flowRenameInput-${id}`) as HTMLInputElement | null;
        if (!input) return;
        input.focus();
        input.select();
    }, 0);
}

function renameFlow(id: number, currentName = '', event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();

    renamingFlowId = Number(id);
    renamingFlowDraft = String(currentName || '').trim();
    renderFlowsList(flowsCache);
    focusRenameFlowInput(id);
}

function updateRenameFlowDraft(value: string) {
    renamingFlowDraft = String(value || '');
}

function cancelRenameFlow(event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    renamingFlowId = null;
    renamingFlowDraft = '';
    renderFlowsList(flowsCache);
}

function handleRenameFlowKeydown(id: number, event?: KeyboardEvent) {
    event?.stopPropagation();
    if (!event) return;

    if (event.key === 'Enter') {
        event.preventDefault();
        void saveFlowRenameInline(id, event);
        return;
    }

    if (event.key === 'Escape') {
        event.preventDefault();
        cancelRenameFlow(event);
    }
}

async function saveFlowRenameInline(id: number, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();

    const flowId = Number(id);
    if (!Number.isFinite(flowId)) return;

    const input = document.getElementById(`flowRenameInput-${flowId}`) as HTMLInputElement | null;
    const nextName = String(input?.value ?? renamingFlowDraft).trim();
    if (!nextName) {
        await showFlowAlertDialog('O nome do fluxo não pode ficar vazio.', 'Renomear fluxo');
        focusRenameFlowInput(flowId);
        return;
    }

    const currentFlow = flowsCache.find((flow) => Number(flow.id) === flowId);
    const currentName = String(currentFlow?.name || '').trim();
    if (currentName && currentName === nextName) {
        cancelRenameFlow();
        return;
    }

    try {
        const response = await fetch(`/api/flows/${flowId}`, {
            method: 'PUT',
            headers: buildAuthHeaders(true),
            body: JSON.stringify({ name: nextName })
        });
        const result = await response.json();

        if (!result.success) {
            await showFlowAlertDialog('Erro ao renomear fluxo: ' + (result.error || 'Falha inesperada'), 'Renomear fluxo');
            return;
        }

        if (Number(currentFlowId) === Number(flowId)) {
            currentFlowName = nextName;
            renderCurrentFlowName();
        }

        renamingFlowId = null;
        renamingFlowDraft = '';
        await loadFlows();
    } catch (error) {
        await showFlowAlertDialog('Erro ao renomear fluxo: ' + (error instanceof Error ? error.message : 'Falha inesperada'), 'Renomear fluxo');
    }
}

async function toggleFlowActivation(id: number, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();

    const targetFlow = (await (async () => {
        try {
            const response = await fetch(`/api/flows/${id}`, {
                headers: buildAuthHeaders(false)
            });
            const result = await response.json();
            if (!result.success) return null;
            return result.flow as FlowSummary | null;
        } catch {
            return null;
        }
    })());

    if (!targetFlow) {
        await showFlowAlertDialog('Não foi possível localizar o fluxo para alterar status.', 'Status do fluxo');
        return;
    }

    const nextActive = !toBoolean(targetFlow.is_active, true);

    try {
        const response = await fetch(`/api/flows/${id}`, {
            method: 'PUT',
            headers: buildAuthHeaders(true),
            body: JSON.stringify({ is_active: nextActive ? 1 : 0 })
        });
        const result = await response.json();

        if (!result.success) {
            await showFlowAlertDialog('Erro ao atualizar status: ' + (result.error || 'Falha inesperada'), 'Status do fluxo');
            return;
        }

        if (currentFlowId === id) {
            setCurrentFlowActive(nextActive);
        }

        await loadFlows();
    } catch (error) {
        await showFlowAlertDialog('Erro ao atualizar status: ' + (error instanceof Error ? error.message : 'Falha inesperada'), 'Status do fluxo');
    }
}

async function duplicateFlow(id: number, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();

    try {
        const response = await fetch(`/api/flows/${id}`, {
            headers: buildAuthHeaders(false)
        });
        const result = await response.json();

        if (!result.success) {
            await showFlowAlertDialog('Erro ao duplicar fluxo: ' + (result.error || 'Falha inesperada'), 'Duplicar fluxo');
            return;
        }

        resetEditorState();
        closeFlowsModal();

        const flow = result.flow || {};
        nodes = flow.nodes || [];
        edges = flow.edges || [];
        normalizeLoadedFlowData();
        currentFlowId = null;
        currentFlowName = `${flow.name || 'Fluxo'} (copia)`;
        setCurrentFlowActive(flow?.is_active);
        renderCurrentFlowName();
        setFlowDirtyState(true);

        nodes.forEach(node => renderNode(node));
        setTimeout(() => renderConnections(), 100);
    } catch (error) {
        await showFlowAlertDialog('Erro ao duplicar fluxo: ' + (error instanceof Error ? error.message : 'Falha inesperada'), 'Duplicar fluxo');
    }
}

async function discardFlow(id: number, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();

    if (!await showFlowConfirmDialog('Descartar este fluxo? Esta ação não pode ser desfeita.', 'Descartar fluxo')) return;

    try {
        const response = await fetch(`/api/flows/${id}`, {
            method: 'DELETE',
            headers: buildAuthHeaders(false)
        });
        const result = await response.json();

        if (!result.success) {
            await showFlowAlertDialog('Erro ao descartar fluxo: ' + (result.error || 'Falha inesperada'), 'Descartar fluxo');
            return;
        }

        if (currentFlowId === id) {
            resetEditorState();
            persistLastOpenFlowId(null);
        }

        await loadFlows();
    } catch (error) {
        await showFlowAlertDialog('Erro ao descartar fluxo: ' + (error instanceof Error ? error.message : 'Falha inesperada'), 'Descartar fluxo');
    }
}

type LoadFlowOptions = {
    silent?: boolean;
    keepModalClosed?: boolean;
};

// Carregar fluxo
async function loadFlow(id: number, options: LoadFlowOptions = {}): Promise<boolean> {
    try {
        const response = await fetch(`/api/flows/${id}`, {
            headers: buildAuthHeaders(false)
        });
        const result = await response.json();
        
        if (result.success) {
            resetEditorState();
            if (!options.keepModalClosed) {
                closeFlowsModal();
            }

            // Limpar canvas
            const canvasContainer = document.getElementById('canvasContainer') as HTMLElement | null;
            const connectionsSvg = document.getElementById('connectionsSvg') as HTMLElement | null;
            if (canvasContainer) canvasContainer.innerHTML = '';
            if (connectionsSvg) connectionsSvg.innerHTML = '';
            document.getElementById('emptyCanvas')?.remove();
            
            // Carregar dados
            currentFlowId = result.flow.id;
            currentFlowName = String(result.flow?.name || '').trim();
            persistLastOpenFlowId(currentFlowId);
            nodes = result.flow.nodes || [];
            edges = result.flow.edges || [];
            normalizeLoadedFlowData();
            await loadCustomEventsCatalog({ silent: true });
            setCurrentFlowActive(result.flow?.is_active);
            renderCurrentFlowName();
            setFlowDirtyState(false);
            
            // Renderizar nós
            nodes.forEach(node => renderNode(node));
            
            // Renderizar conexões
            setTimeout(() => renderConnections(), 100);
            return true;
        } else {
            if (response.status === 404) {
                persistLastOpenFlowId(null);
            }
            if (!options.silent) {
                await showFlowAlertDialog('Erro ao carregar fluxo: ' + result.error, 'Carregar fluxo');
            }
            return false;
        }
    } catch (error) {
        if (!options.silent) {
            await showFlowAlertDialog('Erro ao carregar fluxo: ' + (error instanceof Error ? error.message : 'Falha inesperada'), 'Carregar fluxo');
        }
        return false;
    }
}

// Criar novo fluxo
async function createNewFlow() {
    const typedName = await showFlowPromptDialog('Escolha um nome para o novo fluxo:', {
        title: 'Novo fluxo',
        placeholder: 'Ex.: Captacao de leads - Plano Premium',
        confirmLabel: 'Criar fluxo'
    });

    if (typedName === null) return;

    const nextName = String(typedName || '').trim();
    if (!nextName) {
        await showFlowAlertDialog('Informe um nome para criar o novo fluxo.', 'Novo fluxo');
        return;
    }

    resetEditorState();
    closeFlowsModal();
    persistLastOpenFlowId(null);
    currentFlowName = nextName;
    renderCurrentFlowName();
}

function applyAiDraftToEditor(draft: AiGeneratedFlowDraft) {
    const nextNodes = Array.isArray(draft?.nodes) ? draft.nodes : [];
    const nextEdges = Array.isArray(draft?.edges) ? draft.edges : [];

    if (nextNodes.length === 0) {
        throw new Error('A IA nao retornou blocos para o fluxo.');
    }

    resetEditorState();
    closeFlowsModal();

    const canvasContainer = document.getElementById('canvasContainer') as HTMLElement | null;
    const connectionsSvg = document.getElementById('connectionsSvg') as HTMLElement | null;
    if (canvasContainer) canvasContainer.innerHTML = '';
    if (connectionsSvg) connectionsSvg.innerHTML = '';
    document.getElementById('emptyCanvas')?.remove();

    currentFlowId = null;
    persistLastOpenFlowId(null);
    currentFlowName = String(draft.name || 'Fluxo IA (rascunho)').trim() || 'Fluxo IA (rascunho)';
    nodes = nextNodes;
    edges = nextEdges;
    normalizeLoadedFlowData();
    setCurrentFlowActive(false);
    renderCurrentFlowName();
    setFlowDirtyState(true);

    nodes.forEach((node) => renderNode(node));
    setTimeout(() => renderConnections(), 100);
}

async function runGenerateFlowWithAiPrompt(promptText: string, options: AiFlowGenerationRunOptions = {}): Promise<AiFlowGenerationRunResult> {
    const normalizedPrompt = String(promptText || '').trim();
    if (!normalizedPrompt) {
        return { cancelled: true };
    }

    const shouldConfirmReplace = options.confirmReplace !== false;
    if (shouldConfirmReplace && nodes.length > 0) {
        const confirmed = await showFlowConfirmDialog(
            'Substituir o fluxo atual pelo rascunho gerado por IA? As alteracoes nao salvas serao perdidas.',
            'Gerar fluxo com IA'
        );
        if (!confirmed) {
            return { cancelled: true };
        }
    }

    const token = getSessionToken();
    if (!token) {
        throw new Error('Sessao expirada. Faca login novamente.');
    }

    notify('info', 'IA', 'Gerando rascunho de fluxo...');
    const response = await fetch('/api/ai/flows/generate', {
        method: 'POST',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({
            prompt: normalizedPrompt
        })
    });
    const result = await response.json() as AiGenerateFlowResponse;

    if (!response.ok || !result?.success || !result?.draft) {
        throw new Error(result?.error || 'Nao foi possivel gerar o fluxo com IA');
    }

    applyAiDraftToEditor(result.draft);

    const assumptions = Array.isArray(result.draft.assumptions) ? result.draft.assumptions : [];
    const provider = String(result.provider || 'ia').toUpperCase();
    const summaryMessage = assumptions.length > 0
        ? `Rascunho gerado (${provider}). Revise antes de salvar.`
        : `Rascunho gerado (${provider}).`;
    notify('success', 'IA', summaryMessage);

    return {
        provider,
        assumptions
    };
}

async function generateFlowWithAi() {
    const seedPrompt = 'gere um fluxo de conversa que receba novos leads e feche vendas';
    const promptValue = await showFlowPromptDialog('Descreva o fluxo que a IA deve gerar:', {
        title: 'Gerar fluxo com IA',
        defaultValue: seedPrompt,
        placeholder: 'Ex.: gere um fluxo de conversa que receba novos leads e feche vendas',
        confirmLabel: 'Gerar'
    });
    const promptText = String(promptValue || '').trim();
    if (!promptText) return;

    try {
        await runGenerateFlowWithAiPrompt(promptText);
    } catch (error) {
        await showFlowAlertDialog('Erro ao gerar fluxo com IA: ' + (error instanceof Error ? error.message : 'Falha inesperada'), 'Gerar fluxo com IA');
    }
}

// Modal
function openFlowsModal() {
    renderFlowStatusControls();
    renamingFlowId = null;
    renamingFlowDraft = '';
    loadFlows();
    document.getElementById('flowsModal')?.classList.add('active');
}

function closeFlowsModal() {
    renamingFlowId = null;
    renamingFlowDraft = '';
    document.getElementById('flowsModal')?.classList.remove('active');
}

const windowAny = window as Window & {
    initFlowBuilder?: () => void;
    openFlowsModal?: () => void;
    createNewFlow?: () => Promise<void>;
    clearCanvas?: () => void;
    saveFlow?: () => Promise<void>;
    generateFlowWithAi?: () => Promise<void>;
    toggleFlowAiAssistant?: (forceOpen?: boolean) => void;
    closeFlowAiAssistant?: () => void;
    sendFlowAiAssistantPrompt?: () => Promise<void>;
    handleFlowAiAssistantInputKeydown?: (event: KeyboardEvent) => void;
    toggleFlowActive?: () => void;
    updateFlowStatusFromSelect?: () => void;
    zoomIn?: () => void;
    zoomOut?: () => void;
    resetZoom?: () => void;
    insertVariable?: (variable: string) => void;
    updateNodeProperty?: (key: keyof NodeData, value: any) => void;
    updateEventNodeSelection?: (value: string) => void;
    reloadCustomEventsCatalog?: () => void;
    addIntentRoute?: () => void;
    updateIntentRoute?: (index: number, key: 'label' | 'phrases', value: string) => void;
    removeIntentRoute?: (index: number) => void;
    toggleNodeCollapsed?: (id: string, event?: Event) => void;
    duplicateNode?: (id: string, event?: Event) => void;
    addCondition?: () => void;
    removeCondition?: (index: number) => void;
    updateCondition?: (index: number, key: 'value' | 'next', value: string) => void;
    deleteNode?: (id: string) => void;
    loadFlow?: (id: number, options?: LoadFlowOptions) => Promise<boolean>;
    renameFlow?: (id: number, currentName?: string, event?: Event) => void;
    updateRenameFlowDraft?: (value: string) => void;
    cancelRenameFlow?: (event?: Event) => void;
    handleRenameFlowKeydown?: (id: number, event?: KeyboardEvent) => void;
    saveFlowRenameInline?: (id: number, event?: Event) => Promise<void>;
    toggleFlowActivation?: (id: number, event?: Event) => Promise<void>;
    duplicateFlow?: (id: number, event?: Event) => Promise<void>;
    discardFlow?: (id: number, event?: Event) => Promise<void>;
    closeFlowsModal?: () => void;
};
windowAny.initFlowBuilder = initFlowBuilder;
windowAny.openFlowsModal = openFlowsModal;
windowAny.createNewFlow = createNewFlow;
windowAny.clearCanvas = clearCanvas;
windowAny.saveFlow = saveFlow;
windowAny.generateFlowWithAi = generateFlowWithAi;
windowAny.toggleFlowAiAssistant = toggleFlowAiAssistant;
windowAny.closeFlowAiAssistant = closeFlowAiAssistant;
windowAny.sendFlowAiAssistantPrompt = sendFlowAiAssistantPrompt;
windowAny.handleFlowAiAssistantInputKeydown = handleFlowAiAssistantInputKeydown;
windowAny.toggleFlowActive = toggleFlowActive;
windowAny.updateFlowStatusFromSelect = updateFlowStatusFromSelect;
windowAny.zoomIn = zoomIn;
windowAny.zoomOut = zoomOut;
windowAny.resetZoom = resetZoom;
windowAny.insertVariable = insertVariable;
windowAny.updateNodeProperty = updateNodeProperty;
windowAny.updateEventNodeSelection = updateEventNodeSelection;
windowAny.reloadCustomEventsCatalog = reloadCustomEventsCatalog;
windowAny.addIntentRoute = addIntentRoute;
windowAny.updateIntentRoute = updateIntentRoute;
windowAny.removeIntentRoute = removeIntentRoute;
windowAny.toggleNodeCollapsed = toggleNodeCollapsed;
windowAny.duplicateNode = duplicateNode;
windowAny.addCondition = addCondition;
windowAny.removeCondition = removeCondition;
windowAny.updateCondition = updateCondition;
windowAny.deleteNode = deleteNode;
windowAny.loadFlow = loadFlow;
windowAny.renameFlow = renameFlow;
windowAny.updateRenameFlowDraft = updateRenameFlowDraft;
windowAny.cancelRenameFlow = cancelRenameFlow;
windowAny.handleRenameFlowKeydown = handleRenameFlowKeydown;
windowAny.saveFlowRenameInline = saveFlowRenameInline;
windowAny.toggleFlowActivation = toggleFlowActivation;
windowAny.duplicateFlow = duplicateFlow;
windowAny.discardFlow = discardFlow;
windowAny.closeFlowsModal = closeFlowsModal;

export { initFlowBuilder };
