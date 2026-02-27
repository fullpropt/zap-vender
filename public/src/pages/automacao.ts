// Automacao page logic migrated to module

type TriggerType = 'new_lead' | 'status_change' | 'message_received' | 'keyword' | 'schedule' | 'inactivity';
type ActionType = 'send_message' | 'change_status' | 'add_tag' | 'start_flow' | 'notify';

type Automation = {
    id: number;
    name: string;
    description?: string;
    trigger_type: TriggerType;
    trigger_value?: string;
    action_type: ActionType;
    action_value?: string;
    delay?: number;
    session_scope?: string | null;
    session_ids?: string[];
    tag_filter?: string | null;
    tag_filters?: string[];
    is_active: boolean;
    executions?: number;
    last_execution?: string | null;
};

type AutomationsResponse = { automations?: Automation[] };

type WhatsappSessionItem = {
    session_id: string;
    status?: string;
    connected?: boolean;
    name?: string;
    phone?: string;
};

type TagItem = {
    id?: number;
    name?: string;
    color?: string;
};

let automations: Automation[] = [];
let automationSessions: WhatsappSessionItem[] = [];
let pendingAutomationSessionScope: string[] | null = null;
let automationTags: TagItem[] = [];
let pendingAutomationTagFilters: string[] | null = null;
let automationTagFilterGlobalEventsBound = false;
const RUNTIME_SUPPORTED_TRIGGER_TYPES: TriggerType[] = [
    'new_lead',
    'status_change',
    'message_received',
    'keyword',
    'schedule',
    'inactivity'
];

function appConfirm(message: string, title = 'Confirmacao') {
    const win = window as Window & { showAppConfirm?: (message: string, title?: string) => Promise<boolean> };
    if (typeof win.showAppConfirm === 'function') {
        return win.showAppConfirm(message, title);
    }
    return Promise.resolve(window.confirm(message));
}

function isRuntimeSupportedTriggerType(type: string): type is TriggerType {
    return RUNTIME_SUPPORTED_TRIGGER_TYPES.includes(type as TriggerType);
}

function escapeAutomationText(value: unknown) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function sanitizeSessionId(value: unknown) {
    return String(value || '').trim();
}

function parseAutomationSessionIds(value: unknown) {
    if (Array.isArray(value)) {
        return value
            .map((item) => sanitizeSessionId(item))
            .filter(Boolean);
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
            const parsed = JSON.parse(trimmed);
            return parseAutomationSessionIds(parsed);
        } catch (_) {
            return trimmed
                .split(',')
                .map((item) => sanitizeSessionId(item))
                .filter(Boolean);
        }
    }

    return [];
}

function normalizeAutomationTagLabel(value: unknown) {
    return String(value || '').trim();
}

function normalizeAutomationTagKey(value: unknown) {
    return normalizeAutomationTagLabel(value).toLowerCase();
}

function parseAutomationTagFilters(value: unknown) {
    if (Array.isArray(value)) {
        const seen = new Set<string>();
        const normalized: string[] = [];
        for (const item of value) {
            const label = normalizeAutomationTagLabel(item);
            const key = normalizeAutomationTagKey(label);
            if (!label || !key || seen.has(key)) continue;
            seen.add(key);
            normalized.push(label);
        }
        return normalized;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
            const parsed = JSON.parse(trimmed);
            return parseAutomationTagFilters(parsed);
        } catch (_) {
            return parseAutomationTagFilters(
                trimmed
                    .split(',')
                    .map((item) => normalizeAutomationTagLabel(item))
                    .filter(Boolean)
            );
        }
    }

    return [];
}

function getAutomationSessionIds(automation: Automation | undefined) {
    if (!automation) return [];
    const fromApi = parseAutomationSessionIds(automation.session_ids);
    if (fromApi.length) return Array.from(new Set(fromApi));
    const fromScope = parseAutomationSessionIds(automation.session_scope);
    return Array.from(new Set(fromScope));
}

function getAutomationTagFilters(automation: Automation | undefined) {
    if (!automation) return [];
    const fromApi = parseAutomationTagFilters(automation.tag_filters);
    if (fromApi.length) return fromApi;
    return parseAutomationTagFilters(automation.tag_filter);
}

function getSessionStatusLabel(session: WhatsappSessionItem) {
    const connected = Boolean(session.connected) || String(session.status || '').toLowerCase() === 'connected';
    return connected ? 'Conectada' : 'Desconectada';
}

function getSessionDisplayName(session: WhatsappSessionItem) {
    const sessionId = sanitizeSessionId(session.session_id);
    const name = String(session.name || '').trim();
    if (name) return name;
    const phone = String(session.phone || '').trim();
    if (phone) return phone;
    return sessionId;
}

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

function setAutomationModalTitle(mode: 'new' | 'edit') {
    const modalTitle = document.querySelector('#newAutomationModal .modal-title') as HTMLElement | null;
    if (!modalTitle) return;

    if (mode === 'edit') {
        modalTitle.innerHTML = '<span class="icon icon-edit icon-sm"></span> Editar Automação';
    } else {
        modalTitle.innerHTML = '<span class="icon icon-add icon-sm"></span> Nova Automação';
    }
}

function resetAutomationForm() {
    const form = document.getElementById('automationForm') as HTMLFormElement | null;
    form?.reset();
    const idInput = document.getElementById('automationId') as HTMLInputElement | null;
    if (idInput) idInput.value = '';
    updateTriggerOptions();
    updateActionOptions();
    setAutomationSessionScopeSelection([]);
    setAutomationTagFilterSelection([]);
    closeAutomationTagFilterMenu();
    setAutomationModalTitle('new');
}

function openAutomationModal() {
    resetAutomationForm();
    const win = window as Window & { openModal?: (id: string) => void };
    win.openModal?.('newAutomationModal');
}

function getAutomationId() {
    const idValue = (document.getElementById('automationId') as HTMLInputElement | null)?.value || '';
    const parsed = parseInt(idValue, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function getTriggerValue(type: TriggerType): string {
    switch (type) {
        case 'status_change': {
            const fromStatus = (document.getElementById('triggerFromStatus') as HTMLSelectElement | null)?.value || '';
            const toStatus = (document.getElementById('triggerToStatus') as HTMLSelectElement | null)?.value || '';
            if (!fromStatus && !toStatus) return '';
            return JSON.stringify({ from: fromStatus, to: toStatus });
        }
        case 'keyword':
            return (document.getElementById('triggerKeywords') as HTMLInputElement | null)?.value.trim() || '';
        case 'schedule': {
            const time = (document.getElementById('triggerTime') as HTMLInputElement | null)?.value || '';
            const days = Array.from(document.querySelectorAll('#triggerOptionsContainer input[type=\"checkbox\"]:checked'))
                .map(input => Number((input as HTMLInputElement).value))
                .filter(day => Number.isInteger(day) && day >= 0 && day <= 6);
            if (!time && days.length === 0) return '';
            return JSON.stringify({ time, days });
        }
        case 'inactivity':
            return (document.getElementById('triggerInactivity') as HTMLSelectElement | null)?.value || '';
        default:
            return '';
    }
}

function applyTriggerValue(type: TriggerType, value?: string | null) {
    if (!value) return;
    try {
        if (type === 'status_change') {
            const parsed = JSON.parse(value);
            const fromStatus = (document.getElementById('triggerFromStatus') as HTMLSelectElement | null);
            const toStatus = (document.getElementById('triggerToStatus') as HTMLSelectElement | null);
            if (fromStatus && parsed?.from !== undefined) fromStatus.value = String(parsed.from);
            if (toStatus && parsed?.to !== undefined) toStatus.value = String(parsed.to);
            return;
        }
        if (type === 'schedule') {
            const parsed = JSON.parse(value);
            const timeInput = document.getElementById('triggerTime') as HTMLInputElement | null;
            if (timeInput && parsed?.time) timeInput.value = parsed.time;
            if (Array.isArray(parsed?.days)) {
                const selectedDays = new Set(parsed.days.map((day: unknown) => String(day)));
                document.querySelectorAll('#triggerOptionsContainer input[type=\"checkbox\"]').forEach(input => {
                    const checkbox = input as HTMLInputElement;
                    checkbox.checked = selectedDays.has(checkbox.value);
                });
            }
            return;
        }
    } catch (error) {
        // ignore parse errors
    }

    if (type === 'keyword') {
        const keywordInput = document.getElementById('triggerKeywords') as HTMLInputElement | null;
        if (keywordInput) keywordInput.value = value;
    }
    if (type === 'inactivity') {
        const inactivitySelect = document.getElementById('triggerInactivity') as HTMLSelectElement | null;
        if (inactivitySelect) inactivitySelect.value = value;
    }
}

function getActionValue(type: ActionType): string {
    switch (type) {
        case 'send_message':
            return (document.getElementById('actionMessage') as HTMLTextAreaElement | null)?.value.trim() || '';
        case 'change_status':
            return (document.getElementById('actionStatus') as HTMLSelectElement | null)?.value || '';
        case 'add_tag':
            return (document.getElementById('actionTag') as HTMLInputElement | null)?.value.trim() || '';
        case 'start_flow':
            return (document.getElementById('actionFlow') as HTMLSelectElement | null)?.value || '';
        case 'notify':
            return (document.getElementById('actionNotification') as HTMLTextAreaElement | null)?.value.trim() || '';
        default:
            return '';
    }
}

function applyActionValue(type: ActionType, value?: string | null) {
    if (value === undefined || value === null) return;
    if (type === 'send_message') {
        const messageInput = document.getElementById('actionMessage') as HTMLTextAreaElement | null;
        if (messageInput) messageInput.value = value;
        return;
    }
    if (type === 'change_status') {
        const statusSelect = document.getElementById('actionStatus') as HTMLSelectElement | null;
        if (statusSelect) statusSelect.value = value;
        return;
    }
    if (type === 'add_tag') {
        const tagInput = document.getElementById('actionTag') as HTMLInputElement | null;
        if (tagInput) tagInput.value = value;
        return;
    }
    if (type === 'start_flow') {
        const flowSelect = document.getElementById('actionFlow') as HTMLSelectElement | null;
        if (flowSelect) flowSelect.value = value;
        return;
    }
    if (type === 'notify') {
        const notifyInput = document.getElementById('actionNotification') as HTMLTextAreaElement | null;
        if (notifyInput) notifyInput.value = value;
    }
}

function setAutomationSessionScopeSelection(sessionIds: string[]) {
    pendingAutomationSessionScope = Array.from(new Set(
        (sessionIds || [])
            .map((item) => sanitizeSessionId(item))
            .filter(Boolean)
    ));
    renderAutomationSessionScopeOptions();
}

function updateAutomationSessionScopeInputs() {
    const allCheckbox = document.getElementById('automationAllSessions') as HTMLInputElement | null;
    const isAll = !!allCheckbox?.checked;
    document.querySelectorAll<HTMLInputElement>('.automation-session-checkbox').forEach((input) => {
        input.disabled = isAll;
    });
}

function toggleAutomationAllSessions() {
    updateAutomationSessionScopeInputs();
}

function getSelectedAutomationSessionIds() {
    const allCheckbox = document.getElementById('automationAllSessions') as HTMLInputElement | null;
    if (allCheckbox?.checked) return [];

    return Array.from(document.querySelectorAll<HTMLInputElement>('.automation-session-checkbox:checked'))
        .map((input) => sanitizeSessionId(input.value))
        .filter(Boolean);
}

function renderAutomationSessionScopeOptions() {
    const allCheckbox = document.getElementById('automationAllSessions') as HTMLInputElement | null;
    const container = document.getElementById('automationSessionScopeList') as HTMLElement | null;
    if (!container) return;

    const selectedSet = new Set(pendingAutomationSessionScope || []);
    const hasSpecificSelection = selectedSet.size > 0;
    if (allCheckbox) {
        allCheckbox.checked = !hasSpecificSelection;
    }

    if (!automationSessions.length) {
        container.innerHTML = '<p style="color: var(--gray-500); font-size: 12px; margin: 0;">Nenhuma conta WhatsApp cadastrada.</p>';
        if (allCheckbox) allCheckbox.checked = true;
        updateAutomationSessionScopeInputs();
        return;
    }

    container.innerHTML = automationSessions.map((session) => {
        const sessionId = sanitizeSessionId(session.session_id);
        const checked = selectedSet.has(sessionId);
        const status = getSessionStatusLabel(session);
        const displayName = getSessionDisplayName(session);
        const subtitle = displayName === sessionId ? sessionId : `${displayName} - ${sessionId}`;
        const safeSessionId = escapeAutomationText(sessionId);
        return `
            <label class="checkbox-wrapper automation-session-option">
                <input
                    type="checkbox"
                    class="automation-session-checkbox"
                    value="${safeSessionId}"
                    ${checked ? 'checked' : ''}
                >
                <span class="checkbox-custom"></span>
                <span>
                    <strong>${escapeAutomationText(subtitle)}</strong>
                    <small style="display:block; color: var(--gray-500); margin-top: 2px;">${escapeAutomationText(status)}</small>
                </span>
            </label>
        `;
    }).join('');

    updateAutomationSessionScopeInputs();
}

function setAutomationTagFilterSelection(tags: string[]) {
    pendingAutomationTagFilters = Array.from(new Set(
        (tags || [])
            .map((item) => normalizeAutomationTagLabel(item))
            .filter(Boolean)
    ));
    renderAutomationTagFilterOptions();
}

function getAutomationTagFilterElements() {
    const toggleButton = document.getElementById('automationTagFilterToggle') as HTMLButtonElement | null;
    const menu = document.getElementById('automationTagFilterMenu') as HTMLElement | null;
    return { toggleButton, menu };
}

function setAutomationTagFilterMenuOpen(isOpen: boolean) {
    const { toggleButton, menu } = getAutomationTagFilterElements();
    if (!menu) return;

    menu.hidden = !isOpen;
    if (toggleButton) {
        toggleButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
}

function closeAutomationTagFilterMenu() {
    setAutomationTagFilterMenuOpen(false);
}

function toggleAutomationTagFilterMenu() {
    const { menu } = getAutomationTagFilterElements();
    if (!menu) return;
    setAutomationTagFilterMenuOpen(menu.hidden);
}

function updateAutomationTagFilterToggleLabel() {
    const toggleButton = document.getElementById('automationTagFilterToggle') as HTMLButtonElement | null;
    if (!toggleButton) return;

    const selected = getSelectedAutomationTagFilters();
    if (!selected.length) {
        toggleButton.textContent = 'Todas as tags';
        return;
    }

    if (selected.length <= 2) {
        toggleButton.textContent = selected.join(', ');
        return;
    }

    toggleButton.textContent = `${selected.length} tags selecionadas`;
}

function updateAutomationTagFilterInputs() {
    const allCheckbox = document.getElementById('automationAllTags') as HTMLInputElement | null;
    const isAll = !!allCheckbox?.checked;
    document.querySelectorAll<HTMLInputElement>('.automation-tag-filter-checkbox').forEach((input) => {
        input.disabled = isAll;
    });
    updateAutomationTagFilterToggleLabel();
}

function toggleAutomationAllTags() {
    const allCheckbox = document.getElementById('automationAllTags') as HTMLInputElement | null;
    if (allCheckbox?.checked) {
        document.querySelectorAll<HTMLInputElement>('.automation-tag-filter-checkbox').forEach((input) => {
            input.checked = false;
        });
    }
    updateAutomationTagFilterInputs();
}

function getSelectedAutomationTagFilters() {
    const allCheckbox = document.getElementById('automationAllTags') as HTMLInputElement | null;
    if (allCheckbox?.checked) return [];

    return Array.from(document.querySelectorAll<HTMLInputElement>('.automation-tag-filter-checkbox:checked'))
        .map((input) => normalizeAutomationTagLabel(input.value))
        .filter(Boolean);
}

function renderAutomationTagFilterOptions() {
    const allCheckbox = document.getElementById('automationAllTags') as HTMLInputElement | null;
    const container = document.getElementById('automationTagFilterList') as HTMLElement | null;
    if (!container) return;

    const selectedSet = new Set((pendingAutomationTagFilters || []).map((tag) => normalizeAutomationTagKey(tag)));
    const hasSpecificSelection = selectedSet.size > 0;
    if (allCheckbox) {
        allCheckbox.checked = !hasSpecificSelection;
    }

    const tags = [...automationTags];
    const knownKeys = new Set(
        tags
            .map((tag) => normalizeAutomationTagKey(tag?.name))
            .filter(Boolean)
    );

    for (const selectedTag of pendingAutomationTagFilters || []) {
        const selectedKey = normalizeAutomationTagKey(selectedTag);
        if (!selectedKey || knownKeys.has(selectedKey)) continue;
        knownKeys.add(selectedKey);
        tags.push({ name: normalizeAutomationTagLabel(selectedTag) });
    }

    if (!tags.length) {
        container.innerHTML = '<p style="color: var(--gray-500); font-size: 12px; margin: 0;">Nenhuma tag cadastrada.</p>';
        if (allCheckbox) allCheckbox.checked = true;
        updateAutomationTagFilterInputs();
        return;
    }

    container.innerHTML = tags.map((tag) => {
        const tagName = normalizeAutomationTagLabel(tag.name);
        if (!tagName) return '';
        const normalizedKey = normalizeAutomationTagKey(tagName);
        const checked = selectedSet.has(normalizedKey);
        const safeName = escapeAutomationText(tagName);
        const color = String(tag.color || '').trim() || '#178c49';

        return `
            <label class="checkbox-wrapper automation-session-option">
                <input
                    type="checkbox"
                    class="automation-tag-filter-checkbox"
                    value="${safeName}"
                    ${checked ? 'checked' : ''}
                >
                <span class="checkbox-custom"></span>
                <span style="display: inline-flex; align-items: center; gap: 8px;">
                    <span style="width: 10px; height: 10px; border-radius: 999px; background: ${escapeAutomationText(color)};"></span>
                    <strong>${safeName}</strong>
                </span>
            </label>
        `;
    }).join('');

    updateAutomationTagFilterInputs();
}

function bindAutomationTagFilterDropdown() {
    const { toggleButton, menu } = getAutomationTagFilterElements();
    if (!toggleButton || !menu) return;

    if (toggleButton.dataset.bound !== '1') {
        toggleButton.dataset.bound = '1';
        toggleButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleAutomationTagFilterMenu();
        });
    }

    if (menu.dataset.bound !== '1') {
        menu.dataset.bound = '1';
        menu.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        menu.addEventListener('change', (event) => {
            const target = event.target as HTMLInputElement | null;
            if (!target) return;

            if (target.id === 'automationAllTags') {
                toggleAutomationAllTags();
                return;
            }

            if (target.classList.contains('automation-tag-filter-checkbox')) {
                const allCheckbox = document.getElementById('automationAllTags') as HTMLInputElement | null;
                if (allCheckbox) {
                    const hasSpecificSelection = Array.from(document.querySelectorAll<HTMLInputElement>('.automation-tag-filter-checkbox'))
                        .some((input) => input.checked);
                    allCheckbox.checked = !hasSpecificSelection;
                }
                updateAutomationTagFilterInputs();
            }
        });
    }

    if (!automationTagFilterGlobalEventsBound) {
        automationTagFilterGlobalEventsBound = true;

        document.addEventListener('click', (event) => {
            const target = event.target;
            if (target instanceof Element) {
                if (target.closest('#automationTagFilterToggle') || target.closest('#automationTagFilterMenu')) {
                    return;
                }
            }
            closeAutomationTagFilterMenu();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeAutomationTagFilterMenu();
            }
        });
    }
}

async function loadAutomationSessions() {
    try {
        const response = await api.get('/api/whatsapp/sessions?includeDisabled=true');
        automationSessions = Array.isArray(response?.sessions) ? response.sessions : [];
    } catch (_) {
        automationSessions = [];
    }
    renderAutomationSessionScopeOptions();
    if (automations.length) {
        renderAutomations();
    }
}

async function loadAutomationTags() {
    try {
        const response = await api.get('/api/tags');
        automationTags = Array.isArray(response?.tags) ? response.tags : [];
    } catch (_) {
        automationTags = [];
    }

    automationTags.sort((a, b) => normalizeAutomationTagLabel(a?.name).localeCompare(normalizeAutomationTagLabel(b?.name), 'pt-BR'));
    renderAutomationTagFilterOptions();
    if (automations.length) {
        renderAutomations();
    }
}

function initAutomacao() {
    pendingAutomationSessionScope = [];
    pendingAutomationTagFilters = [];
    bindAutomationTagFilterDropdown();
    void loadAutomationSessions();
    void loadAutomationTags();
    loadAutomations();
    updateTriggerOptions();
    updateActionOptions();
}

onReady(initAutomacao);

async function loadAutomations() {
    try {
        showLoading('Carregando automações...');
        const response: AutomationsResponse = await api.get('/api/automations');
        automations = response.automations || [];
        updateStats();
        renderAutomations();
        hideLoading();
    } catch (error) {
        hideLoading();
        // Automações de exemplo
        automations = [
            {
                id: 1,
                name: 'Boas-vindas',
                description: 'Envia mensagem de boas-vindas para novos leads',
                trigger_type: 'new_lead',
                trigger_value: '',
                action_type: 'send_message',
                action_value: 'Olá {{nome}}! Seja bem-vindo à ZapVender.',
                delay: 0,
                is_active: true,
                executions: 156,
                last_execution: new Date(Date.now() - 3600000).toISOString()
            },
            {
                id: 2,
                name: 'Follow-up Automático',
                description: 'Envia follow-up a cada mensagem recebida',
                trigger_type: 'message_received',
                trigger_value: '',
                action_type: 'send_message',
                action_value: 'Oi {{nome}}, ainda posso te ajudar?',
                delay: 0,
                is_active: true,
                executions: 89,
                last_execution: new Date(Date.now() - 7200000).toISOString()
            },
            {
                id: 3,
                name: 'Notificação de Interesse',
                description: 'Notifica equipe quando lead demonstra interesse',
                trigger_type: 'keyword',
                trigger_value: 'interesse, preço',
                action_type: 'notify',
                action_value: 'Lead interessado: {{nome}}',
                delay: 0,
                is_active: false,
                executions: 45,
                last_execution: new Date(Date.now() - 86400000).toISOString()
            }
        ];
        updateStats();
        renderAutomations();
    }
}

function updateStats() {
    const totalAutomations = document.getElementById('totalAutomations') as HTMLElement | null;
    const activeAutomations = document.getElementById('activeAutomations') as HTMLElement | null;
    const totalExecutions = document.getElementById('totalExecutions') as HTMLElement | null;
    const lastExecution = document.getElementById('lastExecution') as HTMLElement | null;

    if (totalAutomations) totalAutomations.textContent = String(automations.length);
    if (activeAutomations) {
        activeAutomations.textContent = String(automations.filter(a => a.is_active).length);
    }
    if (totalExecutions) {
        totalExecutions.textContent = formatNumber(automations.reduce((sum, a) => sum + (a.executions || 0), 0));
    }
    
    const lastExec = automations
        .filter(a => a.last_execution)
        .sort((a, b) => new Date(b.last_execution as string).getTime() - new Date(a.last_execution as string).getTime())[0];
    if (lastExecution) {
        lastExecution.textContent = lastExec?.last_execution ? timeAgo(lastExec.last_execution) : '-';
    }
}

function renderAutomations() {
    const container = document.getElementById('automationsList') as HTMLElement | null;
    if (!container) return;
    
    if (automations.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon icon icon-empty icon-lg"></div>
                <p>Nenhuma automação criada</p>
                <button class="btn btn-primary mt-3" onclick="openAutomationModal()"><span class="icon icon-add icon-sm"></span> Criar Automação</button>
            </div>
        `;
        return;
    }

    container.innerHTML = automations.map(a => `
        <div class="automation-card">
            <div class="automation-header">
                <h3 class="automation-title">${a.name}</h3>
                <label class="toggle-switch">
                    <input type="checkbox" ${a.is_active ? 'checked' : ''} onchange="toggleAutomation(${a.id}, this.checked)">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="automation-body">
                <p style="color: var(--gray-600); margin-bottom: 10px; font-size: 13px;">${a.description || 'Sem descrição'}</p>
                <p style="color: var(--gray-500); margin-bottom: 6px; font-size: 12px;"><strong>Contas:</strong> ${getAutomationSessionScopeSummary(a)}</p>
                <p style="color: var(--gray-500); margin-bottom: 15px; font-size: 12px;"><strong>Tags:</strong> ${getAutomationTagFilterSummary(a)}</p>
                
                <div class="automation-trigger">
                    <div class="automation-trigger-icon trigger"><span class="icon icon-bolt icon-sm"></span></div>
                    <div>
                        <div style="font-weight: 600; font-size: 13px;">Gatilho</div>
                        <div style="font-size: 12px; color: var(--gray-500);">${getTriggerLabel(a.trigger_type)}</div>
                    </div>
                </div>
                
                <div class="automation-arrow">↓</div>
                
                <div class="automation-trigger">
                    <div class="automation-trigger-icon action"><span class="icon icon-target icon-sm"></span></div>
                    <div>
                        <div style="font-weight: 600; font-size: 13px;">Ação</div>
                        <div style="font-size: 12px; color: var(--gray-500);">${getActionLabel(a.action_type)}</div>
                    </div>
                </div>
            </div>
            <div class="automation-footer">
                <div style="font-size: 12px; color: var(--gray-500);">
                    <strong>${formatNumber(a.executions || 0)}</strong> execuções
                    ${a.last_execution ? `• Última: ${timeAgo(a.last_execution)}` : ''}
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-sm btn-outline" onclick="editAutomation(${a.id})"><span class="icon icon-edit icon-sm"></span></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteAutomation(${a.id})"><span class="icon icon-delete icon-sm"></span></button>
                </div>
            </div>
        </div>
    `).join('');
}

function getTriggerLabel(type: TriggerType | string) {
    const labels = {
        'new_lead': 'Novo lead cadastrado',
        'status_change': 'Mudança de status',
        'message_received': 'Mensagem recebida',
        'keyword': 'Palavra-chave detectada',
        'schedule': 'Agendamento',
        'inactivity': 'Inatividade do lead'
    };
    return labels[type] || type;
}

function getActionLabel(type: ActionType | string) {
    const labels = {
        'send_message': 'Enviar mensagem',
        'change_status': 'Alterar status',
        'add_tag': 'Adicionar tag',
        'start_flow': 'Iniciar fluxo',
        'notify': 'Notificar equipe'
    };
    return labels[type] || type;
}

function getAutomationSessionScopeSummary(automation: Automation) {
    const sessionIds = getAutomationSessionIds(automation);
    if (!sessionIds.length) return 'Todas as contas';

    const labels = sessionIds.map((sessionId) => {
        const found = automationSessions.find((session) => sanitizeSessionId(session.session_id) === sessionId);
        return found ? getSessionDisplayName(found) : sessionId;
    });
    return labels.join(' | ');
}

function getAutomationTagFilterSummary(automation: Automation) {
    const tags = getAutomationTagFilters(automation);
    if (!tags.length) return 'Todas as tags';

    const labels = tags.map((tagName) => {
        const normalizedKey = normalizeAutomationTagKey(tagName);
        const found = automationTags.find((tag) => normalizeAutomationTagKey(tag?.name) === normalizedKey);
        return normalizeAutomationTagLabel(found?.name || tagName);
    });
    return labels.join(' | ');
}

function updateTriggerOptions() {
    const type = (document.getElementById('triggerType') as HTMLSelectElement | null)?.value || '';
    const container = document.getElementById('triggerOptionsContainer') as HTMLElement | null;
    if (!container) return;
    
    let html = '';

    switch (type) {
        case 'status_change':
            html = `
                <label class="form-label">De status</label>
                <select class="form-select" id="triggerFromStatus">
                    <option value="">Qualquer</option>
                    <option value="1">Novo</option>
                    <option value="2">Em Andamento</option>
                    <option value="3">Concluído</option>
                </select>
                <label class="form-label mt-3">Para status</label>
                <select class="form-select" id="triggerToStatus">
                    <option value="">Qualquer</option>
                    <option value="1">Novo</option>
                    <option value="2">Em Andamento</option>
                    <option value="3">Concluído</option>
                </select>
            `;
            break;
        case 'keyword':
            html = `
                <label class="form-label">Palavras-chave (separadas por vírgula)</label>
                <input type="text" class="form-input" id="triggerKeywords" placeholder="interesse, preço, quanto custa">
            `;
            break;
        case 'schedule':
            html = `
                <label class="form-label">Horário de execução</label>
                <input type="time" class="form-input" id="triggerTime">
                <label class="form-label mt-3">Dias da semana</label>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <label class="checkbox-wrapper"><input type="checkbox" value="1"><span class="checkbox-custom"></span>Seg</label>
                    <label class="checkbox-wrapper"><input type="checkbox" value="2"><span class="checkbox-custom"></span>Ter</label>
                    <label class="checkbox-wrapper"><input type="checkbox" value="3"><span class="checkbox-custom"></span>Qua</label>
                    <label class="checkbox-wrapper"><input type="checkbox" value="4"><span class="checkbox-custom"></span>Qui</label>
                    <label class="checkbox-wrapper"><input type="checkbox" value="5"><span class="checkbox-custom"></span>Sex</label>
                    <label class="checkbox-wrapper"><input type="checkbox" value="6"><span class="checkbox-custom"></span>Sáb</label>
                    <label class="checkbox-wrapper"><input type="checkbox" value="0"><span class="checkbox-custom"></span>Dom</label>
                </div>
            `;
            break;
        case 'inactivity':
            html = `
                <label class="form-label">Tempo de inatividade</label>
                <select class="form-select" id="triggerInactivity">
                    <option value="3600">1 hora</option>
                    <option value="7200">2 horas</option>
                    <option value="14400">4 horas</option>
                    <option value="28800">8 horas</option>
                    <option value="43200">12 horas</option>
                    <option value="86400">24 horas</option>
                    <option value="172800">48 horas</option>
                    <option value="604800">7 dias</option>
                </select>
            `;
            break;
    }
    
    container.innerHTML = html;
}

function updateActionOptions() {
    const type = (document.getElementById('actionType') as HTMLSelectElement | null)?.value || '';
    const container = document.getElementById('actionOptionsContainer') as HTMLElement | null;
    if (!container) return;
    
    let html = '';
    
    switch (type) {
        case 'send_message':
            html = `
                <label class="form-label">Mensagem</label>
                <textarea class="form-textarea" id="actionMessage" rows="4" placeholder="Olá {{nome}}! Seja bem-vindo...

Variáveis: {{nome}}, {{veiculo}}, {{placa}}"></textarea>
            `;
            break;
        case 'change_status':
            html = `
                <label class="form-label">Novo status</label>
                <select class="form-select" id="actionStatus">
                    <option value="1">Novo</option>
                    <option value="2">Em Andamento</option>
                    <option value="3">Concluído</option>
                    <option value="4">Perdido</option>
                </select>
            `;
            break;
        case 'add_tag':
            html = `
                <label class="form-label">Tag</label>
                <input type="text" class="form-input" id="actionTag" placeholder="Nome da tag">
            `;
            break;
        case 'start_flow':
            html = `
                <label class="form-label">Fluxo</label>
                <select class="form-select" id="actionFlow">
                    <option value="">Selecione um fluxo...</option>
                </select>
            `;
            break;
        case 'notify':
            html = `
                <label class="form-label">Mensagem de notificação</label>
                <textarea class="form-textarea" id="actionNotification" rows="2" placeholder="Novo lead interessado: {{nome}}"></textarea>
            `;
            break;
    }
    
    container.innerHTML = html;
}

async function toggleAutomation(id: number, active: boolean) {
    try {
        await api.put(`/api/automations/${id}`, { is_active: active });
        const automation = automations.find(a => a.id === id);
        if (automation) automation.is_active = active;
        updateStats();
        showToast('success', 'Sucesso', `Automação ${active ? 'ativada' : 'desativada'}!`);
    } catch (error) {
        const automation = automations.find(a => a.id === id);
        if (automation) automation.is_active = active;
        updateStats();
        showToast('success', 'Sucesso', `Automação ${active ? 'ativada' : 'desativada'}!`);
    }
}

async function saveAutomation() {
    const automationId = getAutomationId();
    const name = (document.getElementById('automationName') as HTMLInputElement | null)?.value.trim() || '';
    const description = (document.getElementById('automationDescription') as HTMLInputElement | null)?.value.trim() || '';
    const triggerType = ((document.getElementById('triggerType') as HTMLSelectElement | null)?.value || '') as TriggerType;
    const actionType = ((document.getElementById('actionType') as HTMLSelectElement | null)?.value || '') as ActionType;
    const delay = parseInt((document.getElementById('actionDelay') as HTMLInputElement | null)?.value || '0', 10);

    if (!name) {
        showToast('error', 'Erro', 'Nome ? obrigat?rio');
        return;
    }
    if (!isRuntimeSupportedTriggerType(triggerType)) {
        showToast(
            'error',
            'Erro',
            'Gatilho invalido.'
        );
        return;
    }

    const triggerValue = getTriggerValue(triggerType);
    const actionValue = getActionValue(actionType);
    const existing = automationId ? automations.find(a => a.id === automationId) : null;
    const selectedSessionIds = getSelectedAutomationSessionIds();
    const selectedTagFilters = getSelectedAutomationTagFilters();

    const data: Record<string, unknown> = {
        name,
        description,
        trigger_type: triggerType,
        trigger_value: triggerValue,
        action_type: actionType,
        action_value: actionValue,
        delay,
        session_ids: selectedSessionIds,
        tag_filters: selectedTagFilters,
        is_active: existing ? existing.is_active : true
    };

    try {
        showLoading('Salvando...');
        if (automationId) {
            await api.put(`/api/automations/${automationId}`, data);
        } else {
            await api.post('/api/automations', data);
        }
        closeModal('newAutomationModal');
        resetAutomationForm();
        await loadAutomations();
        showToast('success', 'Sucesso', automationId ? 'Automa??o atualizada!' : 'Automa??o criada!');
    } catch (error) {
        hideLoading();
        if (automationId) {
            const index = automations.findIndex(a => a.id === automationId);
            if (index >= 0) {
                automations[index] = {
                    ...automations[index],
                    ...data
                };
            }
            showToast('success', 'Sucesso', 'Automa??o atualizada!');
        } else {
            // Simular sucesso
            automations.push({
                id: automations.length + 1,
                ...data,
                executions: 0,
                last_execution: null
            });
            showToast('success', 'Sucesso', 'Automa??o criada!');
        }
        closeModal('newAutomationModal');
        resetAutomationForm();
        renderAutomations();
        updateStats();
    }
}

function editAutomation(id: number) {
    const automation = automations.find(a => a.id === id);
    if (!automation) return;

    const idInput = document.getElementById('automationId') as HTMLInputElement | null;
    if (idInput) idInput.value = String(automation.id);

    const nameInput = document.getElementById('automationName') as HTMLInputElement | null;
    if (nameInput) nameInput.value = automation.name || '';

    const descriptionInput = document.getElementById('automationDescription') as HTMLInputElement | null;
    if (descriptionInput) descriptionInput.value = automation.description || '';

    const triggerSelect = document.getElementById('triggerType') as HTMLSelectElement | null;
    if (triggerSelect) triggerSelect.value = automation.trigger_type;
    updateTriggerOptions();
    applyTriggerValue(automation.trigger_type, automation.trigger_value);

    const actionSelect = document.getElementById('actionType') as HTMLSelectElement | null;
    if (actionSelect) actionSelect.value = automation.action_type;
    updateActionOptions();
    applyActionValue(automation.action_type, automation.action_value);

    const delaySelect = document.getElementById('actionDelay') as HTMLSelectElement | null;
    if (delaySelect) delaySelect.value = String(automation.delay || 0);

    setAutomationSessionScopeSelection(getAutomationSessionIds(automation));
    setAutomationTagFilterSelection(getAutomationTagFilters(automation));

    setAutomationModalTitle('edit');

    const win = window as Window & { openModal?: (id: string) => void };
    win.openModal?.('newAutomationModal');
}

async function deleteAutomation(id: number) {
    if (!await appConfirm('Excluir esta automacao?', 'Excluir automacao')) return;

    try {
        await api.delete(`/api/automations/${id}`);
    } catch (error) {
        // fallback local
    }

    automations = automations.filter(a => a.id !== id);
    renderAutomations();
    updateStats();
    showToast('success', 'Sucesso', 'Automa??o exclu?da!');
}

const windowAny = window as Window & {
    initAutomacao?: () => void;
    loadAutomations?: () => void;
    openAutomationModal?: () => void;
    updateTriggerOptions?: () => void;
    updateActionOptions?: () => void;
    toggleAutomationAllSessions?: () => void;
    toggleAutomation?: (id: number, active: boolean) => Promise<void>;
    saveAutomation?: () => Promise<void>;
    editAutomation?: (id: number) => void;
    deleteAutomation?: (id: number) => Promise<void>;
};
windowAny.initAutomacao = initAutomacao;
windowAny.loadAutomations = loadAutomations;
windowAny.openAutomationModal = openAutomationModal;
windowAny.updateTriggerOptions = updateTriggerOptions;
windowAny.updateActionOptions = updateActionOptions;
windowAny.toggleAutomationAllSessions = toggleAutomationAllSessions;
windowAny.toggleAutomation = toggleAutomation;
windowAny.saveAutomation = saveAutomation;
windowAny.editAutomation = editAutomation;
windowAny.deleteAutomation = deleteAutomation;

export { initAutomacao };
