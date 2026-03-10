// Flow builder page logic migrated to module

// Estado do construtor
type NodeType = 'trigger' | 'intent' | 'message' | 'message_once' | 'wait' | 'condition' | 'delay' | 'transfer' | 'tag' | 'status' | 'webhook' | 'event' | 'end';
type FlowBuilderMode = 'humanized' | 'menu';
type OutputActionType = 'event' | 'status' | 'tag' | 'webhook';
type OutputActionItem = {
    id: string;
    type: OutputActionType;
    tag?: string;
    status?: number;
    url?: string;
    eventId?: number | null;
    eventKey?: string;
    eventName?: string;
};
type IntentRoute = {
    id: string;
    label: string;
    phrases: string;
    response?: string;
    followupResponse?: string;
    followupResponses?: string[];
};
type NodeData = {
    label: string;
    collapsed?: boolean;
    keyword?: string;
    intentRoutes?: IntentRoute[];
    intentResponseDelaySeconds?: number;
    intentDefaultResponse?: string;
    intentDefaultFollowupResponse?: string;
    intentDefaultFollowupResponses?: string[];
    triggerWelcomeEnabled?: boolean;
    triggerWelcomeContent?: string;
    triggerWelcomeDelaySeconds?: number;
    triggerWelcomeRepeatMode?: string;
    triggerWelcomeRepeatValue?: number;
    content?: string;
    delaySeconds?: number;
    isOnceMessage?: boolean;
    onceRepeatMode?: string;
    onceRepeatValue?: number;
    timeout?: number;
    flowBuilderMode?: FlowBuilderMode;
    responseMode?: 'text' | 'menu';
    menuPrompt?: string;
    menuButtonText?: string;
    menuTitle?: string;
    menuFooter?: string;
    menuSectionTitle?: string;
    conditions?: Array<{ value: string; next?: string }>;
    seconds?: number;
    message?: string;
    tag?: string;
    status?: number;
    url?: string;
    eventId?: number | null;
    eventKey?: string;
    eventName?: string;
    outputActions?: Record<string, OutputActionItem[]>;
    outputEntryLabels?: Record<string, string>;
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
    inputLabel?: string;
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
    session_id?: string | null;
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

type FlowWhatsappSessionOption = {
    session_id: string;
    name?: string;
    phone?: string;
    status?: string;
    connected?: boolean;
    campaign_enabled?: boolean;
};

let nodes: FlowNode[] = [];
let edges: Edge[] = [];
let selectedNode: FlowNode | null = null;
let selectedOutputActionContext: { nodeId: string; handle: string; label: string } | null = null;
let outputActionMenuOpen = false;
let currentFlowId: number | null = null;
let currentFlowName = '';
let currentFlowIsActive = true;
let currentFlowSessionId = '';
let currentFlowBuilderMode: FlowBuilderMode = 'humanized';
let flowHasUnsavedChanges = false;
let pendingNodeDraft: Partial<NodeData> | null = null;
let pendingNodeDraftId: string | null = null;
let intentPropertySectionExpandedState: Record<string, boolean> = {};
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
let flowWhatsappSessionsCache: FlowWhatsappSessionOption[] = [];

type ToastType = 'success' | 'error' | 'warning' | 'info';
type ToastFn = (type: ToastType, title: string, message: string, duration?: number) => void;
type FlowDialogMode = 'alert' | 'confirm' | 'prompt' | 'select' | 'prompt_select';
type FlowDialogSelectOption = {
    value: string;
    label: string;
};
type FlowDialogOptions = {
    mode: FlowDialogMode;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    defaultValue?: string;
    defaultSelectValue?: string;
    placeholder?: string;
    selectOptions?: FlowDialogSelectOption[];
};
type FlowDialogElements = {
    overlay: HTMLElement;
    title: HTMLElement;
    message: HTMLElement;
    inputWrap: HTMLElement;
    input: HTMLInputElement;
    selectWrap: HTMLElement;
    select: HTMLSelectElement;
    cancelBtn: HTMLButtonElement;
    confirmBtn: HTMLButtonElement;
    closeBtn: HTMLButtonElement;
};

type FlowAiAssistantMessage = {
    role: 'assistant' | 'user' | 'system';
    text: string;
};

const DEFAULT_HANDLE = 'default';
const EXTRA_INPUT_PORT_MIN = 2;
const FLOW_ALL_SESSIONS_VALUE = '';
const LAST_OPEN_FLOW_ID_STORAGE_KEY = 'flow_builder:last_open_flow_id';
const DEFAULT_CONTACT_FIELDS: ContactField[] = [
    { key: 'nome', label: 'Nome', source: 'name', is_default: true, required: true, placeholder: 'Nome completo' },
    { key: 'telefone', label: 'Telefone', source: 'phone', is_default: true, required: true, placeholder: 'Somente números com DDD' },
    { key: 'email', label: 'Email', source: 'email', is_default: true, required: false, placeholder: 'email@exemplo.com' }
];
const OUTPUT_ACTION_TYPES: OutputActionType[] = ['event', 'status', 'tag', 'webhook'];
const OUTPUT_ACTION_TYPE_LABELS: Record<OutputActionType, string> = {
    event: 'Registrar Evento',
    status: 'Alterar Status',
    tag: 'Adicionar Tag',
    webhook: 'Webhook'
};

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
    const selectWrap = document.getElementById('flowDialogSelectWrap') as HTMLElement | null;
    const select = document.getElementById('flowDialogSelect') as HTMLSelectElement | null;
    const cancelBtn = document.getElementById('flowDialogCancelBtn') as HTMLButtonElement | null;
    const confirmBtn = document.getElementById('flowDialogConfirmBtn') as HTMLButtonElement | null;
    const closeBtn = document.getElementById('flowDialogCloseBtn') as HTMLButtonElement | null;

    if (!overlay || !title || !message || !inputWrap || !input || !selectWrap || !select || !cancelBtn || !confirmBtn || !closeBtn) {
        return null;
    }

    return {
        overlay,
        title,
        message,
        inputWrap,
        input,
        selectWrap,
        select,
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

    if (options.mode === 'select') {
        const optionsText = (Array.isArray(options.selectOptions) ? options.selectOptions : [])
            .map((item, index) => `${index + 1}. ${item.label}`)
            .join('\n');
        const fallbackPrompt = optionsText
            ? `${options.message}\n\n${optionsText}\n\nDigite o número da opção:`
            : options.message;
        const raw = window.prompt(fallbackPrompt, options.defaultValue || '');
        if (raw === null) return Promise.resolve(null);
        const trimmed = String(raw).trim();
        if (!trimmed) return Promise.resolve(null);
        const numericIndex = Number.parseInt(trimmed, 10);
        if (Number.isFinite(numericIndex) && Array.isArray(options.selectOptions) && numericIndex > 0 && numericIndex <= options.selectOptions.length) {
            return Promise.resolve(String(options.selectOptions[numericIndex - 1]?.value || ''));
        }
        return Promise.resolve(trimmed);
    }

    if (options.mode === 'prompt_select') {
        const inputValue = window.prompt(options.message, options.defaultValue || '');
        if (inputValue === null) return Promise.resolve(null);

        const optionsText = (Array.isArray(options.selectOptions) ? options.selectOptions : [])
            .map((item, index) => `${index + 1}. ${item.label}`)
            .join('\n');
        const fallbackPrompt = optionsText
            ? `Selecione a conta:\n\n${optionsText}\n\nDigite o número da opção:`
            : 'Selecione a conta:';
        const rawSelect = window.prompt(fallbackPrompt, options.defaultSelectValue || options.defaultValue || '');
        if (rawSelect === null) return Promise.resolve(null);
        const trimmed = String(rawSelect).trim();
        if (!trimmed) return Promise.resolve(null);
        const numericIndex = Number.parseInt(trimmed, 10);
        let selectValue = trimmed;
        if (Number.isFinite(numericIndex) && Array.isArray(options.selectOptions) && numericIndex > 0 && numericIndex <= options.selectOptions.length) {
            selectValue = String(options.selectOptions[numericIndex - 1]?.value || '');
        }

        return Promise.resolve({
            inputValue: String(inputValue),
            selectValue
        });
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
            selectWrap,
            select,
            cancelBtn,
            confirmBtn,
            closeBtn
        } = elements;

        let settled = false;
        const isPrompt = options.mode === 'prompt' || options.mode === 'prompt_select';
        const isSelect = options.mode === 'select' || options.mode === 'prompt_select';
        const isPromptSelect = options.mode === 'prompt_select';
        const isAlert = options.mode === 'alert';

        const finish = (result: any) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(result);
        };

        const cancelResult = () => {
            if (isAlert) return undefined;
            if (isPrompt || isSelect) return null;
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
            select.onkeydown = null;
            document.removeEventListener('keydown', onKeydown, true);
        };

        const onKeydown = (event: KeyboardEvent) => {
            if (!overlay.classList.contains('active')) return;

            if (event.key === 'Escape') {
                event.preventDefault();
                finish(cancelResult());
                return;
            }

            if (event.key === 'Enter' && (isPrompt || isSelect || options.mode === 'confirm')) {
                const target = event.target as HTMLElement | null;
                if ((isPrompt && target === input) || (isSelect && target === select) || (!isPrompt && !isSelect)) {
                    event.preventDefault();
                    finish(
                        isPromptSelect
                            ? { inputValue: input.value, selectValue: select.value }
                            : isPrompt
                                ? input.value
                                : isSelect
                                    ? select.value
                                    : true
                    );
                }
            }
        };

        activeFlowDialogDismiss = () => finish(cancelResult());

        title.textContent = String(
            options.title || (isPromptSelect ? 'Preencha os dados' : isPrompt ? 'Digite um valor' : isSelect ? 'Selecione uma opção' : isAlert ? 'Aviso' : 'Confirmacao')
        );
        message.textContent = String(options.message || '');

        inputWrap.classList.toggle('active', isPrompt);
        selectWrap.classList.toggle('active', isSelect);
        input.value = isPrompt ? String(options.defaultValue || '') : '';
        input.placeholder = isPrompt ? String(options.placeholder || '') : '';
        if (isSelect) {
            const entries = (Array.isArray(options.selectOptions) ? options.selectOptions : [])
                .map((item) => `<option value="${escapeHtml(String(item.value || ''))}">${escapeHtml(String(item.label || item.value || ''))}</option>`);
            select.innerHTML = entries.join('');
            const nextValue = String(isPromptSelect ? (options.defaultSelectValue || '') : (options.defaultValue || ''));
            if (nextValue) {
                select.value = nextValue;
            }
            if (!select.value && select.options.length > 0) {
                select.selectedIndex = 0;
            }
        } else {
            select.innerHTML = '';
        }

        cancelBtn.style.display = isAlert ? 'none' : '';
        cancelBtn.textContent = String(options.cancelLabel || 'Cancelar');
        confirmBtn.textContent = String(options.confirmLabel || (isPrompt || isSelect ? 'Aplicar' : 'OK'));

        overlay.onclick = (event) => {
            if (event.target === overlay) {
                finish(cancelResult());
            }
        };
        cancelBtn.onclick = () => finish(cancelResult());
        closeBtn.onclick = () => finish(cancelResult());
        confirmBtn.onclick = () => finish(
            isPromptSelect
                ? { inputValue: input.value, selectValue: select.value }
                : isPrompt
                    ? input.value
                    : isSelect
                        ? select.value
                        : (isAlert ? undefined : true)
        );
        input.onkeydown = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                finish(
                    isPromptSelect
                        ? { inputValue: input.value, selectValue: select.value }
                        : input.value
                );
            }
        };
        select.onkeydown = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                finish(
                    isPromptSelect
                        ? { inputValue: input.value, selectValue: select.value }
                        : select.value
                );
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
            if (isSelect) {
                select.focus();
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

function showFlowPromptSelectDialog(
    message: string,
    options: {
        title?: string;
        defaultValue?: string;
        defaultSelectValue?: string;
        placeholder?: string;
        confirmLabel?: string;
        cancelLabel?: string;
        selectOptions: FlowDialogSelectOption[];
    }
) {
    return openStyledFlowDialog({
        mode: 'prompt_select',
        title: options.title,
        message,
        defaultValue: options.defaultValue,
        defaultSelectValue: options.defaultSelectValue,
        placeholder: options.placeholder,
        selectOptions: options.selectOptions,
        confirmLabel: options.confirmLabel || 'OK',
        cancelLabel: options.cancelLabel || 'Cancelar'
    }) as Promise<{ inputValue: string; selectValue: string } | null>;
}

function showFlowSelectDialog(
    message: string,
    options: {
        title?: string;
        defaultValue?: string;
        confirmLabel?: string;
        cancelLabel?: string;
        selectOptions: FlowDialogSelectOption[];
    }
) {
    return openStyledFlowDialog({
        mode: 'select',
        title: options.title,
        message,
        defaultValue: options.defaultValue,
        selectOptions: options.selectOptions,
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

function normalizeFlowBuilderMode(value: unknown): FlowBuilderMode {
    return String(value || '').trim().toLowerCase() === 'menu' ? 'menu' : 'humanized';
}

function inferFlowBuilderModeFromNodes(nodeList: FlowNode[] = nodes) {
    const triggerNode = nodeList.find((node) => node.type === 'trigger');
    const storedMode = triggerNode?.data?.flowBuilderMode;
    if (storedMode) {
        return normalizeFlowBuilderMode(storedMode);
    }

    const hasMenuIntentNode = nodeList.some((node) => (
        isIntentTrigger(node)
        && String(node?.data?.responseMode || '').trim().toLowerCase() === 'menu'
    ));
    return hasMenuIntentNode ? 'menu' : 'humanized';
}

function getCurrentFlowBuilderMode() {
    return normalizeFlowBuilderMode(currentFlowBuilderMode);
}

function isMenuInteractiveFlowMode(value: unknown = currentFlowBuilderMode) {
    return normalizeFlowBuilderMode(value) === 'menu';
}

function isMenuInteractiveIntentNode(node?: FlowNode | null) {
    return isIntentTrigger(node) && isMenuInteractiveFlowMode(node?.data?.flowBuilderMode || currentFlowBuilderMode);
}

function isProtectedFlowBoundaryNode(node?: FlowNode | null) {
    if (!node) return false;
    return node.type === 'trigger' || node.type === 'end';
}

function clearOutputEntryLabelsForNode(node?: FlowNode | null) {
    if (!node) return;
    node.data.outputEntryLabels = {};
    edges.forEach((edge) => {
        if (edge.source === node.id) {
            delete edge.inputLabel;
        }
    });
}

function applyFlowBuilderModeToIntentNode(node: FlowNode | null | undefined, mode: FlowBuilderMode = currentFlowBuilderMode) {
    if (!node || !isIntentTrigger(node)) return;

    const normalizedMode = normalizeFlowBuilderMode(mode);
    node.data.flowBuilderMode = normalizedMode;
    node.data.responseMode = normalizedMode === 'menu' ? 'menu' : 'text';
    node.data.menuPrompt = String(node.data.menuPrompt || '').trim() || 'Escolha uma opção no menu abaixo:';
    node.data.menuButtonText = String(node.data.menuButtonText || '').trim() || 'Ver Menu';
    node.data.menuSectionTitle = String(node.data.menuSectionTitle || '').trim() || 'Opções';
    node.data.menuTitle = String(node.data.menuTitle || '').trim();
    node.data.menuFooter = String(node.data.menuFooter || '').trim();

    if (normalizedMode === 'menu' && node.type === 'trigger') {
        node.data.triggerWelcomeEnabled = false;
        node.data.triggerWelcomeContent = '';
        node.data.triggerWelcomeDelaySeconds = 0;
        node.data.triggerWelcomeRepeatMode = 'always';
        node.data.triggerWelcomeRepeatValue = 1;
    }

    if (normalizedMode === 'menu') {
        clearOutputEntryLabelsForNode(node);
    }
}

function syncFlowBuilderModeAcrossIntentNodes(mode: FlowBuilderMode = currentFlowBuilderMode) {
    currentFlowBuilderMode = normalizeFlowBuilderMode(mode);
    nodes.forEach((node) => applyFlowBuilderModeToIntentNode(node, currentFlowBuilderMode));
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

function coerceIntentMessageListForEditor(value: unknown, fallbackValue: unknown = '') {
    if (Array.isArray(value)) {
        return value.map((item) => String(item ?? ''));
    }

    const fallbackText = String(fallbackValue ?? '').trim();
    return fallbackText ? [fallbackText] : [];
}

function normalizeIntentMessageList(value: unknown, fallbackValue: unknown = '') {
    return coerceIntentMessageListForEditor(value, fallbackValue)
        .map((item) => item.trim())
        .filter(Boolean);
}

function resolveIntentLegacyFollowupMessage(value: unknown, fallbackValue: unknown = '') {
    const messages = normalizeIntentMessageList(value, fallbackValue);
    return messages[0] || '';
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
            const followupResponses = normalizeIntentMessageList(
                (route as any)?.followupResponses,
                route?.followupResponse
            );
            return {
                id,
                label: buildRouteLabel(route, index),
                phrases: String(route.phrases || '').trim(),
                response: String(route.response || '').trim(),
                followupResponse: followupResponses[0] || '',
                followupResponses
            };
        });
    }

    const fallbackPhrases = parsePhraseList(node?.data?.keyword || '');
    return fallbackPhrases.map((phrase, index) => ({
        id: normalizeRouteId(`intent-${index + 1}`),
        label: phrase,
        phrases: phrase,
        response: '',
        followupResponse: '',
        followupResponses: []
    }));
}

function syncIntentRoutesFromNode(node?: FlowNode | null) {
    if (!isIntentTrigger(node)) return;
    const routes = getIntentRoutes(node);
    node!.data.intentRoutes = routes;
    const allPhrases = routes.flatMap((route) => parsePhraseList(route.phrases));
    node!.data.keyword = Array.from(new Set(allPhrases)).join(', ');
}

function normalizePathHandleIndex(handle?: string) {
    const normalized = edgeHandle(handle);
    if (normalized === DEFAULT_HANDLE) return 1;

    const match = normalized.match(/^path-(\d+)$/i);
    if (!match) return null;
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isFinite(parsed) || parsed < 1) return null;
    return parsed;
}

function pathHandleFromIndex(index: number) {
    const normalizedIndex = Number.isFinite(index) ? Math.max(1, Math.trunc(index)) : 1;
    return normalizedIndex <= 1 ? DEFAULT_HANDLE : `path-${normalizedIndex}`;
}

function getConnectedTargetPathIndices(node: FlowNode) {
    const used = new Set<number>();
    edges.forEach((edge) => {
        if (edge.target !== node.id) return;
        const index = normalizePathHandleIndex(edge.targetHandle);
        if (!index) return;
        used.add(index);
    });
    return Array.from(used).sort((a, b) => a - b);
}

function isPathPassThroughNode(node?: FlowNode | null) {
    if (!node) return false;
    return node.type !== 'trigger' && node.type !== 'intent' && node.type !== 'end';
}

function getEdgeInputLabel(edge?: Edge | null) {
    if (!edge) return '';

    const explicit = String((edge as any)?.inputLabel || '').trim();
    if (explicit) return explicit;

    const sourceNode = nodes.find((node) => node.id === edge.source) || null;
    if (sourceNode) {
        const map = getOutputEntryLabelsMapForNode(sourceNode);
        const mapLabel = String(map[edgeHandle(edge.sourceHandle)] || '').trim();
        if (mapLabel) return mapLabel;
    }

    return '';
}

function getIncomingEdgeLabels(node: FlowNode, targetHandle: string) {
    return edges
        .filter((edge) => edge.target === node.id && edgeHandle(edge.targetHandle) === edgeHandle(targetHandle))
        .map((edge) => getEdgeInputLabel(edge))
        .filter(Boolean);
}

function getInputHandles(node: FlowNode) {
    if (node.type === 'trigger') return [];
    if (node.type === 'intent' || node.type === 'end') {
        return [{
            handle: DEFAULT_HANDLE,
            label: '',
            isConnected: true,
            isExtra: false,
            incomingLabels: getIncomingEdgeLabels(node, DEFAULT_HANDLE)
        }];
    }

    const connectedIndices = getConnectedTargetPathIndices(node);
    const highestConnected = connectedIndices.length > 0
        ? connectedIndices[connectedIndices.length - 1]
        : 1;
    const totalInputs = Math.max(EXTRA_INPUT_PORT_MIN, highestConnected + 1);
    const connectedSet = new Set(connectedIndices);

    return Array.from({ length: totalInputs }, (_, offset) => {
        const index = offset + 1;
        const isConnected = connectedSet.has(index);
        const isLast = index === totalInputs;
        return {
            handle: pathHandleFromIndex(index),
            label: `${index}`,
            isConnected,
            isExtra: isLast && !isConnected && index > 1,
            incomingLabels: getIncomingEdgeLabels(node, pathHandleFromIndex(index))
        };
    });
}

function getPassThroughOutputHandles(node: FlowNode) {
    const connectedIndices = getConnectedTargetPathIndices(node);
    const highestConnected = connectedIndices.length > 0
        ? connectedIndices[connectedIndices.length - 1]
        : 1;
    const totalOutputs = Math.max(1, highestConnected);
    const showLabels = totalOutputs > 1;

    return Array.from({ length: totalOutputs }, (_, offset) => {
        const index = offset + 1;
        return {
            handle: pathHandleFromIndex(index),
            label: showLabels ? `${index}` : ''
        };
    });
}

function getOutputHandles(node: FlowNode) {
    if (node.type === 'end') return [];

    if (isPathPassThroughNode(node)) {
        return getPassThroughOutputHandles(node);
    }

    if (!isIntentTrigger(node)) {
        return [{ handle: DEFAULT_HANDLE, label: '' }];
    }

    const routes = getIntentRoutes(node);
    const routeHandles = routes.map((route) => ({
        handle: route.id || normalizeRouteId(route.label || route.phrases || ''),
        label: route.label || route.phrases || (isMenuInteractiveIntentNode(node) ? 'Opção' : 'Intenção')
    }));

    if (isMenuInteractiveIntentNode(node)) {
        return routeHandles;
    }

    return [...routeHandles, { handle: DEFAULT_HANDLE, label: 'Outra resposta' }];
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

function isIntentDefaultToMessageOnceEdge(edge: Edge) {
    const sourceNode = nodes.find((node) => node.id === edge.source);
    const targetNode = nodes.find((node) => node.id === edge.target);
    if (!sourceNode || !targetNode) return false;

    const sourceType = String(sourceNode.type || '').trim().toLowerCase();
    const sourceSubtype = String(sourceNode.subtype || '').trim().toLowerCase();
    const targetType = String(targetNode.type || '').trim().toLowerCase();

    if (sourceType !== 'trigger') return false;
    if (sourceSubtype !== 'keyword' && sourceSubtype !== 'intent') return false;
    const targetIsOnceMessage = targetType === 'message_once'
        || (targetType === 'message' && Boolean(targetNode?.data?.isOnceMessage));
    if (!targetIsOnceMessage) return false;
    return edgeHandle(edge.sourceHandle) === DEFAULT_HANDLE;
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
        const response = await fetch(buildFlowApiUrl('/api/contact-fields'), {
            headers: buildAuthHeaders(false)
        });
        const result = await readFlowJsonResponse<any>(response, {});
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
        const response = await fetch(buildFlowApiUrl('/api/custom-events?active=1'), {
            headers: buildAuthHeaders(false)
        });
        const result = await readFlowJsonResponse<any>(response, {});
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

    if (selectedNode?.type === 'event' || (selectedNode && selectedOutputActionContext?.nodeId === selectedNode.id)) {
        renderProperties();
    }
}

function reloadCustomEventsCatalog() {
    loadCustomEventsCatalog();
}

function reloadFlowSessionOptions() {
    loadFlowWhatsappSessions();
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
        message_once: 'Enviar Mensagem',
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

function isFlowMobileListMode() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 768px)').matches;
}

function isFlowReadOnlyMode() {
    return isFlowMobileListMode();
}

function setFlowMobileModalOpenState(isOpen: boolean) {
    const root = document.querySelector('.flow-builder-react') as HTMLElement | null;
    if (!root) return;
    root.classList.toggle('flow-mobile-modal-open', Boolean(isOpen) && isFlowMobileListMode());
}

function setFlowBuilderScreen(screen: 'selector' | 'builder') {
    const root = document.querySelector('.flow-builder-react') as HTMLElement | null;
    const selectorScreen = document.getElementById('flowSelectorScreen') as HTMLElement | null;
    const selectorActions = document.getElementById('flowSelectorActions') as HTMLElement | null;
    const builderBackBtn = document.getElementById('flowBuilderBackBtn') as HTMLButtonElement | null;
    const builderFlowInfoRow = document.getElementById('flowBuilderFlowInfoRow') as HTMLElement | null;
    const builderContainer = document.getElementById('flowBuilderContainer') as HTMLElement | null;
    const showSelector = screen === 'selector';

    root?.classList.toggle('is-selector-screen', showSelector);
    root?.classList.toggle('is-builder-screen', !showSelector);
    selectorScreen?.toggleAttribute('hidden', !showSelector);
    selectorActions?.toggleAttribute('hidden', !showSelector);
    builderBackBtn?.toggleAttribute('hidden', showSelector);
    builderFlowInfoRow?.toggleAttribute('hidden', showSelector);
    builderContainer?.toggleAttribute('hidden', showSelector);

    setFlowMobileModalOpenState(showSelector);
    if (!showSelector) {
        requestAnimationFrame(() => {
            renderConnections();
        });
    }
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

function getFlowApiBaseUrl() {
    const appBaseUrl = String((window as any).APP?.socketUrl || '').trim();
    if (appBaseUrl) {
        return appBaseUrl.replace(/\/+$/, '');
    }

    const location = window.location;
    const hostname = String(location.hostname || '').trim();
    const port = String(location.port || '').trim();

    if (port === '5173' || port === '4173') {
        return `${location.protocol}//${hostname}:3001`;
    }

    const normalizedHost = hostname.toLowerCase();
    if (normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || normalizedHost === '::1') {
        return `${location.protocol}//${hostname}:3001`;
    }

    return location.origin;
}

function buildFlowApiUrl(path: string) {
    const normalizedPath = String(path || '').startsWith('/') ? path : `/${path}`;
    return `${getFlowApiBaseUrl()}${normalizedPath}`;
}

async function readFlowJsonResponse<T>(response: Response, fallback: T): Promise<T> {
    try {
        const raw = await response.text();
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
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

function normalizeFlowSessionId(value: unknown) {
    return String(value || '').trim();
}

function normalizeFlowWhatsappSessionOption(raw: any): FlowWhatsappSessionOption | null {
    const sessionId = normalizeFlowSessionId(raw?.session_id || raw?.sessionId);
    if (!sessionId) return null;
    return {
        session_id: sessionId,
        name: String(raw?.name || '').trim(),
        phone: String(raw?.phone || '').trim(),
        status: String(raw?.status || '').trim(),
        connected: Boolean(raw?.connected),
        campaign_enabled: raw?.campaign_enabled
    };
}

function getFlowWhatsappSessionDisplayName(session?: FlowWhatsappSessionOption | null) {
    const label = String(session?.name || session?.phone || '').trim();
    if (label) return label;
    return String(session?.session_id || '').trim();
}

function getFlowWhatsappSessionStatusLabel(session?: FlowWhatsappSessionOption | null) {
    return String(session?.connected ? 'Conectada' : (session?.status || 'Desconectada')).trim();
}

function getFlowSessionScopeLabel(sessionId?: string | null, options: { includeStatus?: boolean } = {}) {
    const normalizedSessionId = normalizeFlowSessionId(sessionId);
    if (!normalizedSessionId) {
        return 'Todas as contas WhatsApp';
    }

    const session = flowWhatsappSessionsCache.find((item) => normalizeFlowSessionId(item.session_id) === normalizedSessionId);
    if (!session) {
        return `Conta indisponível (${normalizedSessionId})`;
    }

    const name = getFlowWhatsappSessionDisplayName(session);
    if (!options.includeStatus) {
        return name;
    }

    return `${name} - ${getFlowWhatsappSessionStatusLabel(session)}`;
}

function getFlowSessionScopeOptionLabel(session: FlowWhatsappSessionOption) {
    const sessionId = normalizeFlowSessionId(session.session_id);
    const status = getFlowWhatsappSessionStatusLabel(session);
    const name = getFlowWhatsappSessionDisplayName(session);
    return name === sessionId
        ? `${sessionId} - ${status}`
        : `${name} - ${sessionId} - ${status}`;
}

function buildFlowSessionScopeOptionsMarkup(selectedSessionId?: string | null) {
    const options = [...flowWhatsappSessionsCache]
        .filter((item) => normalizeFlowSessionId(item.session_id))
        .sort((a, b) => getFlowWhatsappSessionDisplayName(a).localeCompare(getFlowWhatsappSessionDisplayName(b), 'pt-BR'));
    const knownIds = new Set(options.map((item) => normalizeFlowSessionId(item.session_id)));
    const normalizedSelectedSessionId = normalizeFlowSessionId(selectedSessionId);

    const entries = [
        `<option value="${FLOW_ALL_SESSIONS_VALUE}">Todas as contas WhatsApp</option>`,
        ...options.map((item) => {
            const sessionId = normalizeFlowSessionId(item.session_id);
            return `<option value="${escapeHtml(sessionId)}">${escapeHtml(getFlowSessionScopeOptionLabel(item))}</option>`;
        })
    ];

    if (normalizedSelectedSessionId && !knownIds.has(normalizedSelectedSessionId)) {
        entries.push(`<option value="${escapeHtml(normalizedSelectedSessionId)}">Conta indisponível (${escapeHtml(normalizedSelectedSessionId)})</option>`);
    }

    return entries.join('');
}

function renderFlowSessionScopeControls() {
    const display = document.getElementById('currentFlowSessionScopeDisplay') as HTMLElement | null;
    if (display) {
        const label = getFlowSessionScopeLabel(currentFlowSessionId, { includeStatus: true });
        display.textContent = label;
        display.title = label;
    }
}

function setCurrentFlowSessionScope(sessionId: unknown) {
    currentFlowSessionId = normalizeFlowSessionId(sessionId);
    renderFlowSessionScopeControls();
}

function updateFlowSessionScopeFromSelect() {
    const select = document.getElementById('flowSessionScope') as HTMLSelectElement | null;
    if (!select) return;
    const nextSessionId = normalizeFlowSessionId(select.value);
    if (nextSessionId === currentFlowSessionId) return;
    setCurrentFlowSessionScope(nextSessionId);
    markFlowDirty();
}

async function loadFlowWhatsappSessions(options: { silent?: boolean } = {}) {
    try {
        const response = await fetch(buildFlowApiUrl('/api/whatsapp/sessions?includeDisabled=true'), {
            headers: buildAuthHeaders(false)
        });
        const result = await readFlowJsonResponse<any>(response, {});
        if (response.ok && result?.success) {
            flowWhatsappSessionsCache = (Array.isArray(result.sessions) ? result.sessions : [])
                .map((item) => normalizeFlowWhatsappSessionOption(item))
                .filter((item): item is FlowWhatsappSessionOption => Boolean(item));
            renderFlowSessionScopeControls();
            if (flowsCache.length > 0) {
                renderFlowsList(flowsCache);
            }
            return;
        }
    } catch (_) {
        // no-op
    }

    flowWhatsappSessionsCache = [];
    renderFlowSessionScopeControls();
    if (flowsCache.length > 0) {
        renderFlowsList(flowsCache);
    }
    if (!options.silent) {
        notify('warning', 'Fluxos', 'Não foi possível carregar as contas WhatsApp.');
    }
}

function renderFlowStatusControls() {
    const statusSelect = document.getElementById('flowStatus') as HTMLSelectElement | null;
    if (statusSelect) {
        statusSelect.value = currentFlowIsActive ? '1' : '0';
    }
    renderFlowSessionScopeControls();
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

    saveBtn.classList.remove('is-hidden');
    saveBtn.removeAttribute('hidden');
    saveBtn.disabled = !flowHasUnsavedChanges;
    saveBtn.setAttribute('aria-disabled', (!flowHasUnsavedChanges).toString());
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
    openFlowsModal();
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
    loadFlowWhatsappSessions({ silent: true });
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
            if (isFlowReadOnlyMode()) {
                e.preventDefault();
                return;
            }
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
        if (isFlowReadOnlyMode()) return;
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
    if (isFlowReadOnlyMode()) return;
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

    if (isIntentTrigger(node)) {
        applyFlowBuilderModeToIntentNode(node, getCurrentFlowBuilderMode());
    }
    
    nodes.push(node);
    renderNode(node);
    selectNode(id);
    markFlowDirty();
}

function buildFlowNodeId(prefix = 'node') {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function getIntentNodeVisualSize() {
    const flowCanvas = document.getElementById('flowCanvas') as HTMLElement | null;
    if (!flowCanvas) {
        return { width: 220, height: 160 };
    }

    const referenceNode = (
        flowCanvas.querySelector('.flow-node.intent') as HTMLElement | null
    ) || (
        flowCanvas.querySelector('.flow-node') as HTMLElement | null
    );

    if (!referenceNode) {
        return { width: 220, height: 160 };
    }

    const rect = referenceNode.getBoundingClientRect();
    const width = Number.isFinite(rect.width) && rect.width > 0
        ? rect.width / Math.max(0.01, zoom)
        : 220;
    const height = Number.isFinite(rect.height) && rect.height > 0
        ? rect.height / Math.max(0.01, zoom)
        : 160;

    return { width, height };
}

function getIntentNodeInsertPosition() {
    const flowCanvas = document.getElementById('flowCanvas') as HTMLElement | null;
    if (!flowCanvas) return { x: 180, y: 180 };

    const rect = flowCanvas.getBoundingClientRect();
    const centerClientX = rect.left + (rect.width / 2);
    const centerClientY = rect.top + (rect.height / 2);
    const centerFlow = clientToFlowCoords(centerClientX, centerClientY);
    const nodeSize = getIntentNodeVisualSize();

    return {
        x: Math.max(20, Math.round(centerFlow.x - (nodeSize.width / 2))),
        y: Math.max(20, Math.round(centerFlow.y - (nodeSize.height / 2)))
    };
}

function addIntentBlock() {
    if (isFlowReadOnlyMode()) return;
    const nextPosition = getIntentNodeInsertPosition();
    addNode('intent', '', nextPosition.x, nextPosition.y);
}

function initializeDefaultIntentFlowSkeleton(options: { selectTrigger?: boolean; markDirty?: boolean; flowBuilderMode?: FlowBuilderMode } = {}) {
    const selectTrigger = options.selectTrigger !== false;
    const markDirty = options.markDirty !== false;
    currentFlowBuilderMode = normalizeFlowBuilderMode(options.flowBuilderMode || currentFlowBuilderMode);
    const triggerNodeId = buildFlowNodeId('trigger');
    const endNodeId = buildFlowNodeId('end');

    const triggerNode: FlowNode = {
        id: triggerNodeId,
        type: 'trigger',
        subtype: 'keyword',
        position: { x: 170, y: 180 },
        data: getDefaultNodeData('trigger', 'keyword')
    };
    applyFlowBuilderModeToIntentNode(triggerNode, currentFlowBuilderMode);

    const endNode: FlowNode = {
        id: endNodeId,
        type: 'end',
        subtype: '',
        position: { x: 560, y: 180 },
        data: getDefaultNodeData('end')
    };

    nodes = [triggerNode, endNode];
    edges = isMenuInteractiveFlowMode(currentFlowBuilderMode)
        ? []
        : [{
            source: triggerNodeId,
            target: endNodeId,
            sourceHandle: DEFAULT_HANDLE,
            targetHandle: DEFAULT_HANDLE
        }];

    const canvasContainer = document.getElementById('canvasContainer') as HTMLElement | null;
    const connectionsSvg = document.getElementById('connectionsSvg') as HTMLElement | null;
    if (canvasContainer) canvasContainer.innerHTML = '';
    if (connectionsSvg) connectionsSvg.innerHTML = '';
    document.getElementById('emptyCanvas')?.remove();

    nodes.forEach((node) => renderNode(node));
    renderConnections();
    if (selectTrigger) {
        selectNode(triggerNodeId);
    }
    if (markDirty) {
        markFlowDirty();
    }
}

// Dados padrao do no
function getDefaultNodeData(type: NodeType, subtype?: string): NodeData {
    const defaults = {
        trigger: {
            label: subtype === 'keyword' || subtype === 'intent' ? 'Início' : 'Novo Contato',
            collapsed: false,
            keyword: '',
            intentRoutes: [],
            intentResponseDelaySeconds: 0,
            flowBuilderMode: getCurrentFlowBuilderMode(),
            responseMode: isMenuInteractiveFlowMode() ? 'menu' : 'text',
            menuPrompt: 'Escolha uma opção no menu abaixo:',
            menuButtonText: 'Ver Menu',
            menuSectionTitle: 'Opções',
            menuTitle: '',
            menuFooter: '',
            intentDefaultResponse: '',
            intentDefaultFollowupResponse: '',
            intentDefaultFollowupResponses: [],
            triggerWelcomeEnabled: false,
            triggerWelcomeContent: '',
            triggerWelcomeDelaySeconds: 0,
            triggerWelcomeRepeatMode: 'always',
            triggerWelcomeRepeatValue: 1,
            outputActions: {},
            outputEntryLabels: {}
        },
        intent: {
            label: 'Intenção',
            collapsed: false,
            keyword: '',
            intentRoutes: [],
            intentResponseDelaySeconds: 0,
            flowBuilderMode: getCurrentFlowBuilderMode(),
            responseMode: isMenuInteractiveFlowMode() ? 'menu' : 'text',
            menuPrompt: 'Escolha uma opção no menu abaixo:',
            menuButtonText: 'Ver Menu',
            menuSectionTitle: 'Opções',
            menuTitle: '',
            menuFooter: '',
            intentDefaultResponse: '',
            intentDefaultFollowupResponse: '',
            intentDefaultFollowupResponses: [],
            outputActions: {},
            outputEntryLabels: {}
        },
        message: {
            label: 'Mensagem',
            collapsed: false,
            content: 'Olá! Como posso ajudar?',
            delaySeconds: 0,
            isOnceMessage: false,
            onceRepeatMode: 'always',
            onceRepeatValue: 1,
            outputActions: {},
            outputEntryLabels: {}
        },
        message_once: {
            label: 'Mensagem',
            collapsed: false,
            content: 'Olá! Como posso ajudar?',
            delaySeconds: 0,
            isOnceMessage: true,
            onceRepeatMode: 'always',
            onceRepeatValue: 1,
            outputActions: {},
            outputEntryLabels: {}
        },
        wait: {
            label: 'Aguardar Resposta',
            collapsed: false,
            timeout: 300,
            responseMode: 'text',
            menuPrompt: 'Selecione uma opção no menu abaixo:',
            menuButtonText: 'Ver Menu',
            menuSectionTitle: 'Opções',
            menuTitle: '',
            menuFooter: '',
            outputActions: {},
            outputEntryLabels: {}
        },
        condition: {
            label: 'Condição',
            collapsed: false,
            conditions: [],
            responseMode: 'text',
            menuPrompt: 'Selecione uma opção no menu abaixo:',
            menuButtonText: 'Ver Menu',
            menuSectionTitle: 'Opções',
            menuTitle: '',
            menuFooter: '',
            outputActions: {},
            outputEntryLabels: {}
        },
        delay: { label: 'Delay', collapsed: false, seconds: 5, outputActions: {}, outputEntryLabels: {} },
        transfer: { label: 'Transferir', collapsed: false, message: 'Transferindo para um atendente...', outputActions: {}, outputEntryLabels: {} },
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
                    <button
                        type="button"
                        class="output-action-trigger${
                            selectedOutputActionContext
                            && selectedOutputActionContext.nodeId === node.id
                            && edgeHandle(selectedOutputActionContext.handle) === edgeHandle(item.handle)
                                ? ' active'
                                : ''
                        }${
                            getOutputActionsForNodeHandle(node, item.handle).length > 0
                                ? ' has-actions'
                                : ''
                        }"
                        data-action-handle="${escapeHtml(edgeHandle(item.handle))}"
                        title="Configurar ações desta saída"
                        onmousedown="event.preventDefault(); event.stopPropagation();"
                        onclick="openOutputActionEditor('${node.id}', '${encodeURIComponent(edgeHandle(item.handle))}', '${encodeURIComponent(String(item.label || ''))}', event)"
                    >+</button>
                    <div class="port output" data-port="output" data-handle="${escapeHtml(item.handle)}" data-label="${escapeHtml(item.label || '')}" title="${escapeHtml(item.label || 'Saída')}"></div>
                </div>
            `).join('')}
        </div>
    `;
}

function getNodeInputPortsMarkup(node: FlowNode) {
    if (node.type === 'trigger') return '<div></div>';
    const handles = getInputHandles(node);

    return `
        <div class="node-input-ports">
            ${handles.map((item) => `
                <div class="node-input-port${item.isExtra ? ' is-extra' : ''}">
                    <div
                        class="port input${item.isExtra ? ' is-extra-input' : ''}"
                        data-port="input"
                        data-handle="${escapeHtml(item.handle)}"
                        title="${escapeHtml(item.label)}"
                    ></div>
                    ${
                        Array.isArray((item as any).incomingLabels) && (item as any).incomingLabels.length > 0
                            ? `
                                <div class="node-input-label-list">
                                    ${(item as any).incomingLabels.map((text: string) => `
                                        <span class="node-input-label" title="${escapeHtml(text)}">${escapeHtml(truncateLabel(text, 20))}</span>
                                    `).join('')}
                                </div>
                            `
                            : ''
                    }
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
    const isEventCircle = node.type === 'event';
    const previewText = String(getNodePreview(node) || '').trim();
    const hasPreview = previewText.length > 0;
    const canDuplicateOrDelete = !isProtectedFlowBoundaryNode(node);
    const showNodeKind = !isIntentTrigger(node);
    const eventDisplayName = node.type === 'event'
        ? String(node.data.eventName || node.data.eventKey || '').trim()
        : '';
    node.data.collapsed = false;
    nodeEl.className = `flow-node${isEventCircle ? ' event-circle' : ''}${hasPreview ? '' : ' without-body'}`;
    nodeEl.id = node.id;
    nodeEl.style.left = node.position.x + 'px';
    nodeEl.style.top = node.position.y + 'px';
    
    const icons = {
        trigger: 'icon-bolt',
        intent: 'icon-bolt',
        message: 'icon-message',
        message_once: 'icon-message',
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
                ${showNodeKind ? `<span class="node-kind">${escapeHtml(getNodeTypeLabel(node))}</span>` : ''}
                <span class="title">${escapeHtml(String(node.data.label || '').trim() || getNodeTypeLabel(node))}</span>
                ${eventDisplayName ? `<span class="node-subtitle" title="${escapeHtml(eventDisplayName)}">${escapeHtml(truncateLabel(eventDisplayName, 22))}</span>` : ''}
            </div>
            <div class="node-header-actions">
                ${canDuplicateOrDelete ? `
                    <button class="node-header-btn duplicate-btn" title="Duplicar bloco" aria-label="Duplicar bloco" onclick="duplicateNode('${node.id}', event)">
                        <span class="icon icon-templates icon-sm"></span>
                    </button>
                    <button class="node-header-btn delete-btn" title="Excluir bloco" aria-label="Excluir bloco" onclick="deleteNode('${node.id}')">
                        <span class="icon icon-delete icon-sm"></span>
                    </button>
                ` : ''}
            </div>
        </div>
        ${hasPreview ? `
        <div class="flow-node-body">
            ${escapeHtml(previewText)}
        </div>` : ''}
        <div class="flow-node-ports">
            ${getNodeInputPortsMarkup(node)}
            ${getNodeOutputPortsMarkup(node)}
        </div>
    `;
    
    // Eventos de arrastar
    nodeEl.addEventListener('mousedown', (e) => {
        if (isFlowReadOnlyMode()) return;
        if (e.button !== 0) return;

        const target = e.target as HTMLElement | null;
        const portTarget = target?.closest('.port') as HTMLElement | null;
        if (portTarget) {
            e.preventDefault();
            e.stopPropagation();
            startConnection(
                node.id,
                portTarget.dataset.port || '',
                portTarget.dataset.handle || DEFAULT_HANDLE,
                portTarget.dataset.label || '',
                portTarget
            );
            return;
        }
        if (
            target?.closest('.delete-btn')
            || target?.closest('.duplicate-btn')
            || target?.closest('.output-action-trigger')
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
        endConnection(targetNode.id, targetPort.dataset.port || '', targetPort.dataset.handle || DEFAULT_HANDLE);
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

function buildOutputActionId() {
    return `action_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function normalizeOutputActionType(value: unknown): OutputActionType | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (OUTPUT_ACTION_TYPES.includes(normalized as OutputActionType)) {
        return normalized as OutputActionType;
    }
    return null;
}

function getOutputActionTypeLabel(type: unknown) {
    const normalizedType = normalizeOutputActionType(type);
    if (!normalizedType) return 'Ação';
    return OUTPUT_ACTION_TYPE_LABELS[normalizedType];
}

function buildDefaultOutputAction(type: OutputActionType): OutputActionItem {
    const base: OutputActionItem = {
        id: buildOutputActionId(),
        type
    };

    if (type === 'status') {
        base.status = 2;
        return base;
    }

    if (type === 'tag') {
        base.tag = '';
        return base;
    }

    if (type === 'webhook') {
        base.url = '';
        return base;
    }

    base.eventId = null;
    base.eventKey = '';
    base.eventName = '';
    return base;
}

function sanitizeOutputActionItem(value: unknown): OutputActionItem | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    const raw = value as Record<string, any>;
    const type = normalizeOutputActionType(raw.type);
    if (!type) return null;

    const item: OutputActionItem = {
        id: String(raw.id || buildOutputActionId()),
        type
    };

    if (type === 'status') {
        const statusValue = Number(raw.status);
        item.status = Number.isFinite(statusValue) && statusValue > 0
            ? Math.trunc(statusValue)
            : 2;
    }

    if (type === 'tag') {
        item.tag = String(raw.tag || '').trim();
    }

    if (type === 'webhook') {
        item.url = String(raw.url || '').trim();
    }

    if (type === 'event') {
        const eventId = Number(raw.eventId);
        const legacyEventId = Number(raw.event_id);
        const normalizedEventId = Number.isFinite(eventId) && eventId > 0
            ? Math.trunc(eventId)
            : (Number.isFinite(legacyEventId) && legacyEventId > 0 ? Math.trunc(legacyEventId) : null);
        item.eventId = normalizedEventId;
        item.eventKey = String(raw.eventKey || raw.event_key || '').trim();
        item.eventName = String(raw.eventName || raw.event_name || '').trim();
    }

    return item;
}

function sanitizeOutputActionsMap(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {} as Record<string, OutputActionItem[]>;
    }

    const rawMap = value as Record<string, unknown>;
    const normalizedMap: Record<string, OutputActionItem[]> = {};

    Object.entries(rawMap).forEach(([rawHandle, rawActions]) => {
        const handle = edgeHandle(rawHandle);
        if (!Array.isArray(rawActions)) return;

        const normalizedActions = rawActions
            .map((item) => sanitizeOutputActionItem(item))
            .filter(Boolean) as OutputActionItem[];

        if (normalizedActions.length > 0) {
            normalizedMap[handle] = normalizedActions;
        }
    });

    return normalizedMap;
}

function sanitizeOutputEntryLabelsMap(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {} as Record<string, string>;
    }

    const rawMap = value as Record<string, unknown>;
    const normalizedMap: Record<string, string> = {};

    Object.entries(rawMap).forEach(([rawHandle, rawLabel]) => {
        const handle = edgeHandle(rawHandle);
        const label = String(rawLabel || '').trim();
        if (!label) return;
        normalizedMap[handle] = label;
    });

    return normalizedMap;
}

function setPropertiesPanelTitle(title: string) {
    const titleElement = document.getElementById('propertiesPanelTitle') as HTMLElement | null;
    if (titleElement) {
        titleElement.textContent = title;
    }
}

function getIntentPropertySectionStateKey(sectionKey: string) {
    if (!selectedNode || !isIntentTrigger(selectedNode)) return '';
    const normalizedSectionKey = String(sectionKey || '').trim();
    if (!normalizedSectionKey) return '';
    return `${selectedNode.id}:${normalizedSectionKey}`;
}

function isIntentPropertySectionExpanded(sectionKey: string, defaultValue = false) {
    const scopedKey = getIntentPropertySectionStateKey(sectionKey);
    if (!scopedKey) return Boolean(defaultValue);
    if (!Object.prototype.hasOwnProperty.call(intentPropertySectionExpandedState, scopedKey)) {
        intentPropertySectionExpandedState[scopedKey] = Boolean(defaultValue);
    }
    return Boolean(intentPropertySectionExpandedState[scopedKey]);
}

function setIntentPropertySectionExpanded(sectionKey: string, expanded: boolean) {
    const scopedKey = getIntentPropertySectionStateKey(sectionKey);
    if (!scopedKey) return;
    intentPropertySectionExpandedState[scopedKey] = Boolean(expanded);
}

function clearIntentRouteSectionExpandedStateForSelectedNode() {
    if (!selectedNode) return;
    const prefix = `${selectedNode.id}:route:`;
    Object.keys(intentPropertySectionExpandedState).forEach((key) => {
        if (key.startsWith(prefix)) {
            delete intentPropertySectionExpandedState[key];
        }
    });
}

function toggleIntentPropertySection(sectionKey: string, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    if (!selectedNode || !isIntentTrigger(selectedNode)) return;

    const scopedKey = getIntentPropertySectionStateKey(sectionKey);
    if (!scopedKey) return;

    intentPropertySectionExpandedState[scopedKey] = !Boolean(intentPropertySectionExpandedState[scopedKey]);
    renderProperties();
}

function getOutputActionsMapForNode(node: FlowNode) {
    const rawMap = node?.data?.outputActions || {};
    return sanitizeOutputActionsMap(rawMap);
}

function getOutputActionsForNodeHandle(node: FlowNode | null, handle: string) {
    if (!node) return [];
    const map = getOutputActionsMapForNode(node);
    return map[edgeHandle(handle)] || [];
}

function getOutputEntryLabelsMapForNode(node: FlowNode | null) {
    if (!node) return {} as Record<string, string>;
    return sanitizeOutputEntryLabelsMap(node?.data?.outputEntryLabels || {});
}

function getSelectedOutputEntryLabel() {
    if (!selectedNode) return '';
    const handle = getSelectedOutputActionHandle();
    const mapRaw = getNodePropValue('outputEntryLabels', selectedNode.data.outputEntryLabels || {});
    const map = sanitizeOutputEntryLabelsMap(mapRaw);
    return String(map[handle] || '').trim();
}

function getSelectedOutputActionHandle() {
    if (!selectedOutputActionContext) return DEFAULT_HANDLE;
    return edgeHandle(selectedOutputActionContext.handle);
}

function getSelectedOutputActions() {
    if (!selectedNode) return [];
    const rawMap = getNodePropValue('outputActions', selectedNode.data.outputActions || {});
    const map = sanitizeOutputActionsMap(rawMap);
    return map[getSelectedOutputActionHandle()] || [];
}

function updateSelectedOutputActions(actions: OutputActionItem[]) {
    if (isFlowReadOnlyMode()) return;
    if (!selectedNode) return;
    if (!selectedOutputActionContext || selectedOutputActionContext.nodeId !== selectedNode.id) return;

    const currentMapRaw = getNodePropValue('outputActions', selectedNode.data.outputActions || {});
    const map = sanitizeOutputActionsMap(currentMapRaw);
    const handle = getSelectedOutputActionHandle();

    if (actions.length === 0) {
        delete map[handle];
    } else {
        map[handle] = actions.map((item) => ({
            ...item,
            id: String(item.id || buildOutputActionId())
        }));
    }

    updateNodeProperty('outputActions', map);
}

function updateSelectedOutputEntryLabel(value: string) {
    if (isFlowReadOnlyMode()) return;
    if (!selectedNode) return;
    if (!selectedOutputActionContext || selectedOutputActionContext.nodeId !== selectedNode.id) return;

    const currentMapRaw = getNodePropValue('outputEntryLabels', selectedNode.data.outputEntryLabels || {});
    const map = sanitizeOutputEntryLabelsMap(currentMapRaw);
    const handle = getSelectedOutputActionHandle();
    const normalizedValue = String(value || '').trim();

    if (normalizedValue) {
        map[handle] = normalizedValue;
    } else {
        delete map[handle];
    }

    updateNodeProperty('outputEntryLabels', map);
}

function clearSelectedOutputActionContext() {
    selectedOutputActionContext = null;
    outputActionMenuOpen = false;
    refreshOutputActionTriggerState();
}

function decodeOutputActionParam(value: string) {
    try {
        return decodeURIComponent(String(value || '').trim());
    } catch (_) {
        return String(value || '').trim();
    }
}

function refreshOutputActionTriggerState() {
    document.querySelectorAll('.output-action-trigger.active').forEach((element) => {
        element.classList.remove('active');
    });

    if (!selectedOutputActionContext) return;
    const nodeEl = document.getElementById(selectedOutputActionContext.nodeId);
    if (!nodeEl) return;

    const targetHandle = edgeHandle(selectedOutputActionContext.handle);
    const buttons = Array.from(nodeEl.querySelectorAll('.output-action-trigger')) as HTMLElement[];
    const targetButton = buttons.find((button) => edgeHandle(button.dataset.actionHandle) === targetHandle);
    targetButton?.classList.add('active');
}

// Preview do no
function getNodePreview(node: FlowNode) {
    switch (node.type) {
        case 'message':
        case 'message_once':
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
            if (isIntentTrigger(node)) return '';
            return 'Novo contato';
        default:
            return '';
    }
}

// Selecionar no
function selectNode(id: string) {
    deselectNode();
    selectedNode = nodes.find(n => n.id === id);
    resetPendingNodeDraft();
    clearSelectedOutputActionContext();
    
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
    resetPendingNodeDraft();
    clearSelectedOutputActionContext();
    setPropertiesPanelTitle('Propriedade');
    const propertiesContent = document.getElementById('propertiesContent') as HTMLElement | null;
    if (propertiesContent) {
        propertiesContent.innerHTML = '<p style="color: var(--gray); font-size: 14px;">Selecione um bloco para editar suas propriedades.</p>';
    }
}

// Deletar no
function deleteNode(id: string) {
    if (isFlowReadOnlyMode()) return;
    const node = nodes.find((item) => item.id === id);
    if (isProtectedFlowBoundaryNode(node)) return;
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
    if (isFlowReadOnlyMode()) return;
    event?.preventDefault();
    event?.stopPropagation();

    const sourceNode = nodes.find((node) => node.id === id);
    if (!sourceNode) return;
    if (isProtectedFlowBoundaryNode(sourceNode)) return;

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

function resetPendingNodeDraft() {
    pendingNodeDraft = null;
    pendingNodeDraftId = null;
}

function ensurePendingNodeDraft() {
    if (!selectedNode) return null;
    if (!pendingNodeDraft || pendingNodeDraftId !== selectedNode.id) {
        pendingNodeDraft = {};
        pendingNodeDraftId = selectedNode.id;
    }
    return pendingNodeDraft;
}

function getNodePropValue<T = any>(key: keyof NodeData, fallback: T): T {
    if (!selectedNode) return fallback;
    if (pendingNodeDraft && pendingNodeDraftId === selectedNode.id && Object.prototype.hasOwnProperty.call(pendingNodeDraft, key)) {
        return (pendingNodeDraft as any)[key];
    }
    const currentValue = (selectedNode.data as any)[key];
    return (currentValue === undefined ? fallback : currentValue) as T;
}

function hasPendingNodeDraftChanges() {
    if (!selectedNode) return false;
    if (!pendingNodeDraft || pendingNodeDraftId !== selectedNode.id) return false;
    return Object.keys(pendingNodeDraft).length > 0;
}

// Renderizar propriedades
function renderProperties() {
    if (!selectedNode) return;
    
    const container = document.getElementById('propertiesContent') as HTMLElement | null;
    if (!container) return;
    let html = '';
    const selectedTypeLabel = getNodeTypeLabel(selectedNode);
    const nodeLabelValue = String(getNodePropValue('label', selectedNode.data.label || ''));
    const isIntentPropertiesMode = isIntentTrigger(selectedNode);
    const isOutputActionMode = Boolean(
        selectedOutputActionContext
        && selectedOutputActionContext.nodeId === selectedNode.id
    );

    setPropertiesPanelTitle(isOutputActionMode ? 'Ação' : 'Propriedade');

    if (isOutputActionMode && selectedOutputActionContext) {
        const selectedHandle = getSelectedOutputActionHandle();
        const outputLabel = String(selectedOutputActionContext.label || '').trim();
        const outputActions = getSelectedOutputActions();
        const outputEntryLabel = getSelectedOutputEntryLabel();
        const showNextBlockTitleField = !isMenuInteractiveIntentNode(selectedNode);

        html += `
            <div class="property-type-summary">
                <h4 class="property-type-summary-value">Saída ${escapeHtml(outputLabel || selectedHandle)}</h4>
            </div>
            ${showNextBlockTitleField ? `
                <div class="property-group">
                    <label>Título no bloco seguinte</label>
                    <input type="text" value="${escapeHtml(outputEntryLabel)}" placeholder="Opcional" onchange="updateSelectedOutputEntryLabel(this.value)">
                </div>
            ` : ''}
            <div class="property-group">
                <div class="output-action-toolbar">
                    <button class="add-condition-btn output-action-add-btn" onclick="toggleOutputActionTypeMenu(event)">+ Adicionar ação</button>
                    <div class="output-action-type-menu${outputActionMenuOpen ? ' is-open' : ''}">
                        <button type="button" onclick="addOutputActionByType('event')">Registrar Evento</button>
                        <button type="button" onclick="addOutputActionByType('status')">Alterar Status</button>
                        <button type="button" onclick="addOutputActionByType('tag')">Adicionar Tag</button>
                        <button type="button" onclick="addOutputActionByType('webhook')">Webhook</button>
                    </div>
                </div>
            </div>
        `;

        if (outputActions.length === 0) {
            html += `
                <div class="output-actions-empty">
                    Nenhuma ação configurada para essa saída.
                </div>
            `;
        } else {
            html += `
                <div class="output-actions-list">
                    ${outputActions.map((actionItem, index) => {
                        const actionType = normalizeOutputActionType(actionItem.type) || 'tag';
                        const actionTypeLabel = getOutputActionTypeLabel(actionType);
                        const statusValue = Number(actionItem.status);
                        const safeStatus = Number.isFinite(statusValue) ? statusValue : 2;
                        const availableEvents = getAvailableCustomEvents();
                        const selectedEventId = Number(actionItem.eventId);

                        let contentHtml = '';
                        if (actionType === 'tag') {
                            contentHtml = `
                                <div class="property-group" style="margin-bottom: 0;">
                                    <label>Nome da Tag</label>
                                    <input type="text" value="${escapeHtml(String(actionItem.tag || ''))}" onchange="updateOutputActionField(${index}, 'tag', this.value)">
                                </div>
                            `;
                        } else if (actionType === 'status') {
                            contentHtml = `
                                <div class="property-group" style="margin-bottom: 0;">
                                    <label>Novo Status</label>
                                    <select onchange="updateOutputActionField(${index}, 'status', parseInt(this.value, 10) || 2)">
                                        <option value="1" ${safeStatus === 1 ? 'selected' : ''}>Etapa 1 - Novo</option>
                                        <option value="2" ${safeStatus === 2 ? 'selected' : ''}>Etapa 2 - Em Negociação</option>
                                        <option value="3" ${safeStatus === 3 ? 'selected' : ''}>Etapa 3 - Fechado</option>
                                        <option value="4" ${safeStatus === 4 ? 'selected' : ''}>Etapa 4 - Perdido</option>
                                    </select>
                                </div>
                            `;
                        } else if (actionType === 'webhook') {
                            contentHtml = `
                                <div class="property-group" style="margin-bottom: 0;">
                                    <label>URL do Webhook</label>
                                    <input type="url" value="${escapeHtml(String(actionItem.url || ''))}" onchange="updateOutputActionField(${index}, 'url', this.value)" placeholder="https://...">
                                </div>
                            `;
                        } else {
                            contentHtml = `
                                <div class="property-group" style="margin-bottom: 10px;">
                                    <label>Evento Personalizado</label>
                                    <select onchange="updateOutputActionEventSelection(${index}, this.value)">
                                        <option value="">Selecione um evento</option>
                                        ${availableEvents.map((eventItem) => `
                                            <option value="${eventItem.id}" ${Number(eventItem.id) === selectedEventId ? 'selected' : ''}>
                                                ${escapeHtml(eventItem.name)}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                            `;
                        }

                        return `
                            <div class="output-action-card">
                                <div class="output-action-card-header">
                                    <span class="output-action-card-type">${escapeHtml(actionTypeLabel)}</span>
                                    <button class="remove-btn" type="button" title="Remover ação" onclick="removeOutputAction(${index})">×</button>
                                </div>
                                <div class="output-action-card-content">
                                    ${contentHtml}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        html += `
            <div class="property-group">
                <button class="btn-confirm-flow-block" onclick="confirmNodePropertyChanges()">
                    Confirmar alterações
                </button>
            </div>
        `;

        container.innerHTML = html;
        return;
    }
    
    html += `
        <div class="property-type-summary">
            <h4 class="property-type-summary-value">${escapeHtml(selectedTypeLabel)}</h4>
        </div>
    `;

    if (!isIntentPropertiesMode) {
        html += `
            <div class="property-group">
                <label>Nome do Bloco</label>
                <input type="text" value="${escapeHtml(nodeLabelValue)}" onchange="updateNodeProperty('label', this.value)">
            </div>
        `;
    }
    
    switch (selectedNode.type) {
        case 'trigger':
        case 'intent':
            if (isIntentTrigger(selectedNode)) {
                const draftRoutes = getNodePropValue('intentRoutes', null as any);
                const routes = Array.isArray(draftRoutes) && draftRoutes.length > 0
                    ? draftRoutes
                    : getIntentRoutes(selectedNode);
                const isMenuIntentNode = isMenuInteractiveIntentNode(selectedNode);
                const intentResponseDelaySeconds = Number.isFinite(Number(getNodePropValue('intentResponseDelaySeconds', selectedNode.data.intentResponseDelaySeconds)))
                    ? Math.max(0, Number(getNodePropValue('intentResponseDelaySeconds', selectedNode.data.intentResponseDelaySeconds)))
                    : 0;
                const intentMenuPrompt = String(getNodePropValue('menuPrompt', selectedNode.data.menuPrompt || 'Escolha uma opção no menu abaixo:'));
                const intentMenuButtonText = String(getNodePropValue('menuButtonText', selectedNode.data.menuButtonText || 'Ver Menu'));
                const intentDefaultResponse = String(getNodePropValue('intentDefaultResponse', selectedNode.data.intentDefaultResponse || ''));
                const intentDefaultFollowupResponse = String(getNodePropValue('intentDefaultFollowupResponse', selectedNode.data.intentDefaultFollowupResponse || ''));
                const intentDefaultFollowupResponses = coerceIntentMessageListForEditor(
                    getNodePropValue('intentDefaultFollowupResponses', (selectedNode.data as any).intentDefaultFollowupResponses || []),
                    intentDefaultFollowupResponse
                );
                const isIntentTriggerNode = selectedNode.type === 'trigger';
                const triggerWelcomeEnabled = isIntentTriggerNode
                    ? Boolean(getNodePropValue('triggerWelcomeEnabled', selectedNode.data.triggerWelcomeEnabled))
                    : false;
                const triggerWelcomeContent = isIntentTriggerNode
                    ? String(getNodePropValue('triggerWelcomeContent', selectedNode.data.triggerWelcomeContent || ''))
                    : '';
                const triggerWelcomeDelaySeconds = isIntentTriggerNode && Number.isFinite(Number(getNodePropValue('triggerWelcomeDelaySeconds', selectedNode.data.triggerWelcomeDelaySeconds)))
                    ? Math.max(0, Number(getNodePropValue('triggerWelcomeDelaySeconds', selectedNode.data.triggerWelcomeDelaySeconds)))
                    : 0;
                const triggerWelcomeRepeatModeRaw = isIntentTriggerNode
                    ? String(getNodePropValue('triggerWelcomeRepeatMode', selectedNode.data.triggerWelcomeRepeatMode || 'always')).trim().toLowerCase()
                    : 'always';
                const triggerWelcomeRepeatMode = ['always', 'hours', 'days'].includes(triggerWelcomeRepeatModeRaw)
                    ? triggerWelcomeRepeatModeRaw
                    : 'always';
                const triggerWelcomeRepeatValue = isIntentTriggerNode && Number.isFinite(Number(getNodePropValue('triggerWelcomeRepeatValue', selectedNode.data.triggerWelcomeRepeatValue)))
                    ? Math.max(1, Math.trunc(Number(getNodePropValue('triggerWelcomeRepeatValue', selectedNode.data.triggerWelcomeRepeatValue))))
                    : 1;
                const defaultSectionExpanded = isIntentPropertySectionExpanded('default', false);
                const welcomeSectionExpanded = isIntentTriggerNode
                    ? isIntentPropertySectionExpanded('welcome', false)
                    : false;

                if (isMenuIntentNode) {
                    html += `
                        <div class="property-group">
                            <label>Nome do Bloco</label>
                            <input type="text" value="${escapeHtml(nodeLabelValue)}" onchange="updateNodeProperty('label', this.value)">
                        </div>
                        <div class="property-group">
                            <label>Mensagem do Menu</label>
                            <textarea onchange="updateNodeProperty('menuPrompt', this.value)">${escapeHtml(intentMenuPrompt)}</textarea>
                        </div>
                        <div class="property-group">
                            <label>Texto do Botão</label>
                            <input type="text" value="${escapeHtml(intentMenuButtonText)}" onchange="updateNodeProperty('menuButtonText', this.value)" placeholder="Ver Menu">
                        </div>
                        <div class="property-group">
                            <label>Opções</label>
                            <div class="intent-routes-editor">
                                ${routes.map((route, index) => `
                                    <div class="intent-menu-option-row">
                                        <input
                                            class="intent-route-name-input"
                                            type="text"
                                            value="${escapeHtml(String(route.label || ''))}"
                                            title="${escapeHtml(String(route.label || '').trim() || ('Opção ' + (index + 1)))}"
                                            placeholder="Ex.: Ver modelos"
                                            onchange="updateIntentRoute(${index}, 'label', this.value)"
                                        >
                                        <button class="remove-btn intent-menu-option-remove-btn" type="button" title="Remover opção" onclick="removeIntentRoute(${index})">×</button>
                                    </div>
                                `).join('')}
                                <button class="add-condition-btn intent-add-route-btn" type="button" onclick="addIntentRoute()">+ Adicionar opção</button>
                            </div>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="property-inline-row">
                            <div class="property-group property-group-compact">
                                <label>Nome do Bloco</label>
                                <input type="text" value="${escapeHtml(nodeLabelValue)}" onchange="updateNodeProperty('label', this.value)">
                            </div>
                            <div class="property-group property-group-compact">
                                <label>Delay</label>
                                <div class="property-input-with-unit">
                                    <input type="number" min="0" step="1" value="${intentResponseDelaySeconds}" onchange="updateNodeProperty('intentResponseDelaySeconds', Math.max(0, parseInt(this.value || '0', 10) || 0))">
                                    <span class="property-unit">s</span>
                                </div>
                            </div>
                        </div>
                    <div class="property-group">
                        <label>Intenções</label>
                        <div class="intent-routes-editor">
                            ${routes.map((route, index) => {
                                const routeTitle = String(route.label || '').trim() || `Intenção ${index + 1}`;
                                const sectionKey = `route:${index}`;
                                const sectionExpanded = isIntentPropertySectionExpanded(sectionKey, false);
                                const routeFollowupResponses = coerceIntentMessageListForEditor(
                                    (route as any)?.followupResponses,
                                    (route as any)?.followupResponse
                                );
                                return `
                                    <div class="intent-config-card intent-config-card-intent ${sectionExpanded ? 'is-expanded' : ''}">
                                        <div class="intent-config-header" role="button" tabindex="0" onclick="toggleIntentPropertySection('${sectionKey}', event)" onkeydown="if(event.key==='Enter'||event.key===' '){toggleIntentPropertySection('${sectionKey}', event);}">
                                            <div class="intent-config-title-wrap">
                                                <span class="intent-config-kind intent-config-kind-intent">Intenção</span>
                                                <span class="intent-config-title">${escapeHtml(routeTitle)}</span>
                                            </div>
                                            <div class="intent-config-header-actions">
                                                <span class="intent-config-chevron">${sectionExpanded ? '▾' : '▸'}</span>
                                                <button class="remove-btn" type="button" title="Remover intenção" onclick="event.stopPropagation(); removeIntentRoute(${index})">×</button>
                                            </div>
                                        </div>
                                        ${sectionExpanded ? `
                                            <div class="intent-config-body">
                                                <div class="intent-route-field">
                                                    <label>Título da saída</label>
                                                    <input class="intent-route-name-input" type="text" value="${escapeHtml(String(route.label || ''))}" title="${escapeHtml(String(route.label || ''))}" placeholder="Ex.: Loja Física" onchange="updateIntentRoute(${index}, 'label', this.value)">
                                                </div>
                                                <div class="intent-route-field">
                                                    <label>Frases que ativam</label>
                                                    <input class="intent-route-phrases-input" type="text" value="${escapeHtml(String(route.phrases || ''))}" title="${escapeHtml(String(route.phrases || ''))}" placeholder="Ex.: endereço da loja, loja física" onchange="updateIntentRoute(${index}, 'phrases', this.value)">
                                                </div>
                                                <div class="intent-route-field">
                                                    <label>Resposta principal</label>
                                                    <textarea class="intent-route-response-input" onchange="updateIntentRoute(${index}, 'response', this.value)">${escapeHtml(String(route.response || ''))}</textarea>
                                                </div>
                                                <div class="intent-route-field">
                                                    <label>Mensagens após a primeira</label>
                                                    <div class="intent-followup-list">
                                                        ${routeFollowupResponses.map((messageText, followupIndex) => `
                                                            <div class="intent-followup-item">
                                                                <textarea class="intent-route-response-input" onchange="updateIntentRouteFollowupMessage(${index}, ${followupIndex}, this.value)">${escapeHtml(String(messageText || ''))}</textarea>
                                                                <button class="remove-btn intent-followup-remove-btn" type="button" title="Remover mensagem extra" onclick="removeIntentRouteFollowupMessage(${index}, ${followupIndex})">×</button>
                                                            </div>
                                                        `).join('')}
                                                    </div>
                                                    <button class="add-condition-btn intent-followup-add-btn" type="button" onclick="addIntentRouteFollowupMessage(${index})">+ Adicionar mensagem extra</button>
                                                </div>
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            }).join('')}
                            <button class="add-condition-btn intent-add-route-btn" onclick="addIntentRoute()">+ Adicionar intenção</button>
                            <div class="intent-config-card intent-config-card-default ${defaultSectionExpanded ? 'is-expanded' : ''}">
                                <div class="intent-config-header" role="button" tabindex="0" onclick="toggleIntentPropertySection('default', event)" onkeydown="if(event.key==='Enter'||event.key===' '){toggleIntentPropertySection('default', event);}">
                                    <div class="intent-config-title-wrap">
                                        <span class="intent-config-kind intent-config-kind-default">Outros</span>
                                        <span class="intent-config-title">Outros</span>
                                    </div>
                                    <div class="intent-config-header-actions">
                                        <span class="intent-config-chevron">${defaultSectionExpanded ? '▾' : '▸'}</span>
                                    </div>
                                </div>
                                ${defaultSectionExpanded ? `
                                    <div class="intent-config-body">
                                        <div class="intent-route-field">
                                            <label>Resposta principal</label>
                                            <textarea class="intent-route-response-input" onchange="updateNodeProperty('intentDefaultResponse', this.value)">${escapeHtml(intentDefaultResponse)}</textarea>
                                        </div>
                                        <div class="intent-route-field">
                                            <label>Mensagens após a primeira</label>
                                            <div class="intent-followup-list">
                                                ${intentDefaultFollowupResponses.map((messageText, followupIndex) => `
                                                    <div class="intent-followup-item">
                                                        <textarea class="intent-route-response-input" onchange="updateIntentDefaultFollowupMessage(${followupIndex}, this.value)">${escapeHtml(String(messageText || ''))}</textarea>
                                                        <button class="remove-btn intent-followup-remove-btn" type="button" title="Remover mensagem extra" onclick="removeIntentDefaultFollowupMessage(${followupIndex})">×</button>
                                                    </div>
                                                `).join('')}
                                            </div>
                                            <button class="add-condition-btn intent-followup-add-btn" type="button" onclick="addIntentDefaultFollowupMessage()">+ Adicionar mensagem extra</button>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                            ${isIntentTriggerNode ? `
                                <div class="intent-config-card intent-config-card-welcome ${welcomeSectionExpanded ? 'is-expanded' : ''}">
                                    <div class="intent-config-header" role="button" tabindex="0" onclick="toggleIntentPropertySection('welcome', event)" onkeydown="if(event.key==='Enter'||event.key===' '){toggleIntentPropertySection('welcome', event);}">
                                        <div class="intent-config-title-wrap">
                                            <span class="intent-config-kind intent-config-kind-welcome">Boas-vindas</span>
                                            <span class="intent-config-title">Boas vindas</span>
                                        </div>
                                        <div class="intent-config-header-actions">
                                            <span class="intent-config-state">${triggerWelcomeEnabled ? 'Ativada' : 'Desativada'}</span>
                                            <span class="intent-config-chevron">${welcomeSectionExpanded ? '▾' : '▸'}</span>
                                        </div>
                                    </div>
                                    ${welcomeSectionExpanded ? `
                                        <div class="intent-config-body">
                                            <div class="flow-toggle-row intent-welcome-toggle-row">
                                                <span class="flow-toggle-label">${triggerWelcomeEnabled ? 'Ativada' : 'Desativada'}</span>
                                                <label class="flow-toggle-switch" title="Ativar boas vindas">
                                                    <input type="checkbox" ${triggerWelcomeEnabled ? 'checked' : ''} onchange="updateNodeProperty('triggerWelcomeEnabled', this.checked)">
                                                    <span class="flow-toggle-slider"></span>
                                                </label>
                                            </div>
                                            ${triggerWelcomeEnabled ? `
                                                <div class="property-group">
                                                    <label>Mensagem</label>
                                                    <textarea onchange="updateNodeProperty('triggerWelcomeContent', this.value)">${escapeHtml(triggerWelcomeContent)}</textarea>
                                                </div>
                                                <div class="property-group intent-welcome-inline-group">
                                                    <div class="intent-welcome-inline-grid">
                                                        <div class="intent-welcome-inline-item intent-welcome-delay-item">
                                                            <label>Delay</label>
                                                            <input type="number" min="0" step="1" value="${triggerWelcomeDelaySeconds}" onchange="updateNodeProperty('triggerWelcomeDelaySeconds', Math.max(0, parseInt(this.value || '0', 10) || 0))">
                                                        </div>
                                                        <div class="intent-welcome-inline-item intent-welcome-repeat-item">
                                                            <label>Não enviar novamente até</label>
                                                            <div class="intent-welcome-repeat-controls">
                                                                ${triggerWelcomeRepeatMode !== 'always' ? `
                                                                    <input class="intent-welcome-repeat-value" type="number" min="1" step="1" value="${triggerWelcomeRepeatValue}" onchange="updateNodeProperty('triggerWelcomeRepeatValue', Math.max(1, parseInt(this.value || '1', 10) || 1))">
                                                                ` : ''}
                                                                <select onchange="updateNodeProperty('triggerWelcomeRepeatMode', this.value)">
                                                                    <option value="always" ${triggerWelcomeRepeatMode === 'always' ? 'selected' : ''}>Nunca enviar</option>
                                                                    <option value="hours" ${triggerWelcomeRepeatMode === 'hours' ? 'selected' : ''}>Horas</option>
                                                                    <option value="days" ${triggerWelcomeRepeatMode === 'days' ? 'selected' : ''}>Dias</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ` : ''}
                                        </div>
                                    ` : ''}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
                }
            }
            break;
            
        case 'message':
        case 'message_once':
            const messageDelaySeconds = Number.isFinite(Number(getNodePropValue('delaySeconds', selectedNode.data.delaySeconds)))
                ? Math.max(0, Number(getNodePropValue('delaySeconds', selectedNode.data.delaySeconds)))
                : 0;
            const isLegacyOnceType = selectedNode.type === 'message_once';
            const isOnceMessageNode = isLegacyOnceType || Boolean(getNodePropValue('isOnceMessage', selectedNode.data.isOnceMessage));
            const onceRepeatModeRaw = String(getNodePropValue('onceRepeatMode', selectedNode.data.onceRepeatMode || 'always')).trim().toLowerCase();
            const onceRepeatMode = ['always', 'hours', 'days'].includes(onceRepeatModeRaw)
                ? onceRepeatModeRaw
                : 'always';
            const onceRepeatValue = Number.isFinite(Number(getNodePropValue('onceRepeatValue', selectedNode.data.onceRepeatValue)))
                ? Math.max(1, Math.trunc(Number(getNodePropValue('onceRepeatValue', selectedNode.data.onceRepeatValue))))
                : 1;
            const messageContent = String(getNodePropValue('content', selectedNode.data.content || ''));
            html += `
                <div class="property-group">
                    <label>${isOnceMessageNode ? 'Conteúdo da Mensagem' : 'Conteúdo da Mensagem'}</label>
                    <textarea id="messageContent" onchange="updateNodeProperty('content', this.value)">${escapeHtml(messageContent)}</textarea>
                </div>
                <div class="property-group">
                    <label>Delay antes de enviar (segundos)</label>
                    <input type="number" min="0" step="1" value="${messageDelaySeconds}" onchange="updateNodeProperty('delaySeconds', Math.max(0, parseInt(this.value || '0', 10) || 0))">
                </div>
            `;
            if (!isLegacyOnceType) {
                html += `
                    <div class="property-group">
                        <label>Mensagem Única</label>
                        <div class="flow-toggle-row">
                            <span class="flow-toggle-label">${isOnceMessageNode ? 'Ativada' : 'Desativada'}</span>
                            <label class="flow-toggle-switch" title="Ativar mensagem única">
                                <input type="checkbox" ${isOnceMessageNode ? 'checked' : ''} onchange="updateNodeProperty('isOnceMessage', this.checked)">
                                <span class="flow-toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                `;
            }
            if (isOnceMessageNode) {
                html += `
                    <div class="property-group">
                        <label>Tempo sem reenviar</label>
                        <select onchange="updateNodeProperty('onceRepeatMode', this.value)">
                            <option value="always" ${onceRepeatMode === 'always' ? 'selected' : ''}>Sempre (não reenviar)</option>
                            <option value="hours" ${onceRepeatMode === 'hours' ? 'selected' : ''}>Em horas</option>
                            <option value="days" ${onceRepeatMode === 'days' ? 'selected' : ''}>Em dias</option>
                        </select>
                    </div>
                `;
                if (onceRepeatMode !== 'always') {
                    html += `
                        <div class="property-group">
                            <label>${onceRepeatMode === 'hours' ? 'Quantidade de horas' : 'Quantidade de dias'}</label>
                            <input type="number" min="1" step="1" value="${onceRepeatValue}" onchange="updateNodeProperty('onceRepeatValue', Math.max(1, parseInt(this.value || '1', 10) || 1))">
                        </div>
                    `;
                }
            }
            break;
            
        case 'wait':
            const waitTimeout = Number.isFinite(Number(getNodePropValue('timeout', selectedNode.data.timeout || 300)))
                ? Math.max(1, Number(getNodePropValue('timeout', selectedNode.data.timeout || 300)))
                : 300;
            const waitResponseModeRaw = String(getNodePropValue('responseMode', selectedNode.data.responseMode || 'text')).trim().toLowerCase();
            const waitResponseMode = waitResponseModeRaw === 'menu' ? 'menu' : 'text';
            const waitMenuPrompt = String(getNodePropValue('menuPrompt', selectedNode.data.menuPrompt || 'Selecione uma opção no menu abaixo:'));
            const waitMenuButtonText = String(getNodePropValue('menuButtonText', selectedNode.data.menuButtonText || 'Ver Menu'));
            const waitMenuSectionTitle = String(getNodePropValue('menuSectionTitle', selectedNode.data.menuSectionTitle || 'Opções'));
            const waitMenuTitle = String(getNodePropValue('menuTitle', selectedNode.data.menuTitle || ''));
            const waitMenuFooter = String(getNodePropValue('menuFooter', selectedNode.data.menuFooter || ''));
            html += `
                <div class="property-group">
                    <label>Timeout (segundos)</label>
                    <input type="number" value="${waitTimeout}" onchange="updateNodeProperty('timeout', Math.max(1, parseInt(this.value || '300', 10) || 300))">
                </div>
                <div class="property-group">
                    <label>Modo de Resposta</label>
                    <select onchange="updateNodeProperty('responseMode', this.value)">
                        <option value="text" ${waitResponseMode === 'text' ? 'selected' : ''}>Texto livre (atual)</option>
                        <option value="menu" ${waitResponseMode === 'menu' ? 'selected' : ''}>Menu interativo</option>
                    </select>
                </div>
            `;
            if (waitResponseMode === 'menu') {
                html += `
                    <div class="property-group">
                        <label>Mensagem do Menu</label>
                        <textarea onchange="updateNodeProperty('menuPrompt', this.value)">${escapeHtml(waitMenuPrompt)}</textarea>
                    </div>
                    <div class="property-group">
                        <label>Texto do Botão</label>
                        <input type="text" value="${escapeHtml(waitMenuButtonText)}" onchange="updateNodeProperty('menuButtonText', this.value)" placeholder="Ver Menu">
                    </div>
                    <div class="property-group">
                        <label>Título da Seção</label>
                        <input type="text" value="${escapeHtml(waitMenuSectionTitle)}" onchange="updateNodeProperty('menuSectionTitle', this.value)" placeholder="Opções">
                    </div>
                    <div class="property-group">
                        <label>Título (opcional)</label>
                        <input type="text" value="${escapeHtml(waitMenuTitle)}" onchange="updateNodeProperty('menuTitle', this.value)">
                    </div>
                    <div class="property-group">
                        <label>Rodapé (opcional)</label>
                        <input type="text" value="${escapeHtml(waitMenuFooter)}" onchange="updateNodeProperty('menuFooter', this.value)">
                    </div>
                `;
            }
            break;
            
        case 'condition':
            const conditionItems = Array.isArray(getNodePropValue('conditions', selectedNode.data.conditions || []))
                ? (getNodePropValue('conditions', selectedNode.data.conditions || []) as Array<{ value: string; next?: string }>)
                : [];
            const conditionResponseModeRaw = String(getNodePropValue('responseMode', selectedNode.data.responseMode || 'text')).trim().toLowerCase();
            const conditionResponseMode = conditionResponseModeRaw === 'menu' ? 'menu' : 'text';
            const conditionMenuPrompt = String(getNodePropValue('menuPrompt', selectedNode.data.menuPrompt || 'Selecione uma opção no menu abaixo:'));
            const conditionMenuButtonText = String(getNodePropValue('menuButtonText', selectedNode.data.menuButtonText || 'Ver Menu'));
            const conditionMenuSectionTitle = String(getNodePropValue('menuSectionTitle', selectedNode.data.menuSectionTitle || 'Opções'));
            const conditionMenuTitle = String(getNodePropValue('menuTitle', selectedNode.data.menuTitle || ''));
            const conditionMenuFooter = String(getNodePropValue('menuFooter', selectedNode.data.menuFooter || ''));
            html += `
                <div class="property-group">
                    <label>Condições</label>
                    <div class="conditions-editor" id="conditionsEditor">
                        ${conditionItems.map((c, i) => `
                            <div class="condition-row">
                                <input type="text" value="${c.value}" placeholder="Valor" onchange="updateCondition(${i}, 'value', this.value)">
                                <button class="remove-btn" onclick="removeCondition(${i})">×</button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="add-condition-btn" onclick="addCondition()">+ Adicionar Condição</button>
                </div>
                <div class="property-group">
                    <label>Modo de Resposta</label>
                    <select onchange="updateNodeProperty('responseMode', this.value)">
                        <option value="text" ${conditionResponseMode === 'text' ? 'selected' : ''}>Texto livre (atual)</option>
                        <option value="menu" ${conditionResponseMode === 'menu' ? 'selected' : ''}>Menu interativo</option>
                    </select>
                </div>
            `;
            if (conditionResponseMode === 'menu') {
                html += `
                    <div class="property-group">
                        <label>Mensagem do Menu</label>
                        <textarea onchange="updateNodeProperty('menuPrompt', this.value)">${escapeHtml(conditionMenuPrompt)}</textarea>
                    </div>
                    <div class="property-group">
                        <label>Texto do Botão</label>
                        <input type="text" value="${escapeHtml(conditionMenuButtonText)}" onchange="updateNodeProperty('menuButtonText', this.value)" placeholder="Ver Menu">
                    </div>
                    <div class="property-group">
                        <label>Título da Seção</label>
                        <input type="text" value="${escapeHtml(conditionMenuSectionTitle)}" onchange="updateNodeProperty('menuSectionTitle', this.value)" placeholder="Opções">
                    </div>
                    <div class="property-group">
                        <label>Título (opcional)</label>
                        <input type="text" value="${escapeHtml(conditionMenuTitle)}" onchange="updateNodeProperty('menuTitle', this.value)">
                    </div>
                    <div class="property-group">
                        <label>Rodapé (opcional)</label>
                        <input type="text" value="${escapeHtml(conditionMenuFooter)}" onchange="updateNodeProperty('menuFooter', this.value)">
                    </div>
                `;
            }
            break;
            
        case 'delay':
            const delaySeconds = Number.isFinite(Number(getNodePropValue('seconds', selectedNode.data.seconds || 5)))
                ? Math.max(0, Number(getNodePropValue('seconds', selectedNode.data.seconds || 5)))
                : 5;
            html += `
                <div class="property-group">
                    <label>Tempo de Espera (segundos)</label>
                    <input type="number" value="${delaySeconds}" onchange="updateNodeProperty('seconds', Math.max(0, parseInt(this.value || '5', 10) || 5))">
                </div>
            `;
            break;
            
        case 'transfer':
            const transferMessage = String(getNodePropValue('message', selectedNode.data.message || ''));
            html += `
                <div class="property-group">
                    <label>Mensagem de Transferência</label>
                    <textarea onchange="updateNodeProperty('message', this.value)">${escapeHtml(transferMessage)}</textarea>
                </div>
            `;
            break;
            
        case 'tag':
            const tagName = String(getNodePropValue('tag', selectedNode.data.tag || ''));
            html += `
                <div class="property-group">
                    <label>Nome da Tag</label>
                    <input type="text" value="${escapeHtml(tagName)}" onchange="updateNodeProperty('tag', this.value)">
                </div>
            `;
            break;
            
        case 'status':
            const statusValue = Number(getNodePropValue('status', selectedNode.data.status));
            html += `
                <div class="property-group">
                    <label>Novo Status</label>
                    <select onchange="updateNodeProperty('status', parseInt(this.value))">
                        <option value="1" ${statusValue === 1 ? 'selected' : ''}>Etapa 1 - Novo</option>
                        <option value="2" ${statusValue === 2 ? 'selected' : ''}>Etapa 2 - Em Negociação</option>
                        <option value="3" ${statusValue === 3 ? 'selected' : ''}>Etapa 3 - Fechado</option>
                        <option value="4" ${statusValue === 4 ? 'selected' : ''}>Etapa 4 - Perdido</option>
                    </select>
                </div>
            `;
            break;

        case 'event':
            const availableEvents = getAvailableCustomEvents();
            const selectedEventId = Number(getNodePropValue('eventId', selectedNode.data.eventId));
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
                </div>
            `;
            break;
            
        case 'webhook':
            const webhookUrl = String(getNodePropValue('url', selectedNode.data.url || ''));
            html += `
                <div class="property-group">
                    <label>URL do Webhook</label>
                    <input type="url" value="${escapeHtml(webhookUrl)}" onchange="updateNodeProperty('url', this.value)" placeholder="https://...">
                </div>
            `;
            break;
    }

    html += `
        <div class="property-group">
            <button class="btn-confirm-flow-block" onclick="confirmNodePropertyChanges()">
                Confirmar alterações
            </button>
        </div>
    `;

    container.innerHTML = html;
}

function openOutputActionEditor(nodeId: string, encodedHandle: string, encodedLabel = '', event?: Event) {
    if (isFlowReadOnlyMode()) return;
    event?.preventDefault();
    event?.stopPropagation();

    const node = nodes.find((item) => item.id === nodeId);
    if (!node || node.type === 'end') return;

    selectNode(nodeId);
    selectedOutputActionContext = {
        nodeId,
        handle: edgeHandle(decodeOutputActionParam(encodedHandle)),
        label: decodeOutputActionParam(encodedLabel)
    };
    outputActionMenuOpen = false;
    refreshOutputActionTriggerState();
    renderProperties();
}

function toggleOutputActionTypeMenu(event?: Event) {
    if (isFlowReadOnlyMode()) return;
    event?.preventDefault();
    event?.stopPropagation();
    outputActionMenuOpen = !outputActionMenuOpen;
    renderProperties();
}

function addOutputActionByType(type: string) {
    if (isFlowReadOnlyMode()) return;
    const actionType = normalizeOutputActionType(type);
    if (!actionType) return;

    const currentActions = getSelectedOutputActions();
    const nextActions = [
        ...currentActions.map((item) => ({ ...item })),
        buildDefaultOutputAction(actionType)
    ];
    updateSelectedOutputActions(nextActions);
    outputActionMenuOpen = false;
    renderProperties();
}

function updateOutputActionField(index: number, field: 'tag' | 'status' | 'url', value: any) {
    if (isFlowReadOnlyMode()) return;
    const currentActions = getSelectedOutputActions();
    if (!currentActions[index]) return;

    const nextActions = currentActions.map((item) => ({ ...item }));
    (nextActions[index] as any)[field] = value;
    updateSelectedOutputActions(nextActions);
}

function updateOutputActionEventSelection(index: number, value: string) {
    if (isFlowReadOnlyMode()) return;
    const currentActions = getSelectedOutputActions();
    if (!currentActions[index]) return;

    const nextActions = currentActions.map((item) => ({ ...item }));
    const parsedEventId = Number.parseInt(String(value || '').trim(), 10);
    const actionItem = nextActions[index];

    if (!Number.isFinite(parsedEventId) || parsedEventId <= 0) {
        actionItem.eventId = null;
        actionItem.eventKey = '';
        actionItem.eventName = '';
        updateSelectedOutputActions(nextActions);
        renderProperties();
        return;
    }

    const selectedEvent = customEventsCache.find((item) => Number(item.id) === parsedEventId);
    actionItem.eventId = parsedEventId;
    actionItem.eventKey = String(selectedEvent?.event_key || '').trim();
    actionItem.eventName = String(selectedEvent?.name || '').trim();
    updateSelectedOutputActions(nextActions);
    renderProperties();
}

function removeOutputAction(index: number) {
    if (isFlowReadOnlyMode()) return;
    const currentActions = getSelectedOutputActions();
    if (!currentActions[index]) return;
    const nextActions = currentActions.filter((_, itemIndex) => itemIndex !== index);
    updateSelectedOutputActions(nextActions);
    renderProperties();
}

// Atualizar propriedade do no
function updateNodeProperty(key: keyof NodeData, value: any) {
    if (isFlowReadOnlyMode()) return;
    if (!selectedNode) return;

    const draft = ensurePendingNodeDraft();
    if (!draft) return;
    (draft as any)[key] = value;

    if (
        key === 'onceRepeatMode'
        || key === 'isOnceMessage'
        || key === 'outputActions'
        || key === 'triggerWelcomeEnabled'
        || key === 'triggerWelcomeRepeatMode'
    ) {
        renderProperties();
    }
}

function confirmNodePropertyChanges() {
    if (isFlowReadOnlyMode()) return;
    if (!selectedNode) return;
    if (!pendingNodeDraft || pendingNodeDraftId !== selectedNode.id) return;

    const changedEntries = Object.entries(pendingNodeDraft);
    const hasIntentRoutesDraft = Object.prototype.hasOwnProperty.call(pendingNodeDraft, 'intentRoutes');
    const targetNodeIdsToRerender = new Set<string>();
    if (changedEntries.length === 0) {
        notify('info', 'Sem alterações', 'Nenhuma alteração pendente neste bloco.');
        return;
    }

    for (const [key, value] of changedEntries) {
        if (key === 'outputActions') {
            selectedNode.data.outputActions = sanitizeOutputActionsMap(value);
            continue;
        }

        if (key === 'outputEntryLabels') {
            selectedNode.data.outputEntryLabels = sanitizeOutputEntryLabelsMap(value);
            edges.forEach((edge) => {
                if (edge.source === selectedNode?.id) {
                    targetNodeIdsToRerender.add(String(edge.target || '').trim());
                }
            });
            continue;
        }

        (selectedNode.data as any)[key] = value;
        if (key === 'keyword' && isIntentTrigger(selectedNode) && !hasIntentRoutesDraft) {
            selectedNode.data.intentRoutes = parsePhraseList(String(value || '')).map((phrase, index) => ({
                id: normalizeRouteId(`intent-${index + 1}`),
                label: phrase,
                phrases: phrase,
                response: '',
                followupResponse: '',
                followupResponses: []
            }));
        }
    }

    if (isIntentTrigger(selectedNode)) {
        applyFlowBuilderModeToIntentNode(selectedNode, getCurrentFlowBuilderMode());
    }

    resetPendingNodeDraft();
    rerenderNode(selectedNode.id);
    targetNodeIdsToRerender.forEach((targetNodeId) => {
        if (!targetNodeId || targetNodeId === selectedNode?.id) return;
        rerenderNode(targetNodeId);
    });
    renderProperties();
    markFlowDirty();
    notify('success', 'Bloco atualizado', 'Alterações confirmadas com sucesso.');
}

function updateEventNodeSelection(value: string) {
    if (isFlowReadOnlyMode()) return;
    if (!selectedNode || selectedNode.type !== 'event') return;

    const eventId = Number.parseInt(String(value || '').trim(), 10);
    if (!Number.isFinite(eventId) || eventId <= 0) {
        updateNodeProperty('eventId', null);
        updateNodeProperty('eventKey', '');
        updateNodeProperty('eventName', '');
        renderProperties();
        return;
    }

    const selected = customEventsCache.find((item) => Number(item.id) === eventId);
    updateNodeProperty('eventId', eventId);
    updateNodeProperty('eventKey', String(selected?.event_key || '').trim());
    updateNodeProperty('eventName', String(selected?.name || '').trim());
    renderProperties();
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
    refreshOutputActionTriggerState();
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
    if (isFlowReadOnlyMode()) return;
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

    const validSourceHandles = new Set(getOutputHandles(node).map((item) => edgeHandle(item.handle)));
    const validTargetHandles = new Set(getInputHandles(node).map((item) => edgeHandle(item.handle)));
    edges = edges.filter((edge) => {
        if (edge.source === nodeId) {
            return validSourceHandles.has(edgeHandle(edge.sourceHandle));
        }

        if (edge.target === nodeId) {
            if (node.type === 'trigger') return false;
            return validTargetHandles.has(edgeHandle(edge.targetHandle));
        }

        return true;
    });
}

function cleanupInvalidEdgesForAllNodes() {
    nodes.forEach((node) => cleanupInvalidEdgesForNode(node.id));
}

function getEditableIntentRoutesDraft() {
    if (!selectedNode || !isIntentTrigger(selectedNode)) return [];
    const existingDraft = getNodePropValue('intentRoutes', null as any);
    const baseRoutes = Array.isArray(existingDraft) && existingDraft.length > 0
        ? existingDraft
        : getIntentRoutes(selectedNode);

    return baseRoutes.map((route: any, routeIndex: number) => {
        const followupResponses = coerceIntentMessageListForEditor(
            route?.followupResponses,
            route?.followupResponse
        );
        return {
            id: String(route?.id || normalizeRouteId(`intent-${routeIndex + 1}`)),
            label: String(route?.label || ''),
            phrases: String(route?.phrases || ''),
            response: String(route?.response || ''),
            followupResponse: resolveIntentLegacyFollowupMessage(followupResponses),
            followupResponses
        };
    });
}

function commitIntentRoutesDraft(routes: Array<{
    id: string;
    label: string;
    phrases: string;
    response: string;
    followupResponse?: string;
    followupResponses?: string[];
}>) {
    const normalizedRoutes = routes.map((route) => {
        const followupResponses = coerceIntentMessageListForEditor(
            route.followupResponses,
            route.followupResponse
        );
        return {
            ...route,
            followupResponses,
            followupResponse: resolveIntentLegacyFollowupMessage(followupResponses)
        };
    });
    const allPhrases = normalizedRoutes.flatMap((route) => parsePhraseList(route.phrases || ''));
    const uniquePhrases = Array.from(new Set(allPhrases));
    updateNodeProperty('intentRoutes', normalizedRoutes);
    updateNodeProperty('keyword', uniquePhrases.join(', '));
}

function getIntentDefaultFollowupMessagesDraft() {
    if (!selectedNode || !isIntentTrigger(selectedNode)) return [];
    const draftList = getNodePropValue('intentDefaultFollowupResponses', (selectedNode.data as any).intentDefaultFollowupResponses || []);
    const draftLegacy = getNodePropValue('intentDefaultFollowupResponse', selectedNode.data.intentDefaultFollowupResponse || '');
    return coerceIntentMessageListForEditor(draftList, draftLegacy);
}

function commitIntentDefaultFollowupMessagesDraft(messages: string[]) {
    const nextMessages = coerceIntentMessageListForEditor(messages, '');
    updateNodeProperty('intentDefaultFollowupResponses', nextMessages);
    updateNodeProperty('intentDefaultFollowupResponse', resolveIntentLegacyFollowupMessage(nextMessages));
}

function addIntentRoute() {
    if (isFlowReadOnlyMode()) return;
    if (!selectedNode || !isIntentTrigger(selectedNode)) return;
    const routes = getEditableIntentRoutesDraft();

    const nextIndex = routes.length + 1;
    const nextLabelPrefix = isMenuInteractiveIntentNode(selectedNode) ? 'Opção' : 'Intenção';
    const nextRoute = {
        id: normalizeRouteId(`intent-${Date.now()}-${nextIndex}`),
        label: `${nextLabelPrefix} ${nextIndex}`,
        phrases: '',
        response: '',
        followupResponse: '',
        followupResponses: []
    };

    const nextRoutes = [...routes, nextRoute];
    commitIntentRoutesDraft(nextRoutes);
    setIntentPropertySectionExpanded(`route:${nextRoutes.length - 1}`, true);
    renderProperties();
}

function updateIntentRoute(index: number, key: 'label' | 'phrases' | 'response' | 'followupResponse', value: string) {
    if (isFlowReadOnlyMode()) return;
    if (!selectedNode || !isIntentTrigger(selectedNode)) return;
    const routes = getEditableIntentRoutesDraft();
    if (!routes[index]) return;

    if (key === 'followupResponse') {
        routes[index].followupResponses = [String(value || '')];
        routes[index].followupResponse = String(value || '');
    } else {
        (routes[index] as any)[key] = String(value || '');
    }

    commitIntentRoutesDraft(routes);
    renderProperties();
}

function addIntentRouteFollowupMessage(routeIndex: number) {
    if (isFlowReadOnlyMode()) return;
    if (!selectedNode || !isIntentTrigger(selectedNode)) return;
    const routes = getEditableIntentRoutesDraft();
    if (!routes[routeIndex]) return;

    const followupResponses = coerceIntentMessageListForEditor(
        routes[routeIndex].followupResponses,
        routes[routeIndex].followupResponse
    );
    followupResponses.push('');
    routes[routeIndex].followupResponses = followupResponses;
    commitIntentRoutesDraft(routes);
    renderProperties();
}

function updateIntentRouteFollowupMessage(routeIndex: number, followupIndex: number, value: string) {
    if (isFlowReadOnlyMode()) return;
    if (!selectedNode || !isIntentTrigger(selectedNode)) return;
    const routes = getEditableIntentRoutesDraft();
    if (!routes[routeIndex]) return;

    const followupResponses = coerceIntentMessageListForEditor(
        routes[routeIndex].followupResponses,
        routes[routeIndex].followupResponse
    );
    if (followupIndex < 0 || followupIndex >= followupResponses.length) return;

    followupResponses[followupIndex] = String(value || '');
    routes[routeIndex].followupResponses = followupResponses;
    commitIntentRoutesDraft(routes);
}

function removeIntentRouteFollowupMessage(routeIndex: number, followupIndex: number) {
    if (isFlowReadOnlyMode()) return;
    if (!selectedNode || !isIntentTrigger(selectedNode)) return;
    const routes = getEditableIntentRoutesDraft();
    if (!routes[routeIndex]) return;

    const followupResponses = coerceIntentMessageListForEditor(
        routes[routeIndex].followupResponses,
        routes[routeIndex].followupResponse
    );
    if (followupIndex < 0 || followupIndex >= followupResponses.length) return;

    followupResponses.splice(followupIndex, 1);
    routes[routeIndex].followupResponses = followupResponses;
    commitIntentRoutesDraft(routes);
    renderProperties();
}

function addIntentDefaultFollowupMessage() {
    if (isFlowReadOnlyMode()) return;
    if (!selectedNode || !isIntentTrigger(selectedNode)) return;
    const messages = getIntentDefaultFollowupMessagesDraft();
    messages.push('');
    commitIntentDefaultFollowupMessagesDraft(messages);
    renderProperties();
}

function updateIntentDefaultFollowupMessage(index: number, value: string) {
    if (isFlowReadOnlyMode()) return;
    if (!selectedNode || !isIntentTrigger(selectedNode)) return;
    const messages = getIntentDefaultFollowupMessagesDraft();
    if (index < 0 || index >= messages.length) return;
    messages[index] = String(value || '');
    commitIntentDefaultFollowupMessagesDraft(messages);
}

function removeIntentDefaultFollowupMessage(index: number) {
    if (isFlowReadOnlyMode()) return;
    if (!selectedNode || !isIntentTrigger(selectedNode)) return;
    const messages = getIntentDefaultFollowupMessagesDraft();
    if (index < 0 || index >= messages.length) return;
    messages.splice(index, 1);
    commitIntentDefaultFollowupMessagesDraft(messages);
    renderProperties();
}

function removeIntentRoute(index: number) {
    if (isFlowReadOnlyMode()) return;
    if (!selectedNode || !isIntentTrigger(selectedNode)) return;
    const routes = getEditableIntentRoutesDraft();
    if (!routes[index]) return;

    routes.splice(index, 1);
    commitIntentRoutesDraft(routes);
    clearIntentRouteSectionExpandedStateForSelectedNode();
    if (routes.length > 0) {
        const fallbackIndex = Math.max(0, Math.min(index, routes.length - 1));
        setIntentPropertySectionExpanded(`route:${fallbackIndex}`, true);
    }
    renderProperties();
}

// Condicoes
function addCondition() {
    if (isFlowReadOnlyMode()) return;
    if (!selectedNode || selectedNode.type !== 'condition') return;

    const currentConditions = Array.isArray(getNodePropValue('conditions', selectedNode.data.conditions || []))
        ? (getNodePropValue('conditions', selectedNode.data.conditions || []) as Array<{ value: string; next?: string }>)
        : [];
    const nextConditions = [
        ...currentConditions.map((item) => ({
            value: String(item?.value || ''),
            next: String(item?.next || '')
        })),
        { value: '', next: '' }
    ];
    updateNodeProperty('conditions', nextConditions);
    renderProperties();
}

function updateCondition(index: number, key: 'value' | 'next', value: string) {
    if (isFlowReadOnlyMode()) return;
    if (!selectedNode || selectedNode.type !== 'condition') return;
    const currentConditions = Array.isArray(getNodePropValue('conditions', selectedNode.data.conditions || []))
        ? (getNodePropValue('conditions', selectedNode.data.conditions || []) as Array<{ value: string; next?: string }>)
        : [];
    if (!currentConditions[index]) return;
    const nextConditions = currentConditions.map((item, itemIndex) => ({
        value: String(item?.value || ''),
        next: String(item?.next || '')
    }));
    nextConditions[index][key] = value;
    updateNodeProperty('conditions', nextConditions);
}

function removeCondition(index: number) {
    if (isFlowReadOnlyMode()) return;
    if (!selectedNode || selectedNode.type !== 'condition') return;
    const currentConditions = Array.isArray(getNodePropValue('conditions', selectedNode.data.conditions || []))
        ? (getNodePropValue('conditions', selectedNode.data.conditions || []) as Array<{ value: string; next?: string }>)
        : [];
    if (!currentConditions[index]) return;
    const nextConditions = currentConditions
        .map((item) => ({
            value: String(item?.value || ''),
            next: String(item?.next || '')
        }))
        .filter((_, itemIndex) => itemIndex !== index);
    updateNodeProperty('conditions', nextConditions);
    renderProperties();
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
    if (isFlowReadOnlyMode()) return;
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

function endConnection(nodeId: string, portType: string, targetHandle = DEFAULT_HANDLE) {
    if (isFlowReadOnlyMode()) return;
    if (!isConnecting || !connectionStart) return;

    if (portType !== 'input' || connectionStart.nodeId === nodeId) {
        cancelConnection();
        return;
    }

    const normalizedTargetHandle = edgeHandle(targetHandle);
    const sourceNode = nodes.find((node) => node.id === connectionStart.nodeId) || null;
    const sourceEntryLabelMap = getOutputEntryLabelsMapForNode(sourceNode);
    const sourceEntryLabel = String(
        sourceEntryLabelMap[edgeHandle(connectionStart.handle)] || ''
    ).trim();
    const newEdge: Edge = {
        source: connectionStart.nodeId,
        target: nodeId,
        sourceHandle: edgeHandle(connectionStart.handle),
        targetHandle: normalizedTargetHandle,
        label: connectionStart.label || undefined,
        inputLabel: sourceEntryLabel || undefined
    };
    const targetNode = nodes.find((node) => node.id === newEdge.target);
    const sourceIsIntentTrigger = isIntentTrigger(sourceNode);
    const allowMultipleIncomingOnHandle = targetNode?.type === 'intent' || targetNode?.type === 'end';

    edges = edges.filter((edge) => {
        if (
            !allowMultipleIncomingOnHandle
            &&
            edge.target === newEdge.target
            && edgeHandle(edge.targetHandle) === normalizedTargetHandle
        ) {
            return false;
        }
        if (
            sourceIsIntentTrigger
            && edge.source === newEdge.source
            && edgeHandle(edge.sourceHandle) === edgeHandle(newEdge.sourceHandle)
        ) {
            return false;
        }
        return true;
    });

    const exists = edges.some((edge) => isSameEdge(edge, newEdge));
    if (!exists) {
        edges.push(newEdge);
        rerenderNode(newEdge.target);
        if (selectedNode?.id === newEdge.source || selectedNode?.id === newEdge.target) {
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
        const classes = ['connection-line'];
        if (isIntentDefaultToMessageOnceEdge(edge)) {
            classes.push('connection-line-intent-default-once');
        }
        path.setAttribute('class', classes.join(' '));

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
    const preservedFlowBuilderMode = getCurrentFlowBuilderMode();
    resetEditorState();
    initializeDefaultIntentFlowSkeleton({
        selectTrigger: true,
        markDirty: true,
        flowBuilderMode: preservedFlowBuilderMode
    });
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
    currentFlowSessionId = '';
    currentFlowBuilderMode = 'humanized';
    zoom = 1;
    pan = { x: 0, y: 0 };

    const canvasContainer = document.getElementById('canvasContainer') as HTMLElement | null;
    if (canvasContainer) {
        canvasContainer.innerHTML = `
        <div class="empty-canvas" id="emptyCanvas">
            <div class="icon icon-flows"></div>
            <h3>Comece criando seu fluxo</h3>
            <p>Use + Novo Bloco para adicionar uma intencao</p>
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
    currentFlowBuilderMode = inferFlowBuilderModeFromNodes(nodes);

    nodes = nodes.map((node) => {
        node.data.collapsed = false;
        node.data.outputActions = sanitizeOutputActionsMap(
            node.data?.outputActions || (node.data as any)?.output_actions || {}
        );
        if (!String(node.data?.label || '').trim()) {
            node.data.label = getNodeTypeLabel(node);
        }

        node.data.outputEntryLabels = sanitizeOutputEntryLabelsMap((node.data as any)?.outputEntryLabels);
        if (node.type === 'message_once') {
            node.type = 'message';
            node.data.isOnceMessage = true;
            if (!String(node.data?.label || '').trim() || String(node.data?.label || '').trim().toLowerCase() === 'mensagem única') {
                node.data.label = 'Mensagem';
            }
        }

        if (node.type === 'message' || node.type === 'message_once') {
            const rawDelay = Number(node.data?.delaySeconds);
            node.data.delaySeconds = Number.isFinite(rawDelay) ? Math.max(0, rawDelay) : 0;
            const isOnceMessage = node.type === 'message_once'
                || Boolean((node.data as any)?.isOnceMessage);
            node.data.isOnceMessage = isOnceMessage;
            const modeRaw = String((node.data as any)?.onceRepeatMode || '').trim().toLowerCase();
            node.data.onceRepeatMode = ['always', 'hours', 'days'].includes(modeRaw)
                ? modeRaw
                : 'always';
            const valueRaw = Number((node.data as any)?.onceRepeatValue);
            node.data.onceRepeatValue = Number.isFinite(valueRaw) && valueRaw > 0
                ? Math.max(1, Math.trunc(valueRaw))
                : 1;
        }

        if (node.type === 'wait' || node.type === 'condition') {
            const rawResponseMode = String((node.data as any)?.responseMode || '').trim().toLowerCase();
            node.data.responseMode = rawResponseMode === 'menu' ? 'menu' : 'text';
            node.data.menuPrompt = String((node.data as any)?.menuPrompt || '').trim() || 'Selecione uma opção no menu abaixo:';
            node.data.menuButtonText = String((node.data as any)?.menuButtonText || '').trim() || 'Ver Menu';
            node.data.menuSectionTitle = String((node.data as any)?.menuSectionTitle || '').trim() || 'Opções';
            node.data.menuTitle = String((node.data as any)?.menuTitle || '').trim();
            node.data.menuFooter = String((node.data as any)?.menuFooter || '').trim();
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
                const normalizedTriggerLabel = String(node.data?.label || '').trim().toLowerCase();
                if (!normalizedTriggerLabel || normalizedTriggerLabel === 'palavra-chave' || normalizedTriggerLabel === 'keyword' || normalizedTriggerLabel === 'intenção' || normalizedTriggerLabel === 'intencao') {
                    node.data.label = 'Início';
                }
            } else if (!node.data.label || node.data.label.toLowerCase() === 'palavra-chave') {
                node.data.label = 'Intenção';
            }
            node.data.flowBuilderMode = currentFlowBuilderMode;
            const rawIntentDelay = Number(node.data?.intentResponseDelaySeconds);
            node.data.intentResponseDelaySeconds = Number.isFinite(rawIntentDelay)
                ? Math.max(0, Math.trunc(rawIntentDelay))
                : 0;
            node.data.responseMode = currentFlowBuilderMode === 'menu' ? 'menu' : 'text';
            node.data.menuPrompt = String((node.data as any)?.menuPrompt || '').trim() || 'Escolha uma opção no menu abaixo:';
            node.data.menuButtonText = String((node.data as any)?.menuButtonText || '').trim() || 'Ver Menu';
            node.data.menuSectionTitle = String((node.data as any)?.menuSectionTitle || '').trim() || 'Opções';
            node.data.menuTitle = String((node.data as any)?.menuTitle || '').trim();
            node.data.menuFooter = String((node.data as any)?.menuFooter || '').trim();
            node.data.intentDefaultResponse = String(node.data?.intentDefaultResponse || '').trim();
            const intentDefaultFollowupResponses = coerceIntentMessageListForEditor(
                (node.data as any)?.intentDefaultFollowupResponses,
                node.data?.intentDefaultFollowupResponse
            );
            node.data.intentDefaultFollowupResponses = intentDefaultFollowupResponses;
            node.data.intentDefaultFollowupResponse = resolveIntentLegacyFollowupMessage(intentDefaultFollowupResponses);

            if (node.type === 'trigger') {
                node.data.triggerWelcomeEnabled = Boolean(node.data?.triggerWelcomeEnabled);
                node.data.triggerWelcomeContent = String(node.data?.triggerWelcomeContent || '').trim();
                const rawWelcomeDelay = Number(node.data?.triggerWelcomeDelaySeconds);
                node.data.triggerWelcomeDelaySeconds = Number.isFinite(rawWelcomeDelay)
                    ? Math.max(0, Math.trunc(rawWelcomeDelay))
                    : 0;
                const rawWelcomeMode = String(node.data?.triggerWelcomeRepeatMode || '').trim().toLowerCase();
                node.data.triggerWelcomeRepeatMode = ['always', 'hours', 'days'].includes(rawWelcomeMode)
                    ? rawWelcomeMode
                    : 'always';
                const rawWelcomeValue = Number(node.data?.triggerWelcomeRepeatValue);
                node.data.triggerWelcomeRepeatValue = Number.isFinite(rawWelcomeValue) && rawWelcomeValue > 0
                    ? Math.max(1, Math.trunc(rawWelcomeValue))
                    : 1;
            }
            applyFlowBuilderModeToIntentNode(node, currentFlowBuilderMode);
            syncIntentRoutesFromNode(node);
        }
        return node;
    });

    const nodeMap = new Map(nodes.map((node) => [String(node.id || '').trim(), node]));
    edges = (edges || []).map((edge) => {
        const targetNode = nodeMap.get(String(edge?.target || '').trim());
        return {
            ...edge,
            sourceHandle: edgeHandle(edge.sourceHandle),
            targetHandle: targetNode?.type === 'intent' || targetNode?.type === 'end'
                ? DEFAULT_HANDLE
                : edgeHandle(edge.targetHandle),
            inputLabel: String((edge as any)?.inputLabel || '').trim() || undefined
        };
    });
    cleanupInvalidEdgesForAllNodes();
}

// Salvar fluxo
async function saveFlow() {
    if (hasPendingNodeDraftChanges()) {
        confirmNodePropertyChanges();
    }

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

    syncFlowBuilderModeAcrossIntentNodes(getCurrentFlowBuilderMode());
    cleanupInvalidEdgesForAllNodes();

    const trigger = nodes.find(n => n.type === 'trigger');
    const triggerPayload = buildTriggerPayload(trigger);

    const flowData = {
        name,
        description: '',
        trigger_type: triggerPayload.triggerType,
        trigger_value: triggerPayload.triggerValue,
        session_id: currentFlowSessionId || null,
        nodes,
        edges,
        is_active: currentFlowIsActive ? 1 : 0
    };

    try {
        const url = currentFlowId
            ? buildFlowApiUrl(`/api/flows/${currentFlowId}`)
            : buildFlowApiUrl('/api/flows');
        const method = currentFlowId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: buildAuthHeaders(true),
            body: JSON.stringify(flowData)
        });

        const result = await readFlowJsonResponse<any>(response, {});

        if (result.success) {
            currentFlowId = result.flow.id;
            currentFlowName = String(result.flow?.name || name).trim();
            setCurrentFlowSessionScope(result.flow?.session_id || currentFlowSessionId);
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
        const response = await fetch(buildFlowApiUrl('/api/flows'), {
            headers: buildAuthHeaders(false)
        });
        const result = await readFlowJsonResponse<any>(response, {});

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
    const mobileListMode = isFlowMobileListMode();

    if (renamingFlowId !== null && !flowsCache.some((flow) => Number(flow.id) === Number(renamingFlowId))) {
        renamingFlowId = null;
        renamingFlowDraft = '';
    }

    if (mobileListMode && renamingFlowId !== null) {
        renamingFlowId = null;
        renamingFlowDraft = '';
    }

    if (flows.length === 0) {
        container.innerHTML = mobileListMode
            ? '<p class="flow-list-empty">Nenhum fluxo disponível no momento.</p>'
            : '<p class="flow-list-empty">Nenhum fluxo criado ainda. Crie um novo para começar.</p>';
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
        const isRenaming = !mobileListMode && Number(flow.id) === Number(renamingFlowId);
        const flowName = String(flow.name || '').trim() || 'Sem nome';
        const escapedFlowName = escapeHtml(flowName);
        const encodedName = encodeURIComponent(flowName);
        const inputValue = escapeHtml(renamingFlowDraft);
        const sessionOptions = buildFlowSessionScopeOptionsMarkup(flow.session_id);
        const itemClasses = [
            'flow-list-item',
            isCurrent ? 'is-current' : '',
            isRenaming ? 'is-renaming' : '',
            mobileListMode ? 'is-readonly' : ''
        ].filter(Boolean).join(' ');
        const itemClick = mobileListMode ? '' : ` onclick="loadFlow(${flow.id})"`;

        return `
        <div class="${itemClasses}"${itemClick}>
            <div class="icon icon-flows"></div>
            <div class="info">
                ${(mobileListMode || !isRenaming)
                    ? `
                        <div class="name-row">
                            <div class="name">${escapedFlowName}</div>
                            ${mobileListMode ? '' : `
                                <button class="flow-inline-icon" title="Editar nome" onclick="renameFlow(${flow.id}, decodeURIComponent('${encodedName}'), event)">
                                    <span class="icon icon-edit icon-sm"></span>
                                </button>
                            `}
                        </div>
                    `
                    : `
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
                }
                <div class="meta">Gatilho: ${getTriggerLabel(flow.trigger_type)} | Conta: ${escapeHtml(getFlowSessionScopeLabel(flow.session_id))} | ${flow.nodes?.length || 0} blocos | ${isActive ? 'Ativo' : 'Inativo'}</div>
            </div>
            <div class="flow-list-actions">
                <select
                    class="flow-list-scope-select"
                    title="Conta do fluxo"
                    onclick="event.stopPropagation()"
                    onmousedown="event.stopPropagation()"
                    onchange="updateFlowListSessionScope(${flow.id}, this.value, event)"
                >
                    ${sessionOptions}
                </select>
                <button class="flow-list-btn flow-list-toggle ${isActive ? 'is-active' : 'is-inactive'}" title="${isActive ? 'Desativar fluxo' : 'Ativar fluxo'}" onclick="toggleFlowActivation(${flow.id}, event)">
                    ${isActive ? 'Desativar' : 'Ativar'}
                </button>
                ${mobileListMode ? `
                    <button class="flow-list-btn flow-list-edit" title="Editar fluxo" onclick="editFlowFromList(${flow.id}, decodeURIComponent('${encodedName}'), event)">
                        Editar
                    </button>
                    <button class="flow-list-btn flow-list-delete" title="Excluir fluxo" onclick="discardFlow(${flow.id}, event)">
                        Excluir
                    </button>
                ` : `
                    <button class="flow-list-btn flow-list-icon-btn flow-list-duplicate" title="Duplicar fluxo" onclick="duplicateFlow(${flow.id}, event)">
                        <span class="icon icon-templates icon-sm"></span>
                    </button>
                    <button class="flow-list-btn flow-list-icon-btn flow-list-delete" title="Descartar fluxo" onclick="discardFlow(${flow.id}, event)">
                        <span class="icon icon-delete icon-sm"></span>
                    </button>
                `}
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
        const response = await fetch(buildFlowApiUrl(`/api/flows/${flowId}`), {
            method: 'PUT',
            headers: buildAuthHeaders(true),
            body: JSON.stringify({ name: nextName })
        });
        const result = await readFlowJsonResponse<any>(response, {});

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

async function editFlowFromList(id: number, currentName = '', event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();

    const flowId = Number(id);
    if (!Number.isFinite(flowId)) return;

    const currentFlow = flowsCache.find((flow) => Number(flow.id) === flowId);
    const currentSessionId = normalizeFlowSessionId(currentFlow?.session_id);
    const fallbackName = String(currentName || currentFlow?.name || '').trim() || 'Novo fluxo';

    if (flowWhatsappSessionsCache.length === 0) {
        await loadFlowWhatsappSessions({ silent: true });
    }

    const availableSessions = [...flowWhatsappSessionsCache]
        .filter((item) => normalizeFlowSessionId(item.session_id))
        .sort((a, b) => getFlowWhatsappSessionDisplayName(a).localeCompare(getFlowWhatsappSessionDisplayName(b), 'pt-BR'));
    const options: FlowDialogSelectOption[] = [
        { value: FLOW_ALL_SESSIONS_VALUE, label: 'Todas as contas WhatsApp' },
        ...availableSessions.map((item) => {
            const sessionId = normalizeFlowSessionId(item.session_id);
            const status = String(item.connected ? 'Conectada' : (item.status || 'Desconectada')).trim();
            const displayName = getFlowWhatsappSessionDisplayName(item);
            const label = displayName === sessionId
                ? `${sessionId} - ${status}`
                : `${displayName} - ${sessionId} - ${status}`;
            return { value: sessionId, label };
        })
    ];
    const hasCurrentSession = options.some((option) => normalizeFlowSessionId(option.value) === currentSessionId);
    if (currentSessionId && !hasCurrentSession) {
        options.push({
            value: currentSessionId,
            label: `Conta indisponível (${currentSessionId})`
        });
    }

    const editPayload = await showFlowPromptSelectDialog('Edite o nome do fluxo e escolha a conta WhatsApp:', {
        title: 'Editar fluxo',
        defaultValue: fallbackName,
        defaultSelectValue: currentSessionId || FLOW_ALL_SESSIONS_VALUE,
        placeholder: 'Ex.: Captação de leads',
        selectOptions: options,
        confirmLabel: 'Salvar'
    });
    if (editPayload === null) return;

    const nextName = String(editPayload?.inputValue || '').trim();
    if (!nextName) {
        await showFlowAlertDialog('O nome do fluxo não pode ficar vazio.', 'Editar fluxo');
        return;
    }

    const nextSessionId = normalizeFlowSessionId(editPayload?.selectValue);
    if (nextName === fallbackName && nextSessionId === currentSessionId) return;

    try {
        const response = await fetch(buildFlowApiUrl(`/api/flows/${flowId}`), {
            method: 'PUT',
            headers: buildAuthHeaders(true),
            body: JSON.stringify({
                name: nextName,
                session_id: nextSessionId || null
            })
        });
        const result = await readFlowJsonResponse<any>(response, {});

        if (!result.success) {
            await showFlowAlertDialog('Erro ao editar fluxo: ' + (result.error || 'Falha inesperada'), 'Editar fluxo');
            return;
        }

        if (Number(currentFlowId) === Number(flowId)) {
            currentFlowName = nextName;
            setCurrentFlowSessionScope(nextSessionId);
            renderCurrentFlowName();
        }

        await loadFlows();
    } catch (error) {
        await showFlowAlertDialog('Erro ao editar fluxo: ' + (error instanceof Error ? error.message : 'Falha inesperada'), 'Editar fluxo');
    }
}

async function toggleFlowActivation(id: number, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();

    const targetFlow = (await (async () => {
        try {
            const response = await fetch(buildFlowApiUrl(`/api/flows/${id}`), {
                headers: buildAuthHeaders(false)
            });
            const result = await readFlowJsonResponse<any>(response, {});
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
        const response = await fetch(buildFlowApiUrl(`/api/flows/${id}`), {
            method: 'PUT',
            headers: buildAuthHeaders(true),
            body: JSON.stringify({ is_active: nextActive ? 1 : 0 })
        });
        const result = await readFlowJsonResponse<any>(response, {});

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

async function updateFlowListSessionScope(id: number, value: string, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();

    const flowId = Number(id);
    if (!Number.isFinite(flowId)) return;

    const nextSessionId = normalizeFlowSessionId(value);
    const targetFlow = flowsCache.find((flow) => Number(flow.id) === flowId);
    const currentSessionId = normalizeFlowSessionId(targetFlow?.session_id);

    if (currentSessionId === nextSessionId) return;

    try {
        const response = await fetch(buildFlowApiUrl(`/api/flows/${flowId}`), {
            method: 'PUT',
            headers: buildAuthHeaders(true),
            body: JSON.stringify({ session_id: nextSessionId || null })
        });
        const result = await readFlowJsonResponse<any>(response, {});

        if (!result.success) {
            await showFlowAlertDialog('Erro ao atualizar a conta do fluxo: ' + (result.error || 'Falha inesperada'), 'Conta do fluxo');
            await loadFlows();
            return;
        }

        if (Number(currentFlowId) === flowId) {
            setCurrentFlowSessionScope(nextSessionId);
        }

        await loadFlows();
    } catch (error) {
        await showFlowAlertDialog(
            'Erro ao atualizar a conta do fluxo: ' + (error instanceof Error ? error.message : 'Falha inesperada'),
            'Conta do fluxo'
        );
        await loadFlows();
    }
}

async function duplicateFlow(id: number, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();

    try {
        const response = await fetch(buildFlowApiUrl(`/api/flows/${id}`), {
            headers: buildAuthHeaders(false)
        });
        const result = await readFlowJsonResponse<any>(response, {});

        if (!result.success) {
            await showFlowAlertDialog('Erro ao duplicar fluxo: ' + (result.error || 'Falha inesperada'), 'Duplicar fluxo');
            return;
        }

        resetEditorState();
        closeFlowsModal({ force: true });

        const flow = result.flow || {};
        nodes = flow.nodes || [];
        edges = flow.edges || [];
        normalizeLoadedFlowData();
        currentFlowId = null;
        currentFlowName = `${flow.name || 'Fluxo'} (copia)`;
        setCurrentFlowSessionScope(flow?.session_id || '');
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
        const response = await fetch(buildFlowApiUrl(`/api/flows/${id}`), {
            method: 'DELETE',
            headers: buildAuthHeaders(false)
        });
        const result = await readFlowJsonResponse<any>(response, {});

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
        const response = await fetch(buildFlowApiUrl(`/api/flows/${id}`), {
            headers: buildAuthHeaders(false)
        });
        const result = await readFlowJsonResponse<any>(response, {});
        
        if (result.success) {
            resetEditorState();
            if (!options.keepModalClosed) {
                closeFlowsModal({ force: true });
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
            setCurrentFlowSessionScope(result.flow?.session_id || '');
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
    const draft = await showFlowPromptSelectDialog('Escolha um nome e o formato do novo fluxo:', {
        title: 'Novo fluxo',
        defaultSelectValue: 'humanized',
        placeholder: 'Ex.: Captacao de leads - Plano Premium',
        confirmLabel: 'Criar fluxo',
        selectOptions: [
            { value: 'humanized', label: 'Humanizado' },
            { value: 'menu', label: 'Menu interativo' }
        ]
    });

    if (draft === null) return;

    const nextName = String(draft.inputValue || '').trim();
    const nextFlowBuilderMode = normalizeFlowBuilderMode(draft.selectValue || 'humanized');
    if (!nextName) {
        await showFlowAlertDialog('Informe um nome para criar o novo fluxo.', 'Novo fluxo');
        return;
    }

    resetEditorState();
    closeFlowsModal({ force: true });
    persistLastOpenFlowId(null);
    currentFlowName = nextName;
    currentFlowBuilderMode = nextFlowBuilderMode;
    renderCurrentFlowName();
    initializeDefaultIntentFlowSkeleton({
        selectTrigger: true,
        markDirty: true,
        flowBuilderMode: nextFlowBuilderMode
    });
}

function applyAiDraftToEditor(draft: AiGeneratedFlowDraft) {
    const nextNodes = Array.isArray(draft?.nodes) ? draft.nodes : [];
    const nextEdges = Array.isArray(draft?.edges) ? draft.edges : [];

    if (nextNodes.length === 0) {
        throw new Error('A IA nao retornou blocos para o fluxo.');
    }

    resetEditorState();
    closeFlowsModal({ force: true });

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
    const response = await fetch(buildFlowApiUrl('/api/ai/flows/generate'), {
        method: 'POST',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({
            prompt: normalizedPrompt
        })
    });
    const result = await readFlowJsonResponse<AiGenerateFlowResponse>(response, {} as AiGenerateFlowResponse);

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
    void loadFlowWhatsappSessions({ silent: true });
    loadFlows();
    const screenTitle = document.getElementById('flowsScreenTitle') as HTMLElement | null;
    if (screenTitle) {
        screenTitle.textContent = currentFlowId
            ? 'Selecione um Fluxo'
            : 'Selecione um Fluxo para começar';
    }
    setFlowBuilderScreen('selector');
}

function closeFlowsModal(options: { force?: boolean } = {}) {
    if (!currentFlowId && options.force !== true) return;
    renamingFlowId = null;
    renamingFlowDraft = '';
    setFlowBuilderScreen('builder');
}

const windowAny = window as Window & {
    initFlowBuilder?: () => void;
    openFlowsModal?: () => void;
    createNewFlow?: () => Promise<void>;
    addIntentBlock?: () => void;
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
    confirmNodePropertyChanges?: () => void;
    updateEventNodeSelection?: (value: string) => void;
    openOutputActionEditor?: (nodeId: string, encodedHandle: string, encodedLabel?: string, event?: Event) => void;
    toggleOutputActionTypeMenu?: (event?: Event) => void;
    addOutputActionByType?: (type: string) => void;
    updateSelectedOutputEntryLabel?: (value: string) => void;
    updateOutputActionField?: (index: number, field: 'tag' | 'status' | 'url', value: any) => void;
    updateOutputActionEventSelection?: (index: number, value: string) => void;
    removeOutputAction?: (index: number) => void;
    reloadCustomEventsCatalog?: () => void;
    reloadFlowSessionOptions?: () => void;
    updateFlowSessionScopeFromSelect?: () => void;
    addIntentRoute?: () => void;
    updateIntentRoute?: (index: number, key: 'label' | 'phrases' | 'response' | 'followupResponse', value: string) => void;
    addIntentRouteFollowupMessage?: (routeIndex: number) => void;
    updateIntentRouteFollowupMessage?: (routeIndex: number, followupIndex: number, value: string) => void;
    removeIntentRouteFollowupMessage?: (routeIndex: number, followupIndex: number) => void;
    addIntentDefaultFollowupMessage?: () => void;
    updateIntentDefaultFollowupMessage?: (index: number, value: string) => void;
    removeIntentDefaultFollowupMessage?: (index: number) => void;
    removeIntentRoute?: (index: number) => void;
    toggleIntentPropertySection?: (sectionKey: string, event?: Event) => void;
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
    editFlowFromList?: (id: number, currentName?: string, event?: Event) => Promise<void>;
    toggleFlowActivation?: (id: number, event?: Event) => Promise<void>;
    updateFlowListSessionScope?: (id: number, value: string, event?: Event) => Promise<void>;
    duplicateFlow?: (id: number, event?: Event) => Promise<void>;
    discardFlow?: (id: number, event?: Event) => Promise<void>;
    closeFlowsModal?: () => void;
};
windowAny.initFlowBuilder = initFlowBuilder;
windowAny.openFlowsModal = openFlowsModal;
windowAny.createNewFlow = createNewFlow;
windowAny.addIntentBlock = addIntentBlock;
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
windowAny.confirmNodePropertyChanges = confirmNodePropertyChanges;
windowAny.updateEventNodeSelection = updateEventNodeSelection;
windowAny.openOutputActionEditor = openOutputActionEditor;
windowAny.toggleOutputActionTypeMenu = toggleOutputActionTypeMenu;
windowAny.addOutputActionByType = addOutputActionByType;
windowAny.updateSelectedOutputEntryLabel = updateSelectedOutputEntryLabel;
windowAny.updateOutputActionField = updateOutputActionField;
windowAny.updateOutputActionEventSelection = updateOutputActionEventSelection;
windowAny.removeOutputAction = removeOutputAction;
windowAny.reloadCustomEventsCatalog = reloadCustomEventsCatalog;
windowAny.reloadFlowSessionOptions = reloadFlowSessionOptions;
windowAny.updateFlowSessionScopeFromSelect = updateFlowSessionScopeFromSelect;
windowAny.addIntentRoute = addIntentRoute;
windowAny.updateIntentRoute = updateIntentRoute;
windowAny.addIntentRouteFollowupMessage = addIntentRouteFollowupMessage;
windowAny.updateIntentRouteFollowupMessage = updateIntentRouteFollowupMessage;
windowAny.removeIntentRouteFollowupMessage = removeIntentRouteFollowupMessage;
windowAny.addIntentDefaultFollowupMessage = addIntentDefaultFollowupMessage;
windowAny.updateIntentDefaultFollowupMessage = updateIntentDefaultFollowupMessage;
windowAny.removeIntentDefaultFollowupMessage = removeIntentDefaultFollowupMessage;
windowAny.removeIntentRoute = removeIntentRoute;
windowAny.toggleIntentPropertySection = toggleIntentPropertySection;
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
windowAny.editFlowFromList = editFlowFromList;
windowAny.toggleFlowActivation = toggleFlowActivation;
windowAny.updateFlowListSessionScope = updateFlowListSessionScope;
windowAny.duplicateFlow = duplicateFlow;
windowAny.discardFlow = discardFlow;
windowAny.closeFlowsModal = closeFlowsModal;

export { initFlowBuilder };
