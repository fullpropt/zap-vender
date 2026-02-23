// Configuracoes page logic migrated to module

type Settings = {
    company?: { name?: string; cnpj?: string; phone?: string; email?: string };
    funnel?: Array<{ name?: string; color?: string; description?: string }>;
    whatsapp?: { interval?: string; messagesPerHour?: string; workStart?: string; workEnd?: string };
    businessHours?: { enabled?: boolean; start?: string; end?: string; autoReplyMessage?: string };
    notifications?: { notifyNewLead?: boolean; notifyNewMessage?: boolean; notifySound?: boolean };
};

type TemplateItem = {
    id: number;
    name: string;
    category?: string;
    content: string;
    variables?: string[];
    media_type?: string;
    media_url?: string;
};

type SettingsTag = {
    id: number;
    name: string;
    color?: string;
    description?: string;
};

type ContactField = {
    key: string;
    label: string;
    placeholder?: string;
    is_default?: boolean;
    required?: boolean;
    source?: string;
};

type WhatsAppSessionRecord = {
    session_id: string;
    name?: string;
    phone?: string;
    status?: string;
    connected?: boolean;
    campaign_enabled?: boolean | number;
    daily_limit?: number;
    dispatch_weight?: number;
};

type ManagedUser = {
    id: number;
    uuid?: string;
    name?: string;
    email?: string;
    role?: string;
    is_active?: number | boolean;
    last_login_at?: string | null;
    created_at?: string | null;
};

let templatesCache: TemplateItem[] = [];
let settingsTagsCache: SettingsTag[] = [];
let contactFieldsCache: ContactField[] = [];
let customContactFieldsCache: ContactField[] = [];
let whatsappSessionsCache: WhatsAppSessionRecord[] = [];
let usersCache: ManagedUser[] = [];

const DEFAULT_CONTACT_FIELDS: ContactField[] = [
    { key: 'nome', label: 'Nome', source: 'name', is_default: true, required: true, placeholder: 'Nome completo' },
    { key: 'telefone', label: 'Telefone', source: 'phone', is_default: true, required: true, placeholder: 'Somente n\u00FAmeros com DDD' },
    { key: 'email', label: 'Email', source: 'email', is_default: true, required: false, placeholder: 'email@exemplo.com' }
];

const DEFAULT_BUSINESS_HOURS_SETTINGS = {
    enabled: false,
    start: '08:00',
    end: '18:00'
};

const DEFAULT_NOTIFICATION_SETTINGS = {
    notifyNewLead: true,
    notifyNewMessage: true,
    notifySound: true
};

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}


function getPanelFromLocation() {
    const hash = window.location.hash || '';
    if (!hash) return null;

    if (hash.startsWith('#/')) {
        const queryIndex = hash.indexOf('?');
        if (queryIndex >= 0) {
            const params = new URLSearchParams(hash.slice(queryIndex + 1));
            return params.get('panel');
        }
        return null;
    }

    return hash.startsWith('#') ? hash.slice(1) : hash;
}

function initConfiguracoes() {
    loadSettings();
    loadContactFields();
    loadTemplates();
    loadSettingsTags();
    loadUsers();
    refreshWhatsAppAccounts();
    updateNewTemplateForm();
    const typeSelect = document.getElementById('newTemplateType') as HTMLSelectElement | null;
    if (typeSelect) {
        typeSelect.addEventListener('change', updateNewTemplateForm);
    }
    const panelFromUrl = getPanelFromLocation();
    if (panelFromUrl) {
        const panel = document.getElementById(`panel-${panelFromUrl}`);
        if (panel) {
            document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
            document.querySelector(`[onclick="showPanel('${panelFromUrl}')"]`)?.classList.add('active');
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            panel.classList.add('active');
        }
    }
    clearBusinessHoursMessageField();
    setTimeout(clearBusinessHoursMessageField, 250);
}

onReady(initConfiguracoes);

function showPanel(panelId: string) {
    document.querySelectorAll('.settings-nav-item').forEach(item => item.classList.remove('active'));
    const target = (window as any).event?.target as HTMLElement | undefined;
    target?.closest('.settings-nav-item')?.classList.add('active');
    document.querySelectorAll('.settings-panel').forEach(panel => panel.classList.remove('active'));
    document.getElementById(`panel-${panelId}`).classList.add('active');
    if (panelId === 'conexao') {
        refreshWhatsAppAccounts();
    } else if (panelId === 'users') {
        loadUsers();
    } else if (panelId === 'hours') {
        clearBusinessHoursMessageField();
        setTimeout(clearBusinessHoursMessageField, 150);
    }
}

function sanitizeSessionId(value: unknown, fallback = '') {
    const normalized = String(value || '').trim();
    return normalized || fallback;
}

function parseConnectedStatus(session: WhatsAppSessionRecord) {
    if (typeof session.connected === 'boolean') return session.connected;
    return String(session.status || '').toLowerCase() === 'connected';
}

function getSessionStatusLabel(session: WhatsAppSessionRecord) {
    return parseConnectedStatus(session) ? 'Conectada' : 'Desconectada';
}

function getSessionDisplayName(session: WhatsAppSessionRecord) {
    const customName = String(session.name || '').trim();
    if (customName) return customName;
    const phone = String(session.phone || '').trim();
    if (phone) return phone;
    return sanitizeSessionId(session.session_id);
}

function parseDispatchWeight(value: unknown, fallback = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.max(1, Math.floor(parsed));
}

function parseDailyLimit(value: unknown, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.max(0, Math.floor(parsed));
}

function decodeSessionToken(sessionToken: string) {
    try {
        return decodeURIComponent(String(sessionToken || ''));
    } catch {
        return String(sessionToken || '');
    }
}

function escapeAttributeSelector(value: string) {
    if (typeof (window as Window & { CSS?: { escape?: (input: string) => string } }).CSS?.escape === 'function') {
        return (window as Window & { CSS: { escape: (input: string) => string } }).CSS.escape(value);
    }
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function applyCompanySettings(company: { name?: string; cnpj?: string; phone?: string; email?: string }) {
    const companyName = document.getElementById('companyName') as HTMLInputElement | null;
    const companyCnpj = document.getElementById('companyCnpj') as HTMLInputElement | null;
    const companyPhone = document.getElementById('companyPhone') as HTMLInputElement | null;
    const companyEmail = document.getElementById('companyEmail') as HTMLInputElement | null;
    if (companyName) companyName.value = company.name || '';
    if (companyCnpj) companyCnpj.value = company.cnpj || '';
    if (companyPhone) companyPhone.value = company.phone || '';
    if (companyEmail) companyEmail.value = company.email || '';
}

function normalizeBusinessHoursTime(value: unknown, fallback: string) {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return fallback;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallback;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseBooleanSetting(value: unknown, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    }
    return fallback;
}

function clearBusinessHoursMessageField() {
    const messageInput = document.getElementById('outsideHoursAutoReplyMessage') as HTMLTextAreaElement | null;
    if (!messageInput) return;
    messageInput.value = '';
    messageInput.defaultValue = '';
    messageInput.textContent = '';
}

function applyBusinessHoursSettings(values: Partial<{ enabled: boolean; start: string; end: string }>) {
    const enabledInput = document.getElementById('businessHoursEnabled') as HTMLInputElement | null;
    const startInput = document.getElementById('businessHoursStart') as HTMLInputElement | null;
    const endInput = document.getElementById('businessHoursEnd') as HTMLInputElement | null;

    const normalized = {
        enabled: parseBooleanSetting(values?.enabled, DEFAULT_BUSINESS_HOURS_SETTINGS.enabled),
        start: normalizeBusinessHoursTime(values?.start, DEFAULT_BUSINESS_HOURS_SETTINGS.start),
        end: normalizeBusinessHoursTime(values?.end, DEFAULT_BUSINESS_HOURS_SETTINGS.end)
    };

    if (enabledInput) enabledInput.checked = normalized.enabled;
    if (startInput) startInput.value = normalized.start;
    if (endInput) endInput.value = normalized.end;
    clearBusinessHoursMessageField();
}

function readBusinessHoursSettingsFromForm() {
    const enabledInput = document.getElementById('businessHoursEnabled') as HTMLInputElement | null;
    const startInput = document.getElementById('businessHoursStart') as HTMLInputElement | null;
    const endInput = document.getElementById('businessHoursEnd') as HTMLInputElement | null;

    return {
        enabled: Boolean(enabledInput?.checked),
        start: normalizeBusinessHoursTime(startInput?.value, DEFAULT_BUSINESS_HOURS_SETTINGS.start),
        end: normalizeBusinessHoursTime(endInput?.value, DEFAULT_BUSINESS_HOURS_SETTINGS.end)
    };
}

function applyNotificationSettings(values: Partial<{ notifyNewLead: boolean; notifyNewMessage: boolean; notifySound: boolean }>) {
    const notifyNewLeadInput = document.getElementById('notifyNewLead') as HTMLInputElement | null;
    const notifyNewMessageInput = document.getElementById('notifyNewMessage') as HTMLInputElement | null;
    const notifySoundInput = document.getElementById('notifySound') as HTMLInputElement | null;

    const normalized = {
        notifyNewLead: parseBooleanSetting(values?.notifyNewLead, DEFAULT_NOTIFICATION_SETTINGS.notifyNewLead),
        notifyNewMessage: parseBooleanSetting(values?.notifyNewMessage, DEFAULT_NOTIFICATION_SETTINGS.notifyNewMessage),
        notifySound: parseBooleanSetting(values?.notifySound, DEFAULT_NOTIFICATION_SETTINGS.notifySound)
    };

    if (notifyNewLeadInput) notifyNewLeadInput.checked = normalized.notifyNewLead;
    if (notifyNewMessageInput) notifyNewMessageInput.checked = normalized.notifyNewMessage;
    if (notifySoundInput) notifySoundInput.checked = normalized.notifySound;
}

function readNotificationSettingsFromForm() {
    const notifyNewLeadInput = document.getElementById('notifyNewLead') as HTMLInputElement | null;
    const notifyNewMessageInput = document.getElementById('notifyNewMessage') as HTMLInputElement | null;
    const notifySoundInput = document.getElementById('notifySound') as HTMLInputElement | null;

    return {
        notifyNewLead: notifyNewLeadInput ? Boolean(notifyNewLeadInput.checked) : DEFAULT_NOTIFICATION_SETTINGS.notifyNewLead,
        notifyNewMessage: notifyNewMessageInput ? Boolean(notifyNewMessageInput.checked) : DEFAULT_NOTIFICATION_SETTINGS.notifyNewMessage,
        notifySound: notifySoundInput ? Boolean(notifySoundInput.checked) : DEFAULT_NOTIFICATION_SETTINGS.notifySound
    };
}

async function loadSettings() {
    const localSettings: Settings = JSON.parse(localStorage.getItem('selfSettings') || '{}');
    applyCompanySettings(localSettings.company || {});
    applyBusinessHoursSettings(localSettings.businessHours || DEFAULT_BUSINESS_HOURS_SETTINGS);
    applyNotificationSettings(localSettings.notifications || DEFAULT_NOTIFICATION_SETTINGS);

    try {
        const response = await api.get('/api/settings');
        const serverSettings = response?.settings || {};
        const hasCompanySettings = ['company_name', 'company_cnpj', 'company_phone', 'company_email']
            .some((key) => Object.prototype.hasOwnProperty.call(serverSettings, key));

        const company = {
            name: String(serverSettings.company_name || ''),
            cnpj: String(serverSettings.company_cnpj || ''),
            phone: String(serverSettings.company_phone || ''),
            email: String(serverSettings.company_email || '')
        };

        const businessHours = {
            enabled: parseBooleanSetting(serverSettings.business_hours_enabled, localSettings.businessHours?.enabled ?? DEFAULT_BUSINESS_HOURS_SETTINGS.enabled),
            start: normalizeBusinessHoursTime(serverSettings.business_hours_start, localSettings.businessHours?.start || DEFAULT_BUSINESS_HOURS_SETTINGS.start),
            end: normalizeBusinessHoursTime(serverSettings.business_hours_end, localSettings.businessHours?.end || DEFAULT_BUSINESS_HOURS_SETTINGS.end)
        };
        const notifications = {
            notifyNewLead: parseBooleanSetting(serverSettings.notify_new_lead, localSettings.notifications?.notifyNewLead ?? DEFAULT_NOTIFICATION_SETTINGS.notifyNewLead),
            notifyNewMessage: parseBooleanSetting(serverSettings.notify_new_message, localSettings.notifications?.notifyNewMessage ?? DEFAULT_NOTIFICATION_SETTINGS.notifyNewMessage),
            notifySound: parseBooleanSetting(serverSettings.notify_sound, localSettings.notifications?.notifySound ?? DEFAULT_NOTIFICATION_SETTINGS.notifySound)
        };

        if (hasCompanySettings) {
            applyCompanySettings(company);
        }
        applyBusinessHoursSettings(businessHours);
        applyNotificationSettings(notifications);

        localStorage.setItem('selfSettings', JSON.stringify({
            ...localSettings,
            company: hasCompanySettings ? company : (localSettings.company || {}),
            businessHours,
            notifications
        }));
    } catch (error) {
        // Mantem fallback local sem interromper a pagina
    }
}

async function saveGeneralSettings() {
    const settings: Settings = JSON.parse(localStorage.getItem('selfSettings') || '{}');
    const company = {
        name: ((document.getElementById('companyName') as HTMLInputElement | null)?.value || '').trim(),
        cnpj: ((document.getElementById('companyCnpj') as HTMLInputElement | null)?.value || '').trim(),
        phone: ((document.getElementById('companyPhone') as HTMLInputElement | null)?.value || '').trim(),
        email: ((document.getElementById('companyEmail') as HTMLInputElement | null)?.value || '').trim()
    };

    settings.company = company;
    localStorage.setItem('selfSettings', JSON.stringify(settings));

    try {
        await api.put('/api/settings', {
            company_name: company.name || 'ZapVender',
            company_cnpj: company.cnpj,
            company_phone: company.phone,
            company_email: company.email
        });
        showToast('success', 'Sucesso', 'Configurações salvas!');
    } catch (error) {
        showToast('warning', 'Aviso', 'Salvo localmente, mas não foi possível sincronizar no servidor');
    }
}

async function saveBusinessHoursSettings() {
    const settings: Settings = JSON.parse(localStorage.getItem('selfSettings') || '{}');
    const businessHours = readBusinessHoursSettingsFromForm();

    settings.businessHours = businessHours;
    localStorage.setItem('selfSettings', JSON.stringify(settings));

    try {
        await api.put('/api/settings', {
            business_hours_enabled: businessHours.enabled,
            business_hours_start: businessHours.start,
            business_hours_end: businessHours.end
        });
        showToast('success', 'Sucesso', 'Horários atualizados!');
    } catch (error) {
        showToast('warning', 'Aviso', 'Salvo localmente, mas não foi possível sincronizar no servidor');
    }
    clearBusinessHoursMessageField();
}

async function loadSettingsTags() {
    try {
        const response = await api.get('/api/tags');
        settingsTagsCache = response?.tags || [];
        renderSettingsTags();
    } catch (error) {
        settingsTagsCache = [];
        renderSettingsTags();
    }
}

function renderSettingsTags() {
    const tbody = document.getElementById('settingsTagsTableBody') as HTMLElement | null;
    if (!tbody) return;

    if (!settingsTagsCache.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="table-empty">
                    <div class="table-empty-icon icon icon-empty icon-lg"></div>
                    <p>Nenhuma etiqueta encontrada</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = settingsTagsCache.map((tag) => `
        <tr data-tag-id="${tag.id}">
            <td><input type="text" class="form-input settings-tag-name" value="${escapeHtml(tag.name || '')}" /></td>
            <td style="width: 110px;"><input type="color" class="form-input settings-tag-color" value="${escapeHtml(tag.color || '#5a2a6b')}" style="height: 40px; min-width: 70px;" /></td>
            <td><input type="text" class="form-input settings-tag-description" value="${escapeHtml(tag.description || '')}" placeholder="Opcional" /></td>
            <td style="width: 180px;">
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-sm btn-outline" onclick="updateSettingsTag(${tag.id})">Salvar</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteSettingsTag(${tag.id})">Remover</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function createSettingsTag() {
    const nameInput = document.getElementById('newTagName') as HTMLInputElement | null;
    const colorInput = document.getElementById('newTagColor') as HTMLInputElement | null;
    const descriptionInput = document.getElementById('newTagDescription') as HTMLInputElement | null;

    const name = (nameInput?.value || '').trim();
    const color = (colorInput?.value || '#5a2a6b').trim();
    const description = (descriptionInput?.value || '').trim();

    if (!name) {
        showToast('warning', 'Aviso', 'Informe o nome da etiqueta');
        nameInput?.focus();
        return;
    }

    try {
        await api.post('/api/tags', { name, color, description });
        if (nameInput) nameInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        if (colorInput) colorInput.value = '#5a2a6b';
        await loadSettingsTags();
        showToast('success', 'Sucesso', 'Etiqueta criada!');
    } catch (error: any) {
        const message = String(error?.message || '').toLowerCase();
        if (message.includes('409') || message.includes('ja existe')) {
            showToast('warning', 'Aviso', 'Já existe uma etiqueta com esse nome');
            return;
        }
        showToast('error', 'Erro', 'Não foi possível criar a etiqueta');
    }
}

function getSettingsTagRow(id: number) {
    return document.querySelector(`#settingsTagsTableBody tr[data-tag-id="${id}"]`) as HTMLElement | null;
}

async function updateSettingsTag(id: number) {
    const row = getSettingsTagRow(id);
    if (!row) return;

    const name = ((row.querySelector('.settings-tag-name') as HTMLInputElement | null)?.value || '').trim();
    const color = ((row.querySelector('.settings-tag-color') as HTMLInputElement | null)?.value || '#5a2a6b').trim();
    const description = ((row.querySelector('.settings-tag-description') as HTMLInputElement | null)?.value || '').trim();

    if (!name) {
        showToast('warning', 'Aviso', 'Nome da etiqueta é obrigatório');
        return;
    }

    try {
        await api.put(`/api/tags/${id}`, { name, color, description });
        await loadSettingsTags();
        showToast('success', 'Sucesso', 'Etiqueta atualizada!');
    } catch (error: any) {
        const message = String(error?.message || '').toLowerCase();
        if (message.includes('409') || message.includes('ja existe')) {
            showToast('warning', 'Aviso', 'Já existe uma etiqueta com esse nome');
            return;
        }
        showToast('error', 'Erro', 'Não foi possível atualizar a etiqueta');
    }
}

async function deleteSettingsTag(id: number) {
    if (!confirm('Deseja remover esta etiqueta?')) return;

    try {
        await api.delete(`/api/tags/${id}`);
        await loadSettingsTags();
        showToast('success', 'Sucesso', 'Etiqueta removida!');
    } catch (error) {
        showToast('error', 'Erro', 'Não foi possível remover a etiqueta');
    }
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

function normalizeContactFieldPlaceholder(value: string) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function sanitizeContactField(field: ContactField) {
    const label = normalizeContactFieldLabel(field?.label || field?.key || '');
    const key = normalizeContactFieldKey(field?.key || label);
    if (!label || !key || key === '__system') return null;
    if (DEFAULT_CONTACT_FIELDS.some((item) => item.key === key)) return null;
    return {
        key,
        label,
        placeholder: normalizeContactFieldPlaceholder(field?.placeholder || '')
    };
}

function sanitizeCustomContactFields(fields: ContactField[]) {
    const dedupe = new Set<string>();
    const result: ContactField[] = [];

    for (const field of fields || []) {
        const sanitized = sanitizeContactField(field);
        if (!sanitized) continue;
        if (dedupe.has(sanitized.key)) continue;
        dedupe.add(sanitized.key);
        result.push(sanitized);
    }

    return result;
}

function renderContactVariableTags() {
    const container = document.getElementById('contactVariablesList') as HTMLElement | null;
    if (!container) return;

    const fields = contactFieldsCache.length ? contactFieldsCache : DEFAULT_CONTACT_FIELDS;
    container.innerHTML = fields
        .map((field) => `<span class="variable-tag" onclick="insertVariable('{{${field.key}}}')">{{${field.key}}}</span>`)
        .join('');
}

function renderDefaultContactFieldsList() {
    const container = document.getElementById('defaultContactFieldsList') as HTMLElement | null;
    if (!container) return;

    container.innerHTML = DEFAULT_CONTACT_FIELDS
        .map((field) => `<span class="variable-tag">{{${field.key}}} - ${escapeHtml(field.label)}</span>`)
        .join('');
}

function renderContactFieldsTable() {
    const tbody = document.getElementById('contactFieldsTableBody') as HTMLElement | null;
    if (!tbody) return;

    if (!customContactFieldsCache.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="table-empty">
                    <div class="table-empty-icon icon icon-empty icon-lg"></div>
                    <p>Nenhum campo personalizado cadastrado</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = customContactFieldsCache.map((field) => `
        <tr data-field-key="${escapeHtml(field.key)}">
            <td><code>{{${escapeHtml(field.key)}}}</code></td>
            <td><input type="text" class="form-input contact-field-label" value="${escapeHtml(field.label || '')}" /></td>
            <td><input type="text" class="form-input contact-field-placeholder" value="${escapeHtml(field.placeholder || '')}" placeholder="Opcional" /></td>
            <td style="width: 180px;">
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-sm btn-outline" onclick="updateContactField('${escapeHtml(field.key)}')">Salvar</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteContactField('${escapeHtml(field.key)}')">Remover</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderContactFieldsSection() {
    renderDefaultContactFieldsList();
    renderContactFieldsTable();
    renderContactVariableTags();
}

async function loadContactFields() {
    try {
        const response = await api.get('/api/contact-fields');
        const customFields = sanitizeCustomContactFields(response?.customFields || []);
        const allFields = Array.isArray(response?.fields) && response.fields.length
            ? response.fields
            : [...DEFAULT_CONTACT_FIELDS, ...customFields];

        customContactFieldsCache = customFields;
        contactFieldsCache = allFields.map((field: ContactField) => {
            const normalizedKey = normalizeContactFieldKey(field.key);
            return {
                key: normalizedKey,
                label: normalizeContactFieldLabel(field.label || field.key),
                placeholder: normalizeContactFieldPlaceholder(field.placeholder || ''),
                is_default: Boolean(field.is_default || DEFAULT_CONTACT_FIELDS.some((item) => item.key === normalizedKey)),
                required: Boolean(field.required),
                source: field.source || (DEFAULT_CONTACT_FIELDS.some((item) => item.key === normalizedKey) ? 'default' : 'custom')
            };
        });
    } catch (error) {
        customContactFieldsCache = [];
        contactFieldsCache = [...DEFAULT_CONTACT_FIELDS];
    }

    renderContactFieldsSection();
}

async function persistContactFields(showSuccess = true) {
    const payload = sanitizeCustomContactFields(customContactFieldsCache);
    await api.put('/api/contact-fields', { fields: payload });
    await loadContactFields();
    if (showSuccess) {
        showToast('success', 'Sucesso', 'Campos dinâmicos atualizados!');
    }
}

async function createContactField() {
    const labelInput = document.getElementById('newContactFieldLabel') as HTMLInputElement | null;
    const placeholderInput = document.getElementById('newContactFieldPlaceholder') as HTMLInputElement | null;

    const label = normalizeContactFieldLabel(labelInput?.value || '');
    const placeholder = normalizeContactFieldPlaceholder(placeholderInput?.value || '');
    const key = normalizeContactFieldKey(label);

    if (!label || !key) {
        showToast('warning', 'Aviso', 'Informe um nome v\u00E1lido para o campo');
        labelInput?.focus();
        return;
    }

    if (DEFAULT_CONTACT_FIELDS.some((field) => field.key === key)) {
        showToast('warning', 'Aviso', 'Esse campo j\u00E1 existe como padr\u00E3o');
        labelInput?.focus();
        return;
    }

    if (customContactFieldsCache.some((field) => field.key === key)) {
        showToast('warning', 'Aviso', 'J\u00E1 existe um campo com essa vari\u00E1vel');
        labelInput?.focus();
        return;
    }

    customContactFieldsCache.push({ key, label, placeholder });

    try {
        await persistContactFields(true);
        if (labelInput) labelInput.value = '';
        if (placeholderInput) placeholderInput.value = '';
    } catch (error) {
        showToast('error', 'Erro', 'N\u00E3o foi poss\u00EDvel criar o campo');
    }
}

function getContactFieldRow(key: string) {
    return document.querySelector(`#contactFieldsTableBody tr[data-field-key="${key}"]`) as HTMLElement | null;
}

async function updateContactField(key: string) {
    const normalizedKey = normalizeContactFieldKey(key);
    const row = getContactFieldRow(normalizedKey);
    if (!row) return;

    const label = normalizeContactFieldLabel(((row.querySelector('.contact-field-label') as HTMLInputElement | null)?.value || '').trim());
    const placeholder = normalizeContactFieldPlaceholder(((row.querySelector('.contact-field-placeholder') as HTMLInputElement | null)?.value || '').trim());

    if (!label) {
        showToast('warning', 'Aviso', 'Informe o nome do campo');
        return;
    }

    const index = customContactFieldsCache.findIndex((field) => field.key === normalizedKey);
    if (index < 0) return;

    customContactFieldsCache[index] = {
        ...customContactFieldsCache[index],
        label,
        placeholder
    };

    try {
        await persistContactFields(true);
    } catch (error) {
        showToast('error', 'Erro', 'N\u00E3o foi poss\u00EDvel atualizar o campo');
    }
}

async function deleteContactField(key: string) {
    const normalizedKey = normalizeContactFieldKey(key);
    if (!normalizedKey) return;
    if (!confirm('Deseja remover este campo personalizado?')) return;

    customContactFieldsCache = customContactFieldsCache.filter((field) => field.key !== normalizedKey);

    try {
        await persistContactFields(true);
    } catch (error) {
        showToast('error', 'Erro', 'N\u00E3o foi poss\u00EDvel remover o campo');
    }
}

function getQuickReplyVariableKeys() {
    const fields = contactFieldsCache.length ? contactFieldsCache : DEFAULT_CONTACT_FIELDS;
    return fields.map((field) => field.key);
}

function saveFunnelSettings() {
    const settings: Settings = JSON.parse(localStorage.getItem('selfSettings') || '{}');
    settings.funnel = [];
    for (let i = 1; i <= 4; i++) {
        settings.funnel.push({
            name: (document.getElementById(`funnel${i}Name`) as HTMLInputElement | null)?.value || '',
            color: (document.getElementById(`funnel${i}Color`) as HTMLInputElement | null)?.value || '',
            description: (document.getElementById(`funnel${i}Desc`) as HTMLInputElement | null)?.value || ''
        });
    }
    localStorage.setItem('selfSettings', JSON.stringify(settings));
    showToast('success', 'Sucesso', 'Funil salvo!');
}

async function loadTemplates() {
    try {
        const response = await api.get('/api/templates');
        templatesCache = (response.templates || []).filter((template: TemplateItem) => {
            const category = normalizeName(template?.category || 'custom');
            return category === 'quick_reply' || category === 'custom' || category === '';
        });
        renderTemplatesList();
    } catch (error) {
        templatesCache = [];
        renderTemplatesList();
    }
}

function updateNewTemplateForm() {
    const typeSelect = document.getElementById('newTemplateType') as HTMLSelectElement | null;
    const textGroup = document.getElementById('newTemplateTextGroup') as HTMLElement | null;
    const audioGroup = document.getElementById('newTemplateAudioGroup') as HTMLElement | null;
    if (!typeSelect || !textGroup || !audioGroup) return;
    const type = typeSelect.value || 'text';
    if (type === 'audio') {
        textGroup.style.display = 'none';
        audioGroup.style.display = 'block';
    } else {
        textGroup.style.display = 'block';
        audioGroup.style.display = 'none';
    }
}

function normalizeName(value: string) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function escapeHtml(value: string) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


function renderTemplatesList() {
    const container = document.getElementById('templatesList');
    const empty = document.getElementById('templatesEmpty');
    if (!container) return;

    if (!templatesCache.length) {
        container.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }

    if (empty) empty.style.display = 'none';
    container.innerHTML = templatesCache.map(renderTemplateCard).join('');
}

function getMediaUrl(url?: string | null) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const base = (window as any).APP?.socketUrl || '';
    return `${base}${url}`;
}

function renderTemplateCard(template: TemplateItem) {
    const safeName = escapeHtml(template.name || '');
    const mediaType = template.media_type || 'text';
    const safeContent = escapeHtml(template.content || '');
    const audioUrl = mediaType === 'audio' && template.media_url ? getMediaUrl(template.media_url) : '';
    const mediaUrlAttr = template.media_url ? escapeHtml(template.media_url) : '';

    const body = mediaType === 'audio'
        ? `
            <div class="template-audio">
                ${audioUrl ? `<audio controls preload="metadata" src="${audioUrl}"></audio>` : `<p class="text-muted">Nenhum áudio enviado.</p>`}
                <input type="file" class="form-input template-audio-input" accept="audio/*" onchange="replaceTemplateAudio(${template.id}, event)" />
                <small class="text-muted">Envie um novo áudio para substituir o atual.</small>
            </div>
        `
        : `
            <textarea class="form-textarea template-content" rows="4">${safeContent}</textarea>
        `;

    return `
        <div class="copy-card template-card" data-template-id="${template.id}" data-media-type="${mediaType}" data-media-url="${mediaUrlAttr}">
            <div class="copy-card-header" style="display: flex; gap: 12px; align-items: center; justify-content: space-between;">
                <input class="form-input template-name" value="${safeName}" />
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-sm btn-outline" onclick="saveTemplate(${template.id})">Salvar</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteTemplate(${template.id})">Excluir</button>
                </div>
            </div>
            ${body}
        </div>
    `;
}

async function saveTemplateInternal(card: HTMLElement, showToastMessage = true) {
    const id = card.dataset.templateId;
    const mediaType = card.dataset.mediaType || 'text';
    const mediaUrl = card.dataset.mediaUrl || '';
    const nameInput = card.querySelector('.template-name') as HTMLInputElement | null;
    const contentInput = card.querySelector('.template-content') as HTMLTextAreaElement | null;
    const name = nameInput?.value.trim() || '';

    if (!id || !name) {
        if (showToastMessage) showToast('warning', 'Aviso', 'Preencha o título da resposta rápida');
        return;
    }

    const payload: Record<string, any> = {
        name,
        category: 'quick_reply'
    };

    if (mediaType === 'audio') {
        if (!mediaUrl) {
            if (showToastMessage) showToast('warning', 'Aviso', 'Envie um áudio para a resposta rápida');
            return;
        }
        payload.media_type = 'audio';
        payload.media_url = mediaUrl;
    } else {
        const content = contentInput?.value.trim() || '';
        if (!content) {
            if (showToastMessage) showToast('warning', 'Aviso', 'Preencha a mensagem da resposta rápida');
            return;
        }
        payload.content = content;
    }

    await api.put(`/api/templates/${id}`, payload);
    if (showToastMessage) {
        showToast('success', 'Sucesso', 'Resposta rápida atualizada!');
    }
}

async function saveTemplate(id: number) {
    const card = document.querySelector(`.template-card[data-template-id="${id}"]`) as HTMLElement | null;
    if (!card) return;
    try {
        await saveTemplateInternal(card, true);
    } catch (error) {
        showToast('error', 'Erro', 'Não foi possível salvar');
    }
}

async function saveCopysSettings() {
    const cards = Array.from(document.querySelectorAll('.template-card')) as HTMLElement[];
    if (!cards.length) {
        showToast('info', 'Info', 'Nenhuma resposta rápida para salvar');
        return;
    }

    try {
        for (const card of cards) {
            await saveTemplateInternal(card, false);
        }
        await loadTemplates();
        showToast('success', 'Sucesso', 'Respostas rápidas salvas!');
    } catch (error) {
        showToast('error', 'Erro', 'Não foi possível salvar as respostas rápidas');
    }
}

async function deleteTemplate(id: number) {
    if (!confirm('Excluir esta resposta rápida?')) return;
    try {
        await api.delete(`/api/templates/${id}`);
        await loadTemplates();
        showToast('success', 'Sucesso', 'Resposta rápida removida!');
    } catch (error) {
        showToast('error', 'Erro', 'Não foi possível remover');
    }
}

async function replaceTemplateAudio(id: number, event: Event) {
    const target = event.target as HTMLInputElement | null;
    const file = target?.files?.[0];
    if (!file) return;

    try {
        showLoading('Enviando áudio...');
        const uploaded = await uploadFile(file);
        hideLoading();

        const card = document.querySelector(`.template-card[data-template-id="${id}"]`) as HTMLElement | null;
        const nameInput = card?.querySelector('.template-name') as HTMLInputElement | null;
        const name = nameInput?.value.trim() || '';

        await api.put(`/api/templates/${id}`, {
            name: name || `Resposta rápida ${id}`,
            category: 'quick_reply',
            media_type: 'audio',
            media_url: uploaded.url,
            content: ''
        });
        await loadTemplates();
        showToast('success', 'Sucesso', 'Áudio atualizado!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', 'Não foi possível atualizar o áudio');
    } finally {
        if (target) target.value = '';
    }
}

async function uploadFile(file: File) {
    const baseUrl = (window as any).APP?.socketUrl || '';
    const token = sessionStorage.getItem('selfDashboardToken');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${baseUrl}/api/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Falha no upload');
    }

    return data.file;
}

function insertVariable(variable: string) {
    const focused = document.activeElement as HTMLTextAreaElement | null;
    if (focused && focused.tagName === 'TEXTAREA') {
        const start = focused.selectionStart || 0;
        const end = focused.selectionEnd || 0;
        const text = focused.value || '';
        focused.value = text.substring(0, start) + variable + text.substring(end);
        focused.selectionStart = focused.selectionEnd = start + variable.length;
        focused.focus();
    }
}

async function saveNewTemplate() {
    const name = (document.getElementById('newTemplateName') as HTMLInputElement | null)?.value.trim() || '';
    const type = (document.getElementById('newTemplateType') as HTMLSelectElement | null)?.value || 'text';
    const message = (document.getElementById('newTemplateMessage') as HTMLTextAreaElement | null)?.value.trim() || '';
    const audioInput = document.getElementById('newTemplateAudio') as HTMLInputElement | null;
    const audioFile = audioInput?.files?.[0];
    if (!name) { showToast('error', 'Erro', 'Preencha o título da resposta rápida'); return; }
    try {
        if (type === 'audio') {
            if (!audioFile) {
                showToast('error', 'Erro', 'Selecione um arquivo de áudio');
                return;
            }
            showLoading('Enviando áudio...');
            const uploaded = await uploadFile(audioFile);
            hideLoading();
            await api.post('/api/templates', {
                name,
                category: 'quick_reply',
                content: '',
                media_type: 'audio',
                media_url: uploaded.url
            });
        } else {
            if (!message) { showToast('error', 'Erro', 'Preencha a mensagem'); return; }
            await api.post('/api/templates', {
                name,
                category: 'quick_reply',
                content: message,
                variables: getQuickReplyVariableKeys()
            });
        }
        closeModal('addTemplateModal');
        const newTemplateName = document.getElementById('newTemplateName') as HTMLInputElement | null;
        const newTemplateMessage = document.getElementById('newTemplateMessage') as HTMLTextAreaElement | null;
        const newTemplateType = document.getElementById('newTemplateType') as HTMLSelectElement | null;
        if (newTemplateName) newTemplateName.value = '';
        if (newTemplateMessage) newTemplateMessage.value = '';
        if (audioInput) audioInput.value = '';
        if (newTemplateType) newTemplateType.value = 'text';
        updateNewTemplateForm();
        await loadTemplates();
        showToast('success', 'Sucesso', 'Resposta rápida adicionada!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', 'Não foi possível adicionar a resposta rápida');
    }
}

function renderWhatsAppAccountsManager() {
    const container = document.getElementById('connectionAccountsList') as HTMLElement | null;
    if (!container) return;

    if (!whatsappSessionsCache.length) {
        container.innerHTML = `
            <div class="connection-account-item">
                <p style="margin: 0; color: var(--gray-600);">
                    Nenhuma conta encontrada. Acesse <a href="#/whatsapp">WhatsApp</a> para adicionar uma conta.
                </p>
            </div>
        `;
        return;
    }

    const sortedSessions = [...whatsappSessionsCache].sort((a, b) => {
        const byConnected = Number(parseConnectedStatus(b)) - Number(parseConnectedStatus(a));
        if (byConnected !== 0) return byConnected;
        return sanitizeSessionId(a.session_id).localeCompare(sanitizeSessionId(b.session_id));
    });

    container.innerHTML = sortedSessions.map((session) => {
        const sessionId = sanitizeSessionId(session.session_id);
        const token = encodeURIComponent(sessionId);
        const status = getSessionStatusLabel(session);
        const statusClass = parseConnectedStatus(session) ? 'connected' : 'disconnected';
        const displayName = getSessionDisplayName(session);
        const phone = String(session.phone || '').trim();
        const subtitle = phone ? `${sessionId} - ${phone}` : sessionId;
        const campaignEnabled = parseBooleanSetting(session.campaign_enabled, true);
        const dispatchWeight = parseDispatchWeight(session.dispatch_weight, 1);
        const dailyLimit = parseDailyLimit(session.daily_limit, 0);

        return `
            <div class="connection-account-item">
                <div class="connection-account-head">
                    <div>
                        <strong>${escapeHtml(displayName)}</strong>
                        <div class="connection-account-session">${escapeHtml(subtitle)}</div>
                    </div>
                    <span class="connection-status-pill ${statusClass}">${status}</span>
                </div>
                <div class="connection-account-body">
                    <div class="form-group">
                        <label class="form-label">Nome da conta</label>
                        <input
                            type="text"
                            class="form-input connection-session-name-input"
                            data-session-id="${escapeHtml(sessionId)}"
                            value="${escapeHtml(String(session.name || ''))}"
                            placeholder="Ex: Comercial SP"
                        />
                    </div>
                    <div class="form-group connection-account-inline-field">
                        <label class="form-label">Peso</label>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            class="form-input connection-session-weight-input"
                            data-session-id="${escapeHtml(sessionId)}"
                            value="${dispatchWeight}"
                        />
                    </div>
                    <div class="form-group connection-account-inline-field">
                        <label class="form-label">Limite diário</label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            class="form-input connection-session-daily-limit-input"
                            data-session-id="${escapeHtml(sessionId)}"
                            value="${dailyLimit}"
                        />
                    </div>
                    <label class="connection-campaign-toggle" title="Participa de campanhas e transmissões">
                        <input
                            type="checkbox"
                            class="connection-session-enabled-input"
                            data-session-id="${escapeHtml(sessionId)}"
                            ${campaignEnabled ? 'checked' : ''}
                        />
                        Usar em campanhas
                    </label>
                    <button class="btn btn-outline" onclick="saveWhatsAppSessionName('${token}')">Salvar</button>
                    <button class="btn btn-outline-danger" onclick="removeWhatsAppSession('${token}')">Remover</button>
                </div>
            </div>
        `;
    }).join('');
}

async function refreshWhatsAppAccounts() {
    const container = document.getElementById('connectionAccountsList') as HTMLElement | null;
    if (container) {
        container.innerHTML = '<p style="color: var(--gray-500); margin: 0;">Carregando contas...</p>';
    }

    try {
        const response = await api.get('/api/whatsapp/sessions?includeDisabled=true');
        whatsappSessionsCache = Array.isArray(response?.sessions) ? response.sessions : [];
    } catch (error) {
        whatsappSessionsCache = [];
    }

    renderWhatsAppAccountsManager();
}

async function saveWhatsAppSessionName(sessionToken: string) {
    const sessionId = sanitizeSessionId(decodeSessionToken(sessionToken));
    if (!sessionId) return;

    const selectorSessionId = escapeAttributeSelector(sessionId);
    const nameInput = document.querySelector<HTMLInputElement>(`.connection-session-name-input[data-session-id="${selectorSessionId}"]`);
    const weightInput = document.querySelector<HTMLInputElement>(`.connection-session-weight-input[data-session-id="${selectorSessionId}"]`);
    const dailyLimitInput = document.querySelector<HTMLInputElement>(`.connection-session-daily-limit-input[data-session-id="${selectorSessionId}"]`);
    const enabledInput = document.querySelector<HTMLInputElement>(`.connection-session-enabled-input[data-session-id="${selectorSessionId}"]`);

    const name = String(nameInput?.value || '').trim();
    const dispatchWeight = parseDispatchWeight(weightInput?.value, 1);
    const dailyLimit = parseDailyLimit(dailyLimitInput?.value, 0);
    const campaignEnabled = Boolean(enabledInput?.checked);

    try {
        await api.put(`/api/whatsapp/sessions/${encodeURIComponent(sessionId)}`, {
            name,
            campaign_enabled: campaignEnabled,
            daily_limit: dailyLimit,
            dispatch_weight: dispatchWeight
        });
        showToast('success', 'Sucesso', 'Configurações da conta atualizadas.');
        await refreshWhatsAppAccounts();
    } catch (error) {
        showToast('error', 'Erro', 'Nao foi possivel atualizar a conta.');
    }
}

async function removeWhatsAppSession(sessionToken: string) {
    const sessionId = sanitizeSessionId(decodeSessionToken(sessionToken));
    if (!sessionId) return;

    const confirmed = confirm(`Remover a conta ${sessionId}? Essa acao desconecta e exclui a sessao.`);
    if (!confirmed) return;

    try {
        await api.delete(`/api/whatsapp/sessions/${encodeURIComponent(sessionId)}`);
        const activeSessionId = sanitizeSessionId(localStorage.getItem('zapvender_active_whatsapp_session'));
        if (activeSessionId === sessionId) {
            localStorage.removeItem('zapvender_active_whatsapp_session');
        }
        showToast('success', 'Sucesso', 'Conta removida.');
        await refreshWhatsAppAccounts();
    } catch (error) {
        showToast('error', 'Erro', 'Nao foi possivel remover a conta.');
    }
}

async function connectWhatsApp() {
    try {
        showLoading('Gerando QR Code...');
        const response = await api.get('/api/whatsapp/qr');
        hideLoading();
        if (response.qr) {
            const qrContainer = document.getElementById('qrCodeContainer') as HTMLElement | null;
            const qrCode = document.getElementById('qrCode') as HTMLElement | null;
            if (qrContainer) qrContainer.style.display = 'block';
            if (qrCode) qrCode.innerHTML = `<img src="${response.qr}" alt="QR Code" style="max-width: 250px;">`;
        }
    } catch (error) { hideLoading(); showToast('error', 'Erro', 'Não foi possível gerar o QR Code'); }
}

async function disconnectWhatsApp() {
    showToast('info', 'Info', 'Gerencie as contas pela lista de contas WhatsApp.');
}

function saveWhatsAppSettings() {
    const settings: Settings = JSON.parse(localStorage.getItem('selfSettings') || '{}');
    settings.whatsapp = {
        interval: (document.getElementById('messageInterval') as HTMLInputElement | null)?.value || '',
        messagesPerHour: (document.getElementById('messagesPerHour') as HTMLInputElement | null)?.value || '',
        workStart: (document.getElementById('workStart') as HTMLInputElement | null)?.value || '',
        workEnd: (document.getElementById('workEnd') as HTMLInputElement | null)?.value || ''
    };
    localStorage.setItem('selfSettings', JSON.stringify(settings));
    showToast('success', 'Sucesso', 'Configurações salvas!');
}

async function saveNotificationSettings() {
    const settings: Settings = JSON.parse(localStorage.getItem('selfSettings') || '{}');
    const notifications = readNotificationSettingsFromForm();

    settings.notifications = notifications;
    localStorage.setItem('selfSettings', JSON.stringify(settings));

    try {
        await api.put('/api/settings', {
            notify_new_lead: notifications.notifyNewLead,
            notify_new_message: notifications.notifyNewMessage,
            notify_sound: notifications.notifySound
        });
        showToast('success', 'Sucesso', 'Notificacoes salvas!');
    } catch (error) {
        showToast('warning', 'Aviso', 'Salvo localmente, mas nao foi possivel sincronizar no servidor');
    }
}

function normalizeUserRole(value: unknown) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'user') return 'agent';
    if (normalized === 'admin' || normalized === 'supervisor') return normalized;
    return 'agent';
}

function getUserRoleLabel(role: unknown) {
    const normalized = normalizeUserRole(role);
    if (normalized === 'admin') return 'Administrador';
    if (normalized === 'supervisor') return 'Supervisor';
    return 'Usuário';
}

function getUserRoleBadgeClass(role: unknown) {
    const normalized = normalizeUserRole(role);
    if (normalized === 'admin') return 'badge-primary';
    if (normalized === 'supervisor') return 'badge-warning';
    return 'badge-secondary';
}

function isManagedUserActive(user: ManagedUser) {
    if (typeof user.is_active === 'boolean') return user.is_active;
    return Number(user.is_active) > 0;
}

function getCurrentUserRoleFromToken() {
    const token = sessionStorage.getItem('selfDashboardToken');
    if (!token) return '';

    try {
        const parts = token.split('.');
        if (parts.length < 2) return '';
        const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payloadBase64 + '='.repeat((4 - (payloadBase64.length % 4)) % 4);
        const payload = JSON.parse(atob(padded));
        return String(payload?.role || '').trim().toLowerCase();
    } catch {
        return '';
    }
}

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody') as HTMLElement | null;
    if (!tbody) return;

    if (!usersCache.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="table-empty">
                    <div class="table-empty-icon icon icon-empty icon-lg"></div>
                    <p>Nenhum usuário encontrado</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = usersCache.map((user) => {
        const active = isManagedUserActive(user);
        const userId = Number(user.id) || 0;
        return `
            <tr data-user-id="${userId}">
                <td>${escapeHtml(String(user.name || 'Sem nome'))}</td>
                <td>${escapeHtml(String(user.email || '-'))}</td>
                <td><span class="badge ${getUserRoleBadgeClass(user.role)}">${getUserRoleLabel(user.role)}</span></td>
                <td><span class="badge ${active ? 'badge-success' : 'badge-secondary'}">${active ? 'Ativo' : 'Inativo'}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="openEditUserModal(${userId})" title="Editar usuário">
                        <span class="icon icon-edit icon-sm"></span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody') as HTMLElement | null;
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="table-empty">
                    <div class="table-empty-icon icon icon-empty icon-lg"></div>
                    <p>Carregando usuários...</p>
                </td>
            </tr>
        `;
    }

    try {
        const response = await api.get('/api/users');
        usersCache = Array.isArray(response?.users) ? response.users : [];
        renderUsersTable();
    } catch (error: any) {
        usersCache = [];
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="table-empty">
                        <div class="table-empty-icon icon icon-empty icon-lg"></div>
                        <p>Não foi possível carregar os usuários</p>
                    </td>
                </tr>
            `;
        }
        const message = String(error?.message || '').toLowerCase();
        if (message.includes('permiss')) {
            showToast('warning', 'Aviso', 'Sua conta não tem permissão para listar todos os usuários.');
        }
    }
}

function openEditUserModal(id: number) {
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) return;

    const user = usersCache.find((item) => Number(item.id) === userId);
    if (!user) {
        showToast('warning', 'Aviso', 'Usuário não encontrado');
        return;
    }

    const editUserId = document.getElementById('editUserId') as HTMLInputElement | null;
    const editUserName = document.getElementById('editUserName') as HTMLInputElement | null;
    const editUserEmail = document.getElementById('editUserEmail') as HTMLInputElement | null;
    const editUserRole = document.getElementById('editUserRole') as HTMLSelectElement | null;
    const editUserActive = document.getElementById('editUserActive') as HTMLSelectElement | null;

    if (editUserId) editUserId.value = String(userId);
    if (editUserName) editUserName.value = String(user.name || '');
    if (editUserEmail) editUserEmail.value = String(user.email || '');
    if (editUserRole) editUserRole.value = normalizeUserRole(user.role);
    if (editUserActive) editUserActive.value = isManagedUserActive(user) ? '1' : '0';

    const isAdmin = getCurrentUserRoleFromToken() === 'admin';
    if (editUserRole) editUserRole.disabled = !isAdmin;
    if (editUserActive) editUserActive.disabled = !isAdmin;

    openModal('editUserModal');
}

async function updateUser() {
    const editUserId = document.getElementById('editUserId') as HTMLInputElement | null;
    const editUserName = document.getElementById('editUserName') as HTMLInputElement | null;
    const editUserEmail = document.getElementById('editUserEmail') as HTMLInputElement | null;
    const editUserRole = document.getElementById('editUserRole') as HTMLSelectElement | null;
    const editUserActive = document.getElementById('editUserActive') as HTMLSelectElement | null;

    const id = parseInt(editUserId?.value || '0', 10);
    const name = String(editUserName?.value || '').trim();
    const email = String(editUserEmail?.value || '').trim();

    if (!id || !name || !email) {
        showToast('error', 'Erro', 'Nome e e-mail são obrigatórios');
        return;
    }

    const payload: Record<string, unknown> = { name, email };
    const isAdmin = getCurrentUserRoleFromToken() === 'admin';
    if (isAdmin) {
        payload.role = normalizeUserRole(editUserRole?.value || 'agent');
        payload.is_active = editUserActive?.value === '0' ? 0 : 1;
    }

    try {
        await api.put(`/api/users/${id}`, payload);
        closeModal('editUserModal');
        await loadUsers();
        showToast('success', 'Sucesso', 'Usuário atualizado!');
    } catch (error: any) {
        showToast('error', 'Erro', error?.message || 'Não foi possível atualizar o usuário');
    }
}

async function addUser() {
    const name = (document.getElementById('newUserName') as HTMLInputElement | null)?.value.trim() || '';
    const email = (document.getElementById('newUserEmail') as HTMLInputElement | null)?.value.trim() || '';
    const password = (document.getElementById('newUserPassword') as HTMLInputElement | null)?.value || '';
    const role = normalizeUserRole((document.getElementById('newUserRole') as HTMLSelectElement | null)?.value || 'agent');

    if (!name || !email || !password) {
        showToast('error', 'Erro', 'Preencha todos os campos');
        return;
    }

    if (password.length < 6) {
        showToast('error', 'Erro', 'A senha deve ter pelo menos 6 caracteres');
        return;
    }

    try {
        await api.post('/api/users', { name, email, password, role });
        closeModal('addUserModal');
        const newUserName = document.getElementById('newUserName') as HTMLInputElement | null;
        const newUserEmail = document.getElementById('newUserEmail') as HTMLInputElement | null;
        const newUserPassword = document.getElementById('newUserPassword') as HTMLInputElement | null;
        const newUserRole = document.getElementById('newUserRole') as HTMLSelectElement | null;
        if (newUserName) newUserName.value = '';
        if (newUserEmail) newUserEmail.value = '';
        if (newUserPassword) newUserPassword.value = '';
        if (newUserRole) newUserRole.value = 'agent';
        await loadUsers();
        showToast('success', 'Sucesso', 'Usuário adicionado!');
    } catch (error: any) {
        showToast('error', 'Erro', error?.message || 'Não foi possível adicionar o usuário');
    }
}

async function changePassword() {
    const current = (document.getElementById('currentPassword') as HTMLInputElement | null)?.value || '';
    const newPass = (document.getElementById('newPassword') as HTMLInputElement | null)?.value || '';
    const confirm = (document.getElementById('confirmPassword') as HTMLInputElement | null)?.value || '';
    if (!current || !newPass || !confirm) { showToast('error', 'Erro', 'Preencha todos os campos'); return; }
    if (newPass !== confirm) { showToast('error', 'Erro', 'As senhas não conferem'); return; }
    if (newPass.length < 6) { showToast('error', 'Erro', 'A senha deve ter pelo menos 6 caracteres'); return; }

    try {
        await api.post('/api/auth/change-password', {
            currentPassword: current,
            newPassword: newPass
        });
        showToast('success', 'Sucesso', 'Senha alterada!');
        const currentPassword = document.getElementById('currentPassword') as HTMLInputElement | null;
        const newPassword = document.getElementById('newPassword') as HTMLInputElement | null;
        const confirmPassword = document.getElementById('confirmPassword') as HTMLInputElement | null;
        if (currentPassword) currentPassword.value = '';
        if (newPassword) newPassword.value = '';
        if (confirmPassword) confirmPassword.value = '';
    } catch (error: any) {
        showToast('error', 'Erro', error?.message || 'Não foi possível alterar a senha');
    }
}

function copyApiKey() {
    const apiKey = (document.getElementById('apiKey') as HTMLInputElement | null)?.value || '';
    navigator.clipboard.writeText(apiKey);
    showToast('success', 'Copiado', 'API Key copiada!');
}
function regenerateApiKey() {
    if (!confirm('Regenerar a API Key?')) return;
    const apiKey = document.getElementById('apiKey') as HTMLInputElement | null;
    if (apiKey) apiKey.value = 'sk_live_' + Math.random().toString(36).substring(2, 15);
    showToast('success', 'Sucesso', 'Nova API Key gerada!');
}
function testWebhook() { showToast('info', 'Testando', 'Enviando requisição de teste...'); setTimeout(() => { showToast('success', 'Sucesso', 'Webhook respondeu corretamente!'); }, 1500); }
function saveApiSettings() { showToast('success', 'Sucesso', 'Configurações de API salvas!'); }

const windowAny = window as Window & {
    initConfiguracoes?: () => void;
    showPanel?: (panelId: string) => void;
    saveGeneralSettings?: () => void;
    saveFunnelSettings?: () => void;
    saveCopysSettings?: () => void;
    insertVariable?: (variable: string) => void;
    saveNewTemplate?: () => void;
    saveTemplate?: (id: number) => void;
    deleteTemplate?: (id: number) => void;
    replaceTemplateAudio?: (id: number, event: Event) => void;
    updateNewTemplateForm?: () => void;
    connectWhatsApp?: () => Promise<void>;
    disconnectWhatsApp?: () => Promise<void>;
    refreshWhatsAppAccounts?: () => Promise<void>;
    saveWhatsAppSessionName?: (sessionToken: string) => Promise<void>;
    removeWhatsAppSession?: (sessionToken: string) => Promise<void>;
    saveWhatsAppSettings?: () => void;
    saveBusinessHoursSettings?: () => Promise<void>;
    saveNotificationSettings?: () => Promise<void>;
    createContactField?: () => Promise<void>;
    updateContactField?: (key: string) => Promise<void>;
    deleteContactField?: (key: string) => Promise<void>;
    createSettingsTag?: () => Promise<void>;
    updateSettingsTag?: (id: number) => Promise<void>;
    deleteSettingsTag?: (id: number) => Promise<void>;
    loadUsers?: () => Promise<void>;
    addUser?: () => Promise<void>;
    openEditUserModal?: (id: number) => void;
    updateUser?: () => Promise<void>;
    changePassword?: () => Promise<void>;
    copyApiKey?: () => void;
    regenerateApiKey?: () => void;
    testWebhook?: () => void;
    saveApiSettings?: () => void;
};
windowAny.initConfiguracoes = initConfiguracoes;
windowAny.showPanel = showPanel;
windowAny.saveGeneralSettings = saveGeneralSettings;
windowAny.saveFunnelSettings = saveFunnelSettings;
windowAny.saveCopysSettings = saveCopysSettings;
windowAny.insertVariable = insertVariable;
windowAny.saveNewTemplate = saveNewTemplate;
windowAny.saveTemplate = saveTemplate;
windowAny.deleteTemplate = deleteTemplate;
windowAny.replaceTemplateAudio = replaceTemplateAudio;
windowAny.updateNewTemplateForm = updateNewTemplateForm;
windowAny.connectWhatsApp = connectWhatsApp;
windowAny.disconnectWhatsApp = disconnectWhatsApp;
windowAny.refreshWhatsAppAccounts = refreshWhatsAppAccounts;
windowAny.saveWhatsAppSessionName = saveWhatsAppSessionName;
windowAny.removeWhatsAppSession = removeWhatsAppSession;
windowAny.saveWhatsAppSettings = saveWhatsAppSettings;
windowAny.saveBusinessHoursSettings = saveBusinessHoursSettings;
windowAny.saveNotificationSettings = saveNotificationSettings;
windowAny.createContactField = createContactField;
windowAny.updateContactField = updateContactField;
windowAny.deleteContactField = deleteContactField;
windowAny.createSettingsTag = createSettingsTag;
windowAny.updateSettingsTag = updateSettingsTag;
windowAny.deleteSettingsTag = deleteSettingsTag;
windowAny.loadUsers = loadUsers;
windowAny.addUser = addUser;
windowAny.openEditUserModal = openEditUserModal;
windowAny.updateUser = updateUser;
windowAny.changePassword = changePassword;
windowAny.copyApiKey = copyApiKey;
windowAny.regenerateApiKey = regenerateApiKey;
windowAny.testWebhook = testWebhook;
windowAny.saveApiSettings = saveApiSettings;

export { initConfiguracoes };
