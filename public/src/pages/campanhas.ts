// Campanhas page logic migrated to module

type CampaignStatus = 'active' | 'paused' | 'completed' | 'draft';
type CampaignType = 'broadcast' | 'drip';

type Campaign = {
    id: number;
    name: string;
    description?: string;
    type: CampaignType;
    distribution_strategy?: 'single' | 'round_robin' | 'weighted_round_robin' | 'random';
    distribution_config?: Record<string, unknown> | null;
    sender_accounts?: CampaignSenderAccount[];
    status: CampaignStatus;
    sent?: number;
    delivered?: number;
    read?: number;
    replied?: number;
    created_at: string;
    segment?: string;
    tag_filter?: string;
    message?: string;
    delay?: number;
    delay_min?: number;
    delay_max?: number;
    start_at?: string;
};

type CampaignSenderAccount = {
    session_id: string;
    weight?: number;
    daily_limit?: number;
    is_active?: number | boolean;
};

type WhatsappSenderSession = {
    session_id: string;
    name?: string;
    phone?: string;
    status?: string;
    connected?: boolean;
    campaign_enabled?: number | boolean;
    daily_limit?: number;
    dispatch_weight?: number;
};

type SettingsTag = {
    id: number;
    name: string;
    color?: string;
    description?: string;
};

type CampaignResponse = {
    campaigns?: Campaign[];
};

type WhatsappSessionsResponse = {
    sessions?: WhatsappSenderSession[];
};

type CampaignRecipient = {
    id: number;
    name?: string;
    phone?: string;
    status?: number;
    tags?: string;
    vehicle?: string;
    plate?: string;
    campaign_sent?: boolean;
    campaign_delivered?: boolean;
    campaign_read?: boolean;
    campaign_sent_at?: string | null;
    campaign_queue_status?: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled' | null;
    campaign_queue_error?: string | null;
};

type CampaignRecipientsResponse = {
    recipients?: CampaignRecipient[];
    total?: number;
    segment?: string;
    tag_filter?: string;
};

type ContactFieldDefinition = {
    key?: string;
    label?: string;
    source?: string;
    is_default?: boolean;
};

type ContactFieldsResponse = {
    fields?: ContactFieldDefinition[];
    customFields?: ContactFieldDefinition[];
};

type CampaignMessageVariable = {
    key: string;
    label: string;
};

let campaigns: Campaign[] = [];
let senderSessions: WhatsappSenderSession[] = [];
let campaignTagsCache: SettingsTag[] = [];
let campaignContactFieldsCache: ContactFieldDefinition[] = [];
let campaignMessageVariableGlobalEventsBound = false;
let campaignsRealtimeBindingsBound = false;
let campaignsRealtimeIntervalId: number | null = null;
let campaignsRealtimeRefreshInFlight = false;
let activeCampaignDetailsId: number | null = null;
let activeCampaignDetailsTab: 'overview' | 'messages' | 'recipients' = 'overview';
let campaignRecipientsRefreshInFlight = false;
const DEFAULT_DELAY_MIN_SECONDS = 5;
const DEFAULT_DELAY_MAX_SECONDS = 15;
const CAMPAIGNS_CACHE_TTL_MS = 60 * 1000;
const CAMPAIGNS_LIVE_REFRESH_MS = 4000;
const FIXED_CAMPAIGN_MESSAGE_VARIABLES: ReadonlyArray<CampaignMessageVariable> = Object.freeze([
    { key: 'nome', label: 'Nome do contato' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'email', label: 'Email' },
    { key: 'veiculo', label: 'Veículo' },
    { key: 'placa', label: 'Placa' }
]);

function getCampaignsCacheKey() {
    const token = String(sessionStorage.getItem('selfDashboardToken') || '').trim();
    const tokenSuffix = token ? token.slice(-12) : 'anon';
    return `zapvender_campaigns_cache_v1:${tokenSuffix}`;
}

function readCampaignsCache() {
    try {
        const raw = sessionStorage.getItem(getCampaignsCacheKey());
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { savedAt?: number; campaigns?: Campaign[] };
        const savedAt = Number(parsed?.savedAt || 0);
        if (!Number.isFinite(savedAt) || savedAt <= 0) return null;
        if (Date.now() - savedAt > CAMPAIGNS_CACHE_TTL_MS) return null;
        return Array.isArray(parsed?.campaigns) ? parsed.campaigns : null;
    } catch (_) {
        return null;
    }
}

function writeCampaignsCache(nextCampaigns: Campaign[]) {
    try {
        sessionStorage.setItem(getCampaignsCacheKey(), JSON.stringify({
            savedAt: Date.now(),
            campaigns: Array.isArray(nextCampaigns) ? nextCampaigns : []
        }));
    } catch (_) {
        // ignore storage failure
    }
}

function getCampaignStatusLabel(status: CampaignStatus) {
    if (status === 'active') return 'Ativa';
    if (status === 'paused') return 'Pausada';
    if (status === 'completed') return 'Concluída';
    return 'Rascunho';
}

function getCampaignTypeLabel(type: CampaignType | string) {
    if (type === 'broadcast') return 'Transmissão';
    if (type === 'drip') return 'Sequência';
    if (type === 'trigger') return 'Legado (Gatilho)';
    return 'Campanha';
}

function getLeadStatusLabel(status?: number) {
    if (status === 1) return 'Novo';
    if (status === 2) return 'Em andamento';
    if (status === 3) return 'Concluído';
    if (status === 4) return 'Perdido';
    return '-';
}

function getFunnelStageName(stage: number, fallback: string) {
    try {
        const rawSettings = localStorage.getItem('selfSettings');
        if (!rawSettings) return fallback;
        const parsed = JSON.parse(rawSettings);
        const funnel = Array.isArray(parsed?.funnel) ? parsed.funnel : [];
        const stageConfig = funnel[stage - 1];
        const name = String(stageConfig?.name || '').trim();
        return name || fallback;
    } catch {
        return fallback;
    }
}

function parseTagsForDisplay(rawTags: unknown) {
    if (Array.isArray(rawTags)) {
        return rawTags.map(tag => String(tag || '').trim()).filter(Boolean);
    }

    const raw = String(rawTags || '').trim();
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.map(tag => String(tag || '').trim()).filter(Boolean);
        }
    } catch (error) {
        // fallback para formato legado
    }

    return raw.split(',').map(tag => tag.trim()).filter(Boolean);
}

function formatCampaignPhone(phone?: string) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '-';
    return formatPhone(digits);
}

function getCampaignSegmentLabel(segment?: string) {
    const normalized = String(segment || 'all').toLowerCase();
    if (normalized === 'new' || normalized === 'status_1' || normalized === '1') {
        return `${getFunnelStageName(1, 'Novo')} (Etapa 1)`;
    }
    if (normalized === 'progress' || normalized === 'status_2' || normalized === '2') {
        return `${getFunnelStageName(2, 'Em andamento')} (Etapa 2)`;
    }
    if (normalized === 'concluded' || normalized === 'status_3' || normalized === '3') {
        return `${getFunnelStageName(3, 'Concluído')} (Etapa 3)`;
    }
    if (normalized === 'lost' || normalized === 'status_4' || normalized === '4') {
        return `${getFunnelStageName(4, 'Perdido')} (Etapa 4)`;
    }
    return 'Todos os contatos';
}

function getCampaignSegmentOptions() {
    return [
        { value: 'all', label: 'Todos os Contatos' },
        { value: 'new', label: `${getFunnelStageName(1, 'Novo')} (Etapa 1)` },
        { value: 'progress', label: `${getFunnelStageName(2, 'Em Andamento')} (Etapa 2)` },
        { value: 'concluded', label: `${getFunnelStageName(3, 'Concluído')} (Etapa 3)` },
        { value: 'lost', label: `${getFunnelStageName(4, 'Perdido')} (Etapa 4)` }
    ];
}

function syncCampaignSegmentOptions() {
    const segmentSelect = document.getElementById('campaignSegment') as HTMLSelectElement | null;
    if (!segmentSelect) return;

    const currentValue = segmentSelect.value || 'all';
    segmentSelect.innerHTML = getCampaignSegmentOptions()
        .map((option) => `<option value="${escapeCampaignText(option.value)}">${escapeCampaignText(option.label)}</option>`)
        .join('');
    setSelectValue(segmentSelect, currentValue);
}

function renderCampaignTagFilterOptions(selectedValue = '') {
    const tagSelect = document.getElementById('campaignTagFilter') as HTMLSelectElement | null;
    if (!tagSelect) return;

    const normalizedSelectedValue = String(selectedValue || '').trim();
    const tags = Array.isArray(campaignTagsCache) ? [...campaignTagsCache] : [];
    tags.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    const options = [
        '<option value="">Todas as tags</option>',
        ...tags.map((tag) => `<option value="${escapeCampaignText(tag.name || '')}">${escapeCampaignText(tag.name || '')}</option>`)
    ];

    if (normalizedSelectedValue && !tags.some((tag) => String(tag.name || '').trim() === normalizedSelectedValue)) {
        options.push(`<option value="${escapeCampaignText(normalizedSelectedValue)}">${escapeCampaignText(normalizedSelectedValue)}</option>`);
    }

    tagSelect.innerHTML = options.join('');
    setSelectValue(tagSelect, normalizedSelectedValue);
}

async function loadCampaignTags() {
    try {
        const response = await api.get('/api/tags');
        campaignTagsCache = Array.isArray(response?.tags) ? response.tags : [];
    } catch (error) {
        campaignTagsCache = [];
    }
    renderCampaignTagFilterOptions((document.getElementById('campaignTagFilter') as HTMLSelectElement | null)?.value || '');
}

function normalizeCampaignVariableKey(value: unknown) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .trim();
}

function getCampaignMessageCustomVariables(): CampaignMessageVariable[] {
    const fixedKeys = new Set(FIXED_CAMPAIGN_MESSAGE_VARIABLES.map((item) => item.key));
    const dedupe = new Map<string, CampaignMessageVariable>();
    const fields = Array.isArray(campaignContactFieldsCache) ? campaignContactFieldsCache : [];

    fields.forEach((field) => {
        const source = String(field?.source || '').trim().toLowerCase();
        if (source !== 'custom') return;

        const key = normalizeCampaignVariableKey(field?.key);
        if (!key || fixedKeys.has(key) || dedupe.has(key)) return;

        const label = String(field?.label || key).trim() || key;
        dedupe.set(key, { key, label });
    });

    return Array.from(dedupe.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

function getCampaignMessageVariableElements() {
    const toggleButton = document.getElementById('campaignMessageVariableToggle') as HTMLButtonElement | null;
    const menu = document.getElementById('campaignMessageVariableMenu') as HTMLElement | null;
    return { toggleButton, menu };
}

function setCampaignMessageVariableMenuOpen(isOpen: boolean) {
    const { toggleButton, menu } = getCampaignMessageVariableElements();
    if (!menu) return;

    menu.hidden = !isOpen;
    if (toggleButton) {
        toggleButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
}

function closeCampaignMessageVariableMenu() {
    setCampaignMessageVariableMenuOpen(false);
}

function toggleCampaignMessageVariableMenu() {
    const { menu } = getCampaignMessageVariableElements();
    if (!menu) return;
    setCampaignMessageVariableMenuOpen(menu.hidden);
}

function insertCampaignMessageVariable(variableKey: string) {
    const normalizedKey = normalizeCampaignVariableKey(variableKey);
    if (!normalizedKey) return;

    const textarea = document.getElementById('campaignMessage') as HTMLTextAreaElement | null;
    if (!textarea) return;

    const token = `{{${normalizedKey}}}`;
    const isFocused = document.activeElement === textarea;
    const start = isFocused && typeof textarea.selectionStart === 'number'
        ? textarea.selectionStart
        : textarea.value.length;
    const end = isFocused && typeof textarea.selectionEnd === 'number'
        ? textarea.selectionEnd
        : textarea.value.length;
    const previousValue = textarea.value;

    textarea.value = `${previousValue.slice(0, start)}${token}${previousValue.slice(end)}`;
    textarea.focus();
    const cursor = start + token.length;
    textarea.selectionStart = cursor;
    textarea.selectionEnd = cursor;

    closeCampaignMessageVariableMenu();
}

function renderCampaignMessageVariableOptions() {
    const fixedContainer = document.getElementById('campaignMessageVariableFixedList') as HTMLElement | null;
    const customContainer = document.getElementById('campaignMessageVariableCustomList') as HTMLElement | null;
    if (!fixedContainer || !customContainer) return;

    const renderOption = (variable: CampaignMessageVariable) => `
        <button type="button" class="campaign-variable-option" data-variable-key="${escapeCampaignText(variable.key)}">
            <span class="campaign-variable-token">{{${escapeCampaignText(variable.key)}}}</span>
            <span class="campaign-variable-label">${escapeCampaignText(variable.label)}</span>
        </button>
    `;

    fixedContainer.innerHTML = FIXED_CAMPAIGN_MESSAGE_VARIABLES.map(renderOption).join('');

    const customVariables = getCampaignMessageCustomVariables();
    customContainer.innerHTML = customVariables.length
        ? customVariables.map(renderOption).join('')
        : '<p class="campaign-variable-empty">Nenhuma tag personalizada cadastrada.</p>';

    const menu = document.getElementById('campaignMessageVariableMenu') as HTMLElement | null;
    if (!menu) return;

    const variableButtons = Array.from(menu.querySelectorAll<HTMLButtonElement>('.campaign-variable-option'));
    variableButtons.forEach((button) => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            insertCampaignMessageVariable(String(button.dataset.variableKey || ''));
        });
    });
}

function bindCampaignMessageVariablePicker() {
    const { toggleButton, menu } = getCampaignMessageVariableElements();
    if (!toggleButton || !menu) return;

    if (toggleButton.dataset.bound !== '1') {
        toggleButton.dataset.bound = '1';
        toggleButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleCampaignMessageVariableMenu();
        });
    }

    if (menu.dataset.bound !== '1') {
        menu.dataset.bound = '1';
        menu.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    }

    renderCampaignMessageVariableOptions();

    if (!campaignMessageVariableGlobalEventsBound) {
        campaignMessageVariableGlobalEventsBound = true;

        document.addEventListener('click', (event) => {
            const target = event.target;
            if (target instanceof Element) {
                if (target.closest('#campaignMessageVariableToggle') || target.closest('#campaignMessageVariableMenu')) {
                    return;
                }
            }
            closeCampaignMessageVariableMenu();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeCampaignMessageVariableMenu();
            }
        });
    }
}

async function loadCampaignMessageVariables() {
    try {
        const response: ContactFieldsResponse = await api.get('/api/contact-fields');
        campaignContactFieldsCache = Array.isArray(response?.fields) ? response.fields : [];
    } catch (error) {
        campaignContactFieldsCache = [];
    }

    renderCampaignMessageVariableOptions();
}

function getSessionDispatchWeight(session: WhatsappSenderSession) {
    const parsed = Number(session?.dispatch_weight);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function getSessionDailyLimit(session: WhatsappSenderSession) {
    const parsed = Number(session?.daily_limit);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function splitCampaignMessageSteps(campaign: Campaign) {
    const rawMessage = String(campaign.message || '').trim();
    if (!rawMessage) return [];
    if (campaign.type !== 'drip') return [rawMessage];
    return rawMessage
        .split(/\n\s*---+\s*\n/g)
        .map(step => step.trim())
        .filter(Boolean);
}

function escapeCampaignText(value: unknown) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttributeSelector(value: string) {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
}

function getDistributionStrategyLabel(strategy?: string) {
    const normalized = String(strategy || 'single').toLowerCase();
    if (normalized === 'round_robin') return 'Round-robin';
    if (normalized === 'weighted_round_robin') return 'Round-robin por peso';
    if (normalized === 'random') return 'Aleatório';
    return 'Conta única';
}

function normalizeCampaignSenderAccounts(raw: unknown): CampaignSenderAccount[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const normalized: CampaignSenderAccount[] = [];

    for (const entry of raw) {
        const sessionId = String((entry as CampaignSenderAccount)?.session_id || '').trim();
        if (!sessionId || seen.has(sessionId)) continue;
        seen.add(sessionId);

        const weight = Number((entry as CampaignSenderAccount)?.weight);
        const dailyLimit = Number((entry as CampaignSenderAccount)?.daily_limit);
        const isActive = (entry as CampaignSenderAccount)?.is_active;

        normalized.push({
            session_id: sessionId,
            weight: Number.isFinite(weight) && weight > 0 ? Math.floor(weight) : 1,
            daily_limit: Number.isFinite(dailyLimit) && dailyLimit >= 0 ? Math.floor(dailyLimit) : 0,
            is_active: typeof isActive === 'boolean' ? isActive : Number(isActive || 1) > 0
        });
    }

    return normalized;
}

function toBooleanFlag(value: unknown, fallback = true) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'sim', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'nao', 'não', 'off'].includes(normalized)) return false;
    }
    return fallback;
}

async function loadSenderSessions() {
    const selectedBeforeRefresh = collectCampaignSenderAccountsFromForm();
    try {
        const response: WhatsappSessionsResponse = await api.get('/api/whatsapp/sessions?includeDisabled=true');
        senderSessions = Array.isArray(response.sessions) ? response.sessions : [];
    } catch (error) {
        senderSessions = [];
    } finally {
        renderCampaignSenderAccountsSelector(normalizeCampaignSenderAccounts(selectedBeforeRefresh));
    }
}

function renderCampaignSenderAccountsSelector(selectedAccounts: CampaignSenderAccount[] = []) {
    const container = document.getElementById('campaignSenderAccounts') as HTMLElement | null;
    if (!container) return;

    const selectedBySession = new Set<string>(
        normalizeCampaignSenderAccounts(selectedAccounts).map((account) => account.session_id)
    );

    if (!senderSessions.length) {
        container.innerHTML = '<p style="color: var(--gray-500); font-size: 13px; margin: 0;">Nenhuma conta WhatsApp disponível. A campanha usará a conta padrão.</p>';
        return;
    }

    const sortedSessions = [...senderSessions].sort((a, b) => Number(Boolean(b.connected)) - Number(Boolean(a.connected)));
    container.innerHTML = sortedSessions.map((session) => {
        const sessionId = String(session.session_id || '').trim();
        const checked = selectedBySession.has(sessionId);
        const connected = !!session.connected;
        const campaignEnabled = toBooleanFlag(session.campaign_enabled, true);
        const disabledBySession = !campaignEnabled || !connected;
        const statusLabel = connected ? 'Conectada' : 'Desconectada';
        const weight = getSessionDispatchWeight(session);
        const dailyLimit = getSessionDailyLimit(session);
        const dailyLimitLabel = dailyLimit > 0 ? `${dailyLimit}/dia` : 'Sem limite';

        return `
            <div class="sender-account-item ${checked ? 'selected' : ''} ${disabledBySession ? 'disabled' : ''}" data-session-id="${escapeCampaignText(sessionId)}">
                <label class="checkbox-wrapper" style="align-items: center; gap: 10px; margin: 0;">
                    <input
                        type="checkbox"
                        class="campaign-sender-toggle"
                        data-session-id="${escapeCampaignText(sessionId)}"
                        ${checked ? 'checked' : ''}
                        ${disabledBySession ? 'disabled' : ''}
                    />
                    <span class="checkbox-custom"></span>
                    <span class="sender-account-main">
                        <span class="sender-account-title">${escapeCampaignText(session.name || session.phone || sessionId)}</span>
                        <span class="sender-account-meta">${escapeCampaignText(session.phone || sessionId)} • ${statusLabel} • Peso ${weight}</span>
                    </span>
                </label>
                <span class="sender-account-limit">${escapeCampaignText(dailyLimitLabel)}</span>
            </div>
        `;
    }).join('');

    const toggles = Array.from(container.querySelectorAll<HTMLInputElement>('.campaign-sender-toggle'));
    toggles.forEach((toggle) => {
        toggle.addEventListener('change', () => {
            const sessionId = String(toggle.dataset.sessionId || '');
            const checked = toggle.checked;
            const selectorSessionId = escapeAttributeSelector(sessionId);
            const row = container.querySelector(`.sender-account-item[data-session-id="${selectorSessionId}"]`);
            if (row) {
                row.classList.toggle('selected', checked);
            }
        });
    });
}

function collectCampaignSenderAccountsFromForm() {
    const container = document.getElementById('campaignSenderAccounts') as HTMLElement | null;
    if (!container) return [];

    const toggles = Array.from(container.querySelectorAll<HTMLInputElement>('.campaign-sender-toggle'))
        .filter((input) => input.checked && !input.disabled);
    const accounts: CampaignSenderAccount[] = [];

    toggles.forEach((toggle) => {
        const sessionId = String(toggle.dataset.sessionId || '').trim();
        if (!sessionId) return;
        const session = senderSessions.find((item) => String(item.session_id || '').trim() === sessionId);

        accounts.push({
            session_id: sessionId,
            weight: getSessionDispatchWeight(session || { session_id: sessionId }),
            daily_limit: getSessionDailyLimit(session || { session_id: sessionId }),
            is_active: true
        });
    });

    return accounts;
}

function renderCampaignMessages(campaign: Campaign) {
    const campaignMessages = document.getElementById('campaignMessages') as HTMLElement | null;
    if (!campaignMessages) return;

    const steps = splitCampaignMessageSteps(campaign);
    if (!steps.length) {
        campaignMessages.innerHTML = '<p style="color: var(--gray-500);">Nenhuma mensagem configurada.</p>';
        return;
    }

    campaignMessages.innerHTML = steps.map((step, index) => `
        <div class="copy-card" style="margin-bottom: 12px;">
            <div style="font-weight: 600; margin-bottom: 8px;">
                ${campaign.type === 'drip' ? `Etapa ${index + 1}` : 'Mensagem'}
            </div>
            <pre style="white-space: pre-wrap; margin: 0; font-family: inherit;">${escapeCampaignText(step)}</pre>
        </div>
    `).join('');
}

function renderCampaignSenderAccountsSummary(campaign: Campaign) {
    const accounts = normalizeCampaignSenderAccounts(campaign.sender_accounts);
    if (!accounts.length) {
        return 'Automático (contas habilitadas no WhatsApp)';
    }
    return accounts.map((account) => {
        const weight = Number(account.weight || 1);
        const dailyLimit = Number(account.daily_limit || 0);
        const dailyLimitLabel = dailyLimit > 0 ? `${dailyLimit}/dia` : 'sem limite';
        return `${account.session_id} (peso ${weight}, ${dailyLimitLabel})`;
    }).join(' | ');
}

function isCampaignDetailsModalOpen() {
    const modal = document.getElementById('campaignDetailsModal');
    return Boolean(modal && modal.classList.contains('active'));
}

function renderCampaignOverviewContent(campaign: Campaign) {
    const campaignOverview = document.getElementById('campaignOverview') as HTMLElement | null;
    if (!campaignOverview) return;

    campaignOverview.innerHTML = `
        <div class="stats-grid" style="margin-bottom: 20px;">
            <div class="stat-card">
                <div class="stat-content">
                    <div class="stat-value">${formatNumber(campaign.sent || 0)}</div>
                    <div class="stat-label">Enviadas</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-content">
                    <div class="stat-value">${formatNumber(campaign.delivered || 0)}</div>
                    <div class="stat-label">Entregues</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-content">
                    <div class="stat-value">${formatNumber(campaign.read || 0)}</div>
                    <div class="stat-label">Lidas</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-content">
                    <div class="stat-value">${formatNumber(campaign.replied || 0)}</div>
                    <div class="stat-label">Respostas</div>
                </div>
            </div>
        </div>
        <p><strong>Descrição:</strong> ${campaign.description || 'Sem descrição'}</p>
        <p><strong>Tipo:</strong> ${getCampaignTypeLabel(campaign.type)}</p>
        <p><strong>Status:</strong> ${getCampaignStatusLabel(campaign.status)}</p>
        <p><strong>Distribuição:</strong> ${escapeCampaignText(getDistributionStrategyLabel(campaign.distribution_strategy || 'single'))}</p>
        <p><strong>Contas de envio:</strong> ${escapeCampaignText(renderCampaignSenderAccountsSummary(campaign))}</p>
        <p><strong>Tag:</strong> ${campaign.tag_filter || 'Todas'}</p>
        <p><strong>Criada em:</strong> ${formatDate(campaign.created_at, 'datetime')}</p>
    `;
}

function updateCampaignDetailsActionButton(campaign: Campaign) {
    const actionBtn = document.getElementById('campaignActionBtn') as HTMLButtonElement | null;
    if (!actionBtn) return;

    actionBtn.onclick = null;

    if (campaign.status === 'active') {
        actionBtn.disabled = false;
        actionBtn.innerHTML = '<span class="icon icon-pause icon-sm"></span> Pausar';
        actionBtn.classList.remove('btn-success');
        actionBtn.classList.add('btn-warning');
        actionBtn.onclick = () => { void pauseCampaign(campaign.id); };
        return;
    }

    if (campaign.status === 'paused' || campaign.status === 'draft') {
        actionBtn.disabled = false;
        actionBtn.innerHTML = '<span class="icon icon-play icon-sm"></span> Iniciar';
        actionBtn.classList.remove('btn-warning');
        actionBtn.classList.add('btn-success');
        actionBtn.onclick = () => { void startCampaign(campaign.id); };
        return;
    }

    actionBtn.innerHTML = '<span class="icon icon-check icon-sm"></span> Concluída';
    actionBtn.classList.remove('btn-warning');
    actionBtn.classList.add('btn-outline');
    actionBtn.disabled = true;
}

function getRecipientDeliveryBadge(lead: CampaignRecipient) {
    if (lead.campaign_read) {
        return '<span class="badge badge-success" title="Mensagem lida">✓ Lida</span>';
    }
    if (lead.campaign_delivered) {
        return '<span class="badge badge-success" title="Mensagem entregue">✓ Entregue</span>';
    }
    if (lead.campaign_sent) {
        return '<span class="badge badge-info" title="Mensagem enviada">✓ Enviada</span>';
    }

    const queueStatus = String(lead.campaign_queue_status || '').trim().toLowerCase();
    if (queueStatus === 'pending' || queueStatus === 'processing') {
        return '<span class="badge badge-warning" title="Mensagem ainda em fila">⏳ Pendente</span>';
    }
    if (queueStatus === 'failed') {
        const title = escapeCampaignText(String(lead.campaign_queue_error || 'Falha no envio'));
        return `<span class="badge badge-danger" title="${title}">✕ Falhou</span>`;
    }
    if (queueStatus === 'cancelled') {
        return '<span class="badge badge-secondary" title="Envio cancelado">Cancelado</span>';
    }

    return '<span class="badge badge-secondary">-</span>';
}

function syncCampaignDetailsModal(campaign: Campaign, options: { refreshRecipients?: boolean } = {}) {
    if (!isCampaignDetailsModalOpen()) return;
    if (activeCampaignDetailsId !== campaign.id) return;

    const detailsTitle = document.getElementById('detailsTitle') as HTMLElement | null;
    if (detailsTitle) {
        detailsTitle.innerHTML = `<span class="icon icon-campaigns icon-sm"></span> ${campaign.name}`;
    }

    renderCampaignOverviewContent(campaign);
    renderCampaignMessages(campaign);
    updateCampaignDetailsActionButton(campaign);

    if (options.refreshRecipients && !campaignRecipientsRefreshInFlight) {
        campaignRecipientsRefreshInFlight = true;
        void loadCampaignRecipients(campaign).finally(() => {
            campaignRecipientsRefreshInFlight = false;
        });
    }
}

function shouldRefreshCampaignRecipientsInRealtime(campaign: Campaign | undefined) {
    if (!campaign || !isCampaignDetailsModalOpen()) return false;
    if (activeCampaignDetailsId !== campaign.id) return false;
    if (activeCampaignDetailsTab === 'recipients') return true;
    return campaign.status === 'active';
}

function scheduleCampaignsRealtimeRefresh(delayMs = 0) {
    const run = async () => {
        if (campaignsRealtimeRefreshInFlight) return;
        if (document.visibilityState === 'hidden') return;
        campaignsRealtimeRefreshInFlight = true;
        try {
            await loadCampaigns({ silent: true, skipLoading: true, source: 'realtime' });
        } finally {
            campaignsRealtimeRefreshInFlight = false;
        }
    };

    if (delayMs > 0) {
        window.setTimeout(() => { void run(); }, delayMs);
        return;
    }
    void run();
}

function bindCampaignsRealtimeUpdates() {
    if (campaignsRealtimeBindingsBound) return;
    campaignsRealtimeBindingsBound = true;

    const win = window as Window & { APP?: { socket?: { on?: (event: string, cb: (...args: any[]) => void) => void } } };
    const socket = win.APP?.socket;
    if (socket && typeof socket.on === 'function') {
        const triggerRefresh = () => scheduleCampaignsRealtimeRefresh(250);
        socket.on('message-sent', triggerRefresh);
        socket.on('message-status', triggerRefresh);
        socket.on('new-message', triggerRefresh);
    }

    if (campaignsRealtimeIntervalId == null) {
        campaignsRealtimeIntervalId = window.setInterval(() => {
            scheduleCampaignsRealtimeRefresh();
        }, CAMPAIGNS_LIVE_REFRESH_MS);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            scheduleCampaignsRealtimeRefresh(200);
        }
    });
}

async function loadCampaignRecipients(campaign: Campaign) {
    const campaignRecipients = document.getElementById('campaignRecipients') as HTMLElement | null;
    if (!campaignRecipients) return;

    campaignRecipients.innerHTML = '<p style="color: var(--gray-500);">Carregando destinatários...</p>';

    try {
        const response: CampaignRecipientsResponse = await api.get(`/api/campaigns/${campaign.id}/recipients?limit=200`);
        const recipients = response.recipients || [];
        const total = Number(response.total || recipients.length);
        const segmentLabel = getCampaignSegmentLabel(response.segment || campaign.segment);
        const tagLabel = String(response.tag_filter || campaign.tag_filter || 'Todas');

        if (!recipients.length) {
            campaignRecipients.innerHTML = `
                <p style="margin-bottom: 8px;"><strong>Segmentação:</strong> ${escapeCampaignText(segmentLabel)}</p>
                <p style="margin-bottom: 8px;"><strong>Tag:</strong> ${escapeCampaignText(tagLabel)}</p>
                <p style="color: var(--gray-500);">Nenhum contato encontrado com esses filtros.</p>
            `;
            return;
        }

        const rows = recipients.map((lead) => {
            const tags = parseTagsForDisplay(lead.tags).join(', ') || '-';
            const deliveryBadge = getRecipientDeliveryBadge(lead);
            return `
                <tr>
                    <td>${escapeCampaignText(lead.name || 'Sem nome')}</td>
                    <td>${escapeCampaignText(formatCampaignPhone(lead.phone))}</td>
                    <td>${escapeCampaignText(getLeadStatusLabel(Number(lead.status || 0)))}</td>
                    <td>${deliveryBadge}</td>
                    <td>${escapeCampaignText(tags)}</td>
                </tr>
            `;
        }).join('');

        campaignRecipients.innerHTML = `
            <p style="margin-bottom: 8px;"><strong>Segmentação:</strong> ${escapeCampaignText(segmentLabel)}</p>
            <p style="margin-bottom: 8px;"><strong>Tag:</strong> ${escapeCampaignText(tagLabel)}</p>
            <p style="margin-bottom: 12px;"><strong>Total filtrado:</strong> ${formatNumber(total)}</p>
            <div style="overflow-x: auto;">
                <table class="table" style="min-width: 560px;">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>WhatsApp</th>
                            <th>Status</th>
                            <th>Recebeu</th>
                            <th>Tags</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            ${total > recipients.length ? `<p style="color: var(--gray-500); margin-top: 8px;">Mostrando ${formatNumber(recipients.length)} de ${formatNumber(total)} contatos.</p>` : ''}
        `;
    } catch (error) {
        campaignRecipients.innerHTML = '<p style="color: var(--danger);">Não foi possível carregar os destinatários.</p>';
    }
}

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

function setCampaignModalTitle(mode: 'new' | 'edit') {
    const modalTitle = document.querySelector('#newCampaignModal .modal-title') as HTMLElement | null;
    if (!modalTitle) return;

    if (mode === 'edit') {
        modalTitle.innerHTML = '<span class="icon icon-edit icon-sm"></span> Editar Campanha';
    } else {
        modalTitle.innerHTML = '<span class="icon icon-add icon-sm"></span> Nova Campanha';
    }
}

function resetCampaignForm() {
    const form = document.getElementById('campaignForm') as HTMLFormElement | null;
    form?.reset();
    const idInput = document.getElementById('campaignId') as HTMLInputElement | null;
    if (idInput) idInput.value = '';
    syncCampaignSegmentOptions();
    renderCampaignTagFilterOptions('');
    setSelectValue(document.getElementById('campaignDistributionStrategy') as HTMLSelectElement | null, 'single');
    renderCampaignSenderAccountsSelector([]);
    setDelayRangeInputs(DEFAULT_DELAY_MIN_SECONDS, DEFAULT_DELAY_MAX_SECONDS);
    closeCampaignMessageVariableMenu();
    bindCampaignMessageVariablePicker();
    setCampaignModalTitle('new');
}

function openCampaignModal() {
    resetCampaignForm();
    void loadCampaignTags();
    void loadCampaignMessageVariables();
    void loadSenderSessions();
    bindCampaignMessageVariablePicker();
    const win = window as Window & { openModal?: (id: string) => void };
    win.openModal?.('newCampaignModal');
}

function getCampaignId() {
    const idValue = (document.getElementById('campaignId') as HTMLInputElement | null)?.value || '';
    const parsed = parseInt(idValue, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatInputDateTime(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function setSelectValue(select: HTMLSelectElement | null, value: string) {
    if (!select) return;
    const hasOption = Array.from(select.options).some(option => option.value === value);
    if (hasOption) {
        select.value = value;
    } else if (select.options.length > 0) {
        select.value = select.options[0].value;
    }
}

function setDelayRangeInputs(minSeconds = DEFAULT_DELAY_MIN_SECONDS, maxSeconds = DEFAULT_DELAY_MAX_SECONDS) {
    const minInput = document.getElementById('campaignDelayMin') as HTMLInputElement | null;
    const maxInput = document.getElementById('campaignDelayMax') as HTMLInputElement | null;
    if (minInput) minInput.value = String(minSeconds);
    if (maxInput) maxInput.value = String(maxSeconds);
}

function resolveCampaignDelayRangeMs(campaign?: Partial<Campaign>) {
    const fallbackMin = DEFAULT_DELAY_MIN_SECONDS * 1000;
    const fallbackMax = DEFAULT_DELAY_MAX_SECONDS * 1000;

    const minCandidate = Number(campaign?.delay_min ?? campaign?.delay ?? fallbackMin);
    const maxCandidate = Number(campaign?.delay_max ?? campaign?.delay ?? minCandidate ?? fallbackMax);

    let minMs = Number.isFinite(minCandidate) && minCandidate > 0 ? minCandidate : fallbackMin;
    let maxMs = Number.isFinite(maxCandidate) && maxCandidate > 0 ? maxCandidate : minMs;

    if (maxMs < minMs) {
        const swap = minMs;
        minMs = maxMs;
        maxMs = swap;
    }

    return { minMs, maxMs };
}

function openBroadcastModal() {
    openCampaignModal();

    setSelectValue(document.getElementById('campaignType') as HTMLSelectElement | null, 'broadcast');
    setSelectValue(document.getElementById('campaignDistributionStrategy') as HTMLSelectElement | null, 'round_robin');
    setSelectValue(document.getElementById('campaignSegment') as HTMLSelectElement | null, 'all');
    setDelayRangeInputs(DEFAULT_DELAY_MIN_SECONDS, DEFAULT_DELAY_MAX_SECONDS);
}

async function initCampanhas() {
    syncCampaignSegmentOptions();
    bindCampaignMessageVariablePicker();
    bindCampaignsRealtimeUpdates();
    await Promise.all([
        loadCampaigns(),
        loadSenderSessions(),
        loadCampaignTags(),
        loadCampaignMessageVariables()
    ]);
}

onReady(() => {
    void initCampanhas();
});

function shouldUseLocalCampaignFallback(error: unknown) {
    const message = String((error as Error)?.message || '').toLowerCase();
    if (!message) return true;
    return (
        message.includes('failed to fetch') ||
        message.includes('networkerror') ||
        message.includes('network request failed') ||
        message.includes('load failed')
    );
}

async function loadCampaigns(options: { silent?: boolean; skipLoading?: boolean; source?: string } = {}) {
    const cachedCampaigns = readCampaignsCache();
    if (Array.isArray(cachedCampaigns) && cachedCampaigns.length > 0) {
        campaigns = cachedCampaigns;
        updateStats();
        renderCampaigns();
        const cachedViewedCampaign = activeCampaignDetailsId != null
            ? campaigns.find((campaign) => campaign.id === activeCampaignDetailsId)
            : undefined;
        if (cachedViewedCampaign) {
            syncCampaignDetailsModal(cachedViewedCampaign, {
                refreshRecipients: shouldRefreshCampaignRecipientsInRealtime(cachedViewedCampaign)
            });
        }
    }

    const shouldShowLoading = !options.skipLoading && (!cachedCampaigns || cachedCampaigns.length === 0);
    try {
        if (shouldShowLoading) {
            showLoading('Carregando campanhas...');
        }
        const response: CampaignResponse = await api.get('/api/campaigns');
        campaigns = response.campaigns || [];
        writeCampaignsCache(campaigns);
        updateStats();
        renderCampaigns();
        const viewedCampaign = activeCampaignDetailsId != null
            ? campaigns.find((campaign) => campaign.id === activeCampaignDetailsId)
            : undefined;
        if (viewedCampaign) {
            syncCampaignDetailsModal(viewedCampaign, {
                refreshRecipients: shouldRefreshCampaignRecipientsInRealtime(viewedCampaign)
            });
        }
        if (shouldShowLoading) {
            hideLoading();
        }
    } catch (error) {
        if (shouldShowLoading) {
            hideLoading();
        }
        if (Array.isArray(cachedCampaigns) && cachedCampaigns.length > 0) {
            if (!options.silent && !shouldUseLocalCampaignFallback(error)) {
                showToast('warning', 'Aviso', 'Falha ao atualizar campanhas em segundo plano');
            }
            return;
        }
        // Se não houver endpoint, mostrar campanhas de exemplo
        campaigns = [
            {
                id: 1,
                name: 'Boas-vindas',
                description: 'Mensagem de boas-vindas para novos leads',
                type: 'broadcast',
                status: 'active',
                segment: 'new',
                message: 'OlÃ¡ {{nome}}! Seja bem-vindo Ã  ZapVender.',
                delay: 5000,
                delay_min: 5000,
                delay_max: 5000,
                start_at: new Date().toISOString(),
                sent: 156,
                delivered: 150,
                read: 120,
                replied: 45,
                created_at: new Date().toISOString()
            },
            {
                id: 2,
                name: 'PromoÃ§Ã£o Janeiro',
                description: 'Campanha promocional de janeiro',
                type: 'broadcast',
                status: 'completed',
                segment: 'all',
                message: 'PromoÃ§Ã£o especial para vocÃª!',
                delay: 5000,
                delay_min: 5000,
                delay_max: 5000,
                start_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                sent: 500,
                delivered: 485,
                read: 320,
                replied: 89,
                created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
        updateStats();
        renderCampaigns();
        writeCampaignsCache(campaigns);
    }
}

function updateStats() {
    const totalCampaigns = document.getElementById('totalCampaigns') as HTMLElement | null;
    const activeCampaigns = document.getElementById('activeCampaigns') as HTMLElement | null;
    const totalSentEl = document.getElementById('totalSent') as HTMLElement | null;
    const avgResponseEl = document.getElementById('avgResponse') as HTMLElement | null;

    if (totalCampaigns) totalCampaigns.textContent = String(campaigns.length);
    if (activeCampaigns) {
        activeCampaigns.textContent = String(campaigns.filter(c => c.status === 'active').length);
    }
    
    const totalSent = campaigns.reduce((sum, c) => sum + (c.sent || 0), 0);
    if (totalSentEl) totalSentEl.textContent = formatNumber(totalSent);
    
    const totalReplied = campaigns.reduce((sum, c) => sum + (c.replied || 0), 0);
    const avgResponse = totalSent > 0 ? (totalReplied / totalSent * 100) : 0;
    if (avgResponseEl) avgResponseEl.textContent = formatPercent(avgResponse);
}

function renderCampaigns() {
    const container = document.getElementById('campaignsList') as HTMLElement | null;
    if (!container) return;
    
    if (campaigns.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon icon icon-campaigns icon-lg"></div>
                <p>Nenhuma campanha criada</p>
                <button class="btn btn-primary mt-3" onclick="openCampaignModal()"><span class="icon icon-add icon-sm"></span> Criar Campanha</button>
            </div>
        `;
        return;
    }

    container.innerHTML = campaigns.map(c => {
        const deliveryRate = c.sent > 0 ? (c.delivered / c.sent * 100) : 0;
        const readRate = c.delivered > 0 ? (c.read / c.delivered * 100) : 0;
        const replyRate = c.read > 0 ? (c.replied / c.read * 100) : 0;

        return `
            <div class="campaign-card">
                <div class="campaign-header">
                    <div>
                        <h3 class="campaign-title">${c.name}</h3>
                        <div class="campaign-date">Criada em ${formatDate(c.created_at, 'short')}</div>
                    </div>
                    <span class="badge badge-${c.status === 'active' ? 'success' : c.status === 'paused' ? 'warning' : c.status === 'completed' ? 'info' : 'secondary'}">
                        ${getCampaignStatusLabel(c.status)}
                    </span>
                </div>
                <div class="campaign-body">
                    <p style="color: var(--gray-600); margin-bottom: 15px;">${c.description || 'Sem descrição'}</p>
                    <div class="campaign-stats">
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${formatNumber(c.sent || 0)}</div>
                            <div class="campaign-stat-label">Enviadas</div>
                        </div>
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${formatPercent(deliveryRate)}</div>
                            <div class="campaign-stat-label">Entregues</div>
                        </div>
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${formatPercent(readRate)}</div>
                            <div class="campaign-stat-label">Lidas</div>
                        </div>
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${formatPercent(replyRate)}</div>
                            <div class="campaign-stat-label">Respostas</div>
                        </div>
                    </div>
                    <div class="campaign-progress">
                        <div class="progress" style="height: 8px;">
                            <div class="progress-bar" style="width: ${deliveryRate}%; background: var(--success);"></div>
                        </div>
                    </div>
                </div>
                <div class="campaign-footer">
                    <span class="badge badge-secondary">${getCampaignTypeLabel(c.type)}</span>
                    <div class="campaign-actions">
                        <button class="btn btn-sm btn-outline" onclick="viewCampaign(${c.id})"><span class="icon icon-eye icon-sm"></span> Ver</button>
                        <button class="btn btn-sm btn-outline" onclick="editCampaign(${c.id})"><span class="icon icon-edit icon-sm"></span> Editar</button>
                        ${c.status === 'active' ? 
                            `<button class="btn btn-sm btn-warning" onclick="pauseCampaign(${c.id})"><span class="icon icon-pause icon-sm"></span> Pausar</button>` :
                            c.status === 'paused' || c.status === 'draft' ?
                            `<button class="btn btn-sm btn-success" onclick="startCampaign(${c.id})"><span class="icon icon-play icon-sm"></span> Iniciar</button>` : ''
                        }
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteCampaign(${c.id})"><span class="icon icon-delete icon-sm"></span></button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function saveCampaign(statusOverride?: CampaignStatus) {
    const campaignId = getCampaignId();
    const existingStatus = campaignId
        ? (campaigns.find((campaign) => campaign.id === campaignId)?.status || 'draft')
        : 'draft';
    const status = statusOverride || existingStatus || 'draft';
    const minSeconds = parseInt((document.getElementById('campaignDelayMin') as HTMLInputElement | null)?.value || String(DEFAULT_DELAY_MIN_SECONDS), 10);
    const maxSeconds = parseInt((document.getElementById('campaignDelayMax') as HTMLInputElement | null)?.value || String(DEFAULT_DELAY_MAX_SECONDS), 10);

    const normalizedMinSeconds = Number.isFinite(minSeconds) && minSeconds > 0 ? minSeconds : DEFAULT_DELAY_MIN_SECONDS;
    const normalizedMaxSeconds = Number.isFinite(maxSeconds) && maxSeconds > 0 ? maxSeconds : normalizedMinSeconds;
    const delayMinMs = Math.min(normalizedMinSeconds, normalizedMaxSeconds) * 1000;
    const delayMaxMs = Math.max(normalizedMinSeconds, normalizedMaxSeconds) * 1000;

    const data = {
        name: (document.getElementById('campaignName') as HTMLInputElement | null)?.value.trim() || '',
        description: (document.getElementById('campaignDescription') as HTMLInputElement | null)?.value.trim() || '',
        type: ((document.getElementById('campaignType') as HTMLSelectElement | null)?.value || 'broadcast') as CampaignType,
        distribution_strategy: ((document.getElementById('campaignDistributionStrategy') as HTMLSelectElement | null)?.value || 'single') as Campaign['distribution_strategy'],
        status,
        segment: (document.getElementById('campaignSegment') as HTMLSelectElement | null)?.value || '',
        tag_filter: (document.getElementById('campaignTagFilter') as HTMLSelectElement | null)?.value || '',
        message: (document.getElementById('campaignMessage') as HTMLTextAreaElement | null)?.value.trim() || '',
        delay: delayMinMs,
        delay_min: delayMinMs,
        delay_max: delayMaxMs,
        start_at: (document.getElementById('campaignStart') as HTMLInputElement | null)?.value || '',
        sender_accounts: collectCampaignSenderAccountsFromForm()
    };

    if (!data.name || !data.message) {
        showToast('error', 'Erro', 'Nome e mensagem são obrigatórios');
        return;
    }

    try {
        showLoading('Salvando campanha...');
        if (campaignId) {
            await api.put(`/api/campaigns/${campaignId}`, data);
        } else {
            await api.post('/api/campaigns', data);
        }
        closeModal('newCampaignModal');
        resetCampaignForm();
        await loadCampaigns();
        showToast('success', 'Sucesso', campaignId ? 'Campanha atualizada com sucesso!' : 'Campanha criada com sucesso!');
    } catch (error) {
        hideLoading();
        if (!shouldUseLocalCampaignFallback(error)) {
            showToast('error', 'Erro', (error as Error)?.message || 'Não foi possível salvar a campanha');
            return;
        }
        if (campaignId) {
            const index = campaigns.findIndex(c => c.id === campaignId);
            if (index >= 0) {
                campaigns[index] = {
                    ...campaigns[index],
                    ...data,
                    status
                };
            }
            showToast('success', 'Sucesso', 'Campanha atualizada com sucesso!');
        } else {
            // Simular sucesso para demonstra??o
            campaigns.push({
                id: campaigns.length + 1,
                ...data,
                sent: 0,
                delivered: 0,
                read: 0,
                replied: 0,
                created_at: new Date().toISOString()
            });
            showToast('success', 'Sucesso', 'Campanha criada com sucesso!');
        }
        closeModal('newCampaignModal');
        resetCampaignForm();
        renderCampaigns();
        updateStats();
    }
}

function viewCampaign(id: number) {
    const campaign = campaigns.find(c => c.id === id);
    if (!campaign) return;
    activeCampaignDetailsId = campaign.id;
    activeCampaignDetailsTab = 'overview';

    const detailsTitle = document.getElementById('detailsTitle') as HTMLElement | null;
    if (detailsTitle) {
        detailsTitle.innerHTML = `<span class="icon icon-campaigns icon-sm"></span> ${campaign.name}`;
    }
    renderCampaignOverviewContent(campaign);
    renderCampaignMessages(campaign);
    updateCampaignDetailsActionButton(campaign);
    void loadCampaignRecipients(campaign);

    openModal('campaignDetailsModal');
    switchCampaignTab('overview');
}

function editCampaign(id: number) {
    const campaign = campaigns.find(c => c.id === id);
    if (!campaign) return;
    syncCampaignSegmentOptions();
    renderCampaignTagFilterOptions(campaign.tag_filter || '');

    const idInput = document.getElementById('campaignId') as HTMLInputElement | null;
    if (idInput) idInput.value = String(campaign.id);

    const nameInput = document.getElementById('campaignName') as HTMLInputElement | null;
    if (nameInput) nameInput.value = campaign.name || '';

    const descriptionInput = document.getElementById('campaignDescription') as HTMLInputElement | null;
    if (descriptionInput) descriptionInput.value = campaign.description || '';

    setSelectValue(document.getElementById('campaignType') as HTMLSelectElement | null, campaign.type || 'broadcast');
    setSelectValue(
        document.getElementById('campaignDistributionStrategy') as HTMLSelectElement | null,
        String(campaign.distribution_strategy || 'single')
    );
    setSelectValue(document.getElementById('campaignSegment') as HTMLSelectElement | null, campaign.segment || 'all');
    const tagFilterInput = document.getElementById('campaignTagFilter') as HTMLSelectElement | null;
    if (tagFilterInput) setSelectValue(tagFilterInput, campaign.tag_filter || '');

    const messageInput = document.getElementById('campaignMessage') as HTMLTextAreaElement | null;
    if (messageInput) messageInput.value = campaign.message || '';
    closeCampaignMessageVariableMenu();
    bindCampaignMessageVariablePicker();

    const { minMs, maxMs } = resolveCampaignDelayRangeMs(campaign);
    setDelayRangeInputs(Math.round(minMs / 1000), Math.round(maxMs / 1000));

    const startInput = document.getElementById('campaignStart') as HTMLInputElement | null;
    if (startInput) startInput.value = formatInputDateTime(campaign.start_at);

    renderCampaignSenderAccountsSelector(normalizeCampaignSenderAccounts(campaign.sender_accounts));

    setCampaignModalTitle('edit');

    const win = window as Window & { openModal?: (id: string) => void };
    win.openModal?.('newCampaignModal');
}

async function startCampaign(id: number) {
    if (!confirm('Iniciar esta campanha?')) return;
    try {
        await api.put(`/api/campaigns/${id}`, { status: 'active' });
    } catch (error) {
        if (!shouldUseLocalCampaignFallback(error)) {
            showToast('error', 'Erro', (error as Error)?.message || 'Não foi possível iniciar a campanha');
            return;
        }
    }
    const campaign = campaigns.find(c => c.id === id);
    if (campaign) campaign.status = 'active';
    renderCampaigns();
    updateStats();
    const activeViewedCampaign = activeCampaignDetailsId != null ? campaigns.find(c => c.id === activeCampaignDetailsId) : undefined;
    if (activeViewedCampaign) {
        syncCampaignDetailsModal(activeViewedCampaign, { refreshRecipients: shouldRefreshCampaignRecipientsInRealtime(activeViewedCampaign) });
    }
    scheduleCampaignsRealtimeRefresh(300);
    showToast('success', 'Sucesso', 'Campanha iniciada!');
}

async function pauseCampaign(id: number) {
    if (!confirm('Pausar esta campanha?')) return;
    try {
        await api.put(`/api/campaigns/${id}`, { status: 'paused' });
    } catch (error) {
        if (!shouldUseLocalCampaignFallback(error)) {
            showToast('error', 'Erro', (error as Error)?.message || 'Não foi possível pausar a campanha');
            return;
        }
    }
    const campaign = campaigns.find(c => c.id === id);
    if (campaign) campaign.status = 'paused';
    renderCampaigns();
    updateStats();
    const activeViewedCampaign = activeCampaignDetailsId != null ? campaigns.find(c => c.id === activeCampaignDetailsId) : undefined;
    if (activeViewedCampaign) {
        syncCampaignDetailsModal(activeViewedCampaign, { refreshRecipients: shouldRefreshCampaignRecipientsInRealtime(activeViewedCampaign) });
    }
    scheduleCampaignsRealtimeRefresh(300);
    showToast('success', 'Sucesso', 'Campanha pausada!');
}

async function deleteCampaign(id: number) {
    if (!confirm('Excluir esta campanha?')) return;
    try {
        await api.delete(`/api/campaigns/${id}`);
    } catch (error) {
        if (!shouldUseLocalCampaignFallback(error)) {
            showToast('error', 'Erro', (error as Error)?.message || 'Não foi possível excluir a campanha');
            return;
        }
    }
    campaigns = campaigns.filter(c => c.id !== id);
    if (activeCampaignDetailsId === id) {
        activeCampaignDetailsId = null;
    }
    renderCampaigns();
    updateStats();
    showToast('success', 'Sucesso', 'Campanha excluída!');
}

function switchCampaignTab(tab: string) {
    const tabOrder = ['overview', 'messages', 'recipients'];
    const resolvedTab = tabOrder.includes(tab) ? tab : 'overview';
    activeCampaignDetailsTab = resolvedTab as typeof activeCampaignDetailsTab;
    const activeIndex = tabOrder.indexOf(resolvedTab);

    const tabs = Array.from(document.querySelectorAll('#campaignDetailsModal .tab'));
    tabs.forEach((button, index) => {
        if (index === activeIndex) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    document.querySelectorAll('#campaignDetailsModal .tab-content').forEach(c => c.classList.remove('active'));
    const activeContent = document.getElementById(`tab-${resolvedTab}`);
    const fallbackContent = document.getElementById('tab-overview');
    activeContent?.classList.add('active');
    if (!activeContent) {
        fallbackContent?.classList.add('active');
    }

    if (resolvedTab === 'recipients' && activeCampaignDetailsId != null) {
        const campaign = campaigns.find((item) => item.id === activeCampaignDetailsId);
        if (campaign && !campaignRecipientsRefreshInFlight) {
            campaignRecipientsRefreshInFlight = true;
            void loadCampaignRecipients(campaign).finally(() => {
                campaignRecipientsRefreshInFlight = false;
            });
        }
    }
}

const windowAny = window as Window & {
    initCampanhas?: () => void;
    loadCampaigns?: () => void;
    openCampaignModal?: () => void;
    openBroadcastModal?: () => void;
    saveCampaign?: (status?: CampaignStatus) => Promise<void>;
    viewCampaign?: (id: number) => void;
    editCampaign?: (id: number) => void;
    startCampaign?: (id: number) => Promise<void>;
    pauseCampaign?: (id: number) => Promise<void>;
    deleteCampaign?: (id: number) => Promise<void>;
    switchCampaignTab?: (tab: string) => void;
};
windowAny.initCampanhas = initCampanhas;
windowAny.loadCampaigns = loadCampaigns;
windowAny.openCampaignModal = openCampaignModal;
windowAny.openBroadcastModal = openBroadcastModal;
windowAny.saveCampaign = saveCampaign;
windowAny.viewCampaign = viewCampaign;
windowAny.editCampaign = editCampaign;
windowAny.startCampaign = startCampaign;
windowAny.pauseCampaign = pauseCampaign;
windowAny.deleteCampaign = deleteCampaign;
windowAny.switchCampaignTab = switchCampaignTab;

export { initCampanhas };
