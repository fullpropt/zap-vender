// Contatos page logic migrated to module

type LeadStatus = 1 | 2 | 3 | 4;

type Contact = {
    id: number;
    name?: string;
    phone?: string;
    vehicle?: string;
    plate?: string;
    email?: string;
    status: LeadStatus;
    tags?: string;
    session_id?: string;
    session_label?: string;
    last_message_at?: string;
    created_at: string;
    notes?: string;
    custom_fields?: string | Record<string, any> | null;
};

type Tag = { id: number; name: string };
type Template = { id: number; name: string; content: string };
type ContactField = {
    key: string;
    label: string;
    placeholder?: string;
    is_default?: boolean;
    source?: string;
};
type WhatsappSessionItem = {
    session_id: string;
    status?: string;
    connected?: boolean;
    name?: string;
    phone?: string;
};

type LeadsResponse = { leads?: Contact[]; total?: number };
type TagsResponse = { tags?: Tag[] };
type TemplatesResponse = { templates?: Template[] };
type ContactFieldsResponse = { fields?: ContactField[]; customFields?: ContactField[] };
type BulkLeadsImportResponse = {
    success?: boolean;
    total?: number;
    imported?: number;
    updated?: number;
    insertConflicts?: number;
    skipped?: number;
    failed?: number;
    errors?: Array<{ index?: number; phone?: string; error?: string }>;
};
type BulkLeadsDeleteResponse = {
    success?: boolean;
    total?: number;
    deleted?: number;
    skipped?: number;
    failed?: number;
    errors?: Array<{ id?: number; error?: string }>;
};

let allContacts: Contact[] = [];
let filteredContacts: Contact[] = [];
let selectedContacts: number[] = [];
let currentPage = 1;
const perPage = 20;
let tags: Tag[] = [];
let contactFieldsCache: ContactField[] = [];
let customContactFieldsCache: ContactField[] = [];
let contactsSessionFilter = '';
let contactsAvailableSessions: WhatsappSessionItem[] = [];

const CONTACTS_SESSION_FILTER_STORAGE_KEY = 'zapvender_contacts_session_filter';
const CONTACTS_FETCH_BATCH_SIZE = 500;
const CONTACTS_FETCH_MAX_PAGES = 200;
const CONTACTS_IMPORT_BATCH_SIZE = 200;
const CONTACTS_BULK_DELETE_BATCH_SIZE = 1000;
const BASE_CONTACTS_TABLE_COLUMNS = 7;

function isContactsRouteActive() {
    const hash = String(window.location.hash || '').toLowerCase();
    return hash.startsWith('#/contatos');
}

const DEFAULT_CONTACT_FIELDS: ContactField[] = [
    { key: 'nome', label: 'Nome', source: 'name', is_default: true },
    { key: 'telefone', label: 'Telefone', source: 'phone', is_default: true },
    { key: 'email', label: 'Email', source: 'email', is_default: true }
];

function normalizeContactFieldKey(value: string) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);
}

function parseLeadCustomFields(value: unknown) {
    if (!value) return {};
    if (typeof value === 'object') return Array.isArray(value) ? {} : { ...(value as Record<string, any>) };
    if (typeof value !== 'string') return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function normalizeCustomFieldValue(value: unknown) {
    return String(value ?? '').trim();
}

function normalizeImportHeader(value: string) {
    return normalizeContactFieldKey(value || '');
}

function buildNormalizedImportRow(row: Record<string, string>) {
    const normalized: Record<string, string> = {};
    for (const [rawKey, rawValue] of Object.entries(row || {})) {
        const key = normalizeImportHeader(rawKey);
        if (!key || Object.prototype.hasOwnProperty.call(normalized, key)) continue;
        normalized[key] = String(rawValue || '').trim();
    }
    return normalized;
}

function getImportValue(normalizedRow: Record<string, string>, aliases: string[]) {
    for (const alias of aliases) {
        const key = normalizeImportHeader(alias);
        if (!key) continue;
        const value = normalizedRow[key];
        if (value !== undefined && value !== null && String(value).trim()) {
            return String(value).trim();
        }
    }
    return '';
}

function escapeHtml(value: string) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function sanitizeSessionId(value: unknown, fallback = '') {
    const normalized = String(value || '').trim();
    return normalized || fallback;
}

function normalizeContactPhoneForWhatsapp(value: unknown) {
    let digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';

    while (digits.startsWith('55') && digits.length > 11) {
        digits = digits.slice(2);
    }

    return digits;
}

function buildWhatsappLinkFromPhone(value: unknown) {
    const phone = normalizeContactPhoneForWhatsapp(value);
    if (!phone) return '';
    return `https://wa.me/55${phone}`;
}

function formatContactPhoneForDisplay(value: unknown) {
    const phone = normalizeContactPhoneForWhatsapp(value);
    return phone ? formatPhone(phone) : '';
}

function parseLeadTags(value: unknown) {
    if (!value) return [];

    if (Array.isArray(value)) {
        return value
            .map((item) => String(item || '').trim())
            .filter(Boolean);
    }

    const raw = String(value || '').trim();
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed
                .map((item) => String(item || '').trim())
                .filter(Boolean);
        }
    } catch {
        // fallback para texto legado
    }

    return raw
        .split(/[,;|]/)
        .map((item) => String(item || '').trim())
        .filter(Boolean);
}

function getContactSessionId(contact: Contact) {
    return sanitizeSessionId((contact as Record<string, any>).session_id || (contact as Record<string, any>).sessionId);
}

function getContactSessionLabel(contact: Contact) {
    const sessionId = getContactSessionId(contact);
    const fromApi = String((contact as Record<string, any>).session_label || (contact as Record<string, any>).sessionLabel || '').trim();
    if (fromApi) return fromApi;
    const known = contactsAvailableSessions.find((session) => sanitizeSessionId(session.session_id) === sessionId);
    if (known) return getSessionDisplayName(known);
    return sessionId;
}

function renderContactTagChips(contact: Contact) {
    const chips: string[] = [];
    const tags = parseLeadTags(contact.tags);

    if (!contactsSessionFilter) {
        const sessionId = getContactSessionId(contact);
        if (sessionId) {
            const sessionLabel = getContactSessionLabel(contact) || sessionId;
            chips.push(
                `<span class="badge contacts-tag-chip contacts-tag-chip-session" title="${escapeHtml(sessionId)}">Conta: ${escapeHtml(sessionLabel)}</span>`
            );
        }
    }

    for (const tag of tags) {
        chips.push(`<span class="badge badge-gray contacts-tag-chip">${escapeHtml(tag)}</span>`);
    }

    if (chips.length === 0) return '-';
    return `<div class="contacts-tags-cell">${chips.join('')}</div>`;
}

function getContactsVisibleCustomColumns() {
    return customContactFieldsCache.filter((field) => String(field.key || '').trim());
}

function getContactsTableColumnCount() {
    return BASE_CONTACTS_TABLE_COLUMNS + getContactsVisibleCustomColumns().length;
}

function resolveContactCustomFieldDisplayValue(contact: Contact, fieldKey: string, parsedCustomFields?: Record<string, any>) {
    const key = normalizeContactFieldKey(fieldKey);
    const customFields = parsedCustomFields || parseLeadCustomFields(contact.custom_fields);
    const customValue = customFields[key];
    if (customValue !== undefined && customValue !== null && String(customValue).trim()) {
        return String(customValue).trim();
    }

    if (key === 'placa' && String(contact.plate || '').trim()) {
        return String(contact.plate || '').trim();
    }

    if (key === 'modelo' && String(contact.vehicle || '').trim()) {
        return String(contact.vehicle || '').trim();
    }

    return '';
}

function renderContactsTableHeader() {
    const headerRow = document.getElementById('contactsTableHeadRow') as HTMLElement | null;
    if (!headerRow) return;

    const dynamicHeaders = getContactsVisibleCustomColumns()
        .map((field) => `<th>${escapeHtml(field.label || field.key)}</th>`)
        .join('');

    headerRow.innerHTML = `
        <th>
            <label class="checkbox-wrapper">
                <input type="checkbox" id="selectAll" onchange="toggleSelectAll()">
                <span class="checkbox-custom"></span>
            </label>
        </th>
        <th>Contato</th>
        <th>WhatsApp</th>
        ${dynamicHeaders}
        <th>Status</th>
        <th>Tags</th>
        <th>Última Interação</th>
        <th>Ações</th>
    `;
}

function getStoredContactsSessionFilter() {
    return sanitizeSessionId(localStorage.getItem(CONTACTS_SESSION_FILTER_STORAGE_KEY));
}

function persistContactsSessionFilter(sessionId: string) {
    const normalized = sanitizeSessionId(sessionId);
    if (!normalized) {
        localStorage.removeItem(CONTACTS_SESSION_FILTER_STORAGE_KEY);
        return;
    }
    localStorage.setItem(CONTACTS_SESSION_FILTER_STORAGE_KEY, normalized);
}

function getSessionStatusLabel(session: WhatsappSessionItem) {
    const connected = Boolean(session.connected) || String(session.status || '').toLowerCase() === 'connected';
    return connected ? 'Conectada' : 'Desconectada';
}

function isContactsSessionConnected(session: WhatsappSessionItem) {
    return Boolean(session.connected) || String(session.status || '').toLowerCase() === 'connected';
}

function getSessionDisplayName(session: WhatsappSessionItem) {
    const sessionId = sanitizeSessionId(session.session_id);
    const name = String(session.name || '').trim();
    if (name) return name;
    const phone = String(session.phone || '').trim();
    if (phone) return phone;
    return sessionId;
}

function renderContactsSessionFilterOptions() {
    const select = document.getElementById('filterSession') as HTMLSelectElement | null;
    if (!select) return;

    const options = [
        `<option value="">Todas as contas</option>`,
        ...contactsAvailableSessions.map((session) => {
            const sessionId = sanitizeSessionId(session.session_id);
            const displayName = getSessionDisplayName(session);
            const status = getSessionStatusLabel(session);
            const label = displayName === sessionId
                ? `${displayName} - ${status}`
                : `${displayName} - ${sessionId} - ${status}`;
            return `<option value="${escapeHtml(sessionId)}">${escapeHtml(label)}</option>`;
        })
    ];

    select.innerHTML = options.join('');
    select.value = contactsSessionFilter;
}

async function loadContactsSessionFilters() {
    contactsSessionFilter = sanitizeSessionId(getStoredContactsSessionFilter());

    try {
        const response = await api.get('/api/whatsapp/sessions?includeDisabled=true');
        contactsAvailableSessions = Array.isArray(response?.sessions) ? response.sessions : [];
    } catch {
        contactsAvailableSessions = [];
    }

    const knownIds = new Set(
        contactsAvailableSessions.map((item) => sanitizeSessionId(item.session_id)).filter(Boolean)
    );
    if (contactsSessionFilter && !knownIds.has(contactsSessionFilter)) {
        contactsSessionFilter = '';
        persistContactsSessionFilter('');
    }

    renderContactsSessionFilterOptions();
}

async function hasConnectedSessionForContactsSend() {
    const selectedSessionId = sanitizeSessionId(contactsSessionFilter);

    try {
        const response = await api.get('/api/whatsapp/sessions?includeDisabled=true');
        const sessions = Array.isArray(response?.sessions) ? response.sessions : [];
        contactsAvailableSessions = sessions;
        renderContactsSessionFilterOptions();

        if (selectedSessionId) {
            const selected = sessions.find(
                (session) => sanitizeSessionId(session.session_id) === selectedSessionId
            );
            if (selected) {
                return isContactsSessionConnected(selected);
            }
            const fallbackStatus = await api.get(`/api/whatsapp/status?sessionId=${encodeURIComponent(selectedSessionId)}`);
            return Boolean(fallbackStatus?.connected);
        }

        return sessions.some((session) => isContactsSessionConnected(session));
    } catch (_) {
        if (selectedSessionId) {
            try {
                const fallbackStatus = await api.get(`/api/whatsapp/status?sessionId=${encodeURIComponent(selectedSessionId)}`);
                return Boolean(fallbackStatus?.connected);
            } catch (_) {
                // Keep flow permissive when status cannot be checked.
            }
        }
        return true;
    }
}

function changeContactsSessionFilter(sessionId: string) {
    contactsSessionFilter = sanitizeSessionId(sessionId);
    persistContactsSessionFilter(contactsSessionFilter);
    void loadContacts();
}


function getQueryParams() {
    if (window.location.search) {
        return new URLSearchParams(window.location.search);
    }
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');
    const query = queryIndex >= 0 ? hash.slice(queryIndex + 1) : '';
    return new URLSearchParams(query);
}

function applyUrlFilters() {
    const params = getQueryParams();
    const statusParam = params.get('status');
    const idParam = params.get('id');

    if (statusParam) {
        const filterStatus = document.getElementById('filterStatus') as HTMLSelectElement | null;
        if (filterStatus) {
            filterStatus.value = statusParam;
            filterContacts();
        }
    }

    if (idParam) {
        const id = parseInt(idParam, 10);
        if (!Number.isNaN(id)) {
            setTimeout(() => editContact(id), 0);
        }
    }
}

function initContacts() {
    if (!isContactsRouteActive()) {
        return;
    }
    if (!document.getElementById('contactsTableBody')) {
        setTimeout(() => {
            if (isContactsRouteActive()) {
                initContacts();
            }
        }, 50);
        return;
    }
    loadContactFields();
    void loadContactsSessionFilters().finally(() => {
        loadContacts();
    });
    loadTags();
    loadTemplates();
}

async function fetchAllContacts() {
    const contacts: Contact[] = [];
    let offset = 0;
    let page = 0;
    let totalExpected: number | null = null;

    while (page < CONTACTS_FETCH_MAX_PAGES) {
        const params = new URLSearchParams();
        params.set('limit', String(CONTACTS_FETCH_BATCH_SIZE));
        params.set('offset', String(offset));
        if (contactsSessionFilter) {
            params.set('session_id', contactsSessionFilter);
        }

        const response: LeadsResponse = await api.get(`/api/leads?${params.toString()}`);
        const batch = Array.isArray(response?.leads) ? response.leads : [];
        const reportedTotal = Number(response?.total);

        if (Number.isFinite(reportedTotal) && reportedTotal > 0) {
            totalExpected = reportedTotal;
        }

        contacts.push(...batch);
        page += 1;
        offset += batch.length;

        if (batch.length < CONTACTS_FETCH_BATCH_SIZE) break;
        if (totalExpected !== null && contacts.length >= totalExpected) break;
    }

    if (page >= CONTACTS_FETCH_MAX_PAGES) {
        console.warn('Limite maximo de paginas atingido ao carregar contatos.');
    }

    return contacts;
}

async function loadContacts() {
    const canRenderContacts = () => isContactsRouteActive() && Boolean(document.getElementById('contactsTableBody'));
    const shouldHandleUi = canRenderContacts();

    try {
        if (shouldHandleUi) {
            showLoading('Carregando contatos...');
        }
        allContacts = await fetchAllContacts();
        if (!canRenderContacts()) {
            return;
        }
        pruneSelectedContactsByCurrentDataset();
        filteredContacts = [...allContacts];
        updateStats();
        renderContacts();
        applyUrlFilters();
        if (shouldHandleUi) {
            hideLoading();
        }
    } catch (error) {
        if (shouldHandleUi) {
            hideLoading();
        }
        if (canRenderContacts()) {
            showToast('error', 'Erro', 'Não foi possível carregar os contatos');
        }
    }
}

async function loadTags() {
    try {
        const response: TagsResponse = await api.get('/api/tags');
        tags = response.tags || [];
        const filterSelect = document.getElementById('filterTag') as HTMLSelectElement | null;
        const importSelect = document.getElementById('importTag') as HTMLSelectElement | null;
        const tagOptions = tags
            .map((tag) => `<option value="${escapeHtml(tag.name)}">${escapeHtml(tag.name)}</option>`)
            .join('');

        if (filterSelect) {
            const currentFilterValue = String(filterSelect.value || '').trim();
            filterSelect.innerHTML = `<option value="">Todas as Tags</option>${tagOptions}`;
            if (currentFilterValue && tags.some((tag) => tag.name === currentFilterValue)) {
                filterSelect.value = currentFilterValue;
            }
        }

        if (importSelect) {
            const currentImportValue = String(importSelect.value || '').trim();
            importSelect.innerHTML = `<option value="">Sem etiqueta</option>${tagOptions}`;
            if (currentImportValue && tags.some((tag) => tag.name === currentImportValue)) {
                importSelect.value = currentImportValue;
            }
        }
    } catch (e) {}
}

async function loadTemplates() {
    try {
        const response: TemplatesResponse = await api.get('/api/templates');
        const templates = response.templates || [];
        const select = document.getElementById('bulkTemplate') as HTMLSelectElement | null;
        if (!select) return;
        templates.forEach(t => {
            select.innerHTML += `<option value="${t.id}" data-content="${encodeURIComponent(t.content)}">${t.name}</option>`;
        });
    } catch (e) {}
}

function renderCustomFieldsInputs(containerId: string, inputClassName: string) {
    const container = document.getElementById(containerId) as HTMLElement | null;
    if (!container) return;

    if (!customContactFieldsCache.length) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = customContactFieldsCache
        .map((field) => `
            <div class="form-group">
                <label class="form-label">${escapeHtml(field.label || field.key)}</label>
                <input
                    type="text"
                    class="form-input ${inputClassName}"
                    data-custom-field-key="${escapeHtml(field.key)}"
                    placeholder="${escapeHtml(field.placeholder || '')}"
                />
            </div>
        `)
        .join('');
}

function renderContactCustomFields() {
    renderCustomFieldsInputs('contactCustomFields', 'contact-custom-field');
    renderCustomFieldsInputs('editContactCustomFields', 'edit-contact-custom-field');
}

async function loadContactFields() {
    try {
        const response: ContactFieldsResponse = await api.get('/api/contact-fields');
        const customFields = Array.isArray(response?.customFields) ? response.customFields : [];
        const allFields = Array.isArray(response?.fields) ? response.fields : [];

        customContactFieldsCache = customFields
            .map((field) => ({
                key: normalizeContactFieldKey(field.key),
                label: String(field.label || field.key || '').trim(),
                placeholder: String(field.placeholder || '').trim(),
                is_default: false,
                source: 'custom'
            }))
            .filter((field) => field.key && field.label);

        contactFieldsCache = allFields.length
            ? allFields.map((field) => ({
                key: normalizeContactFieldKey(field.key),
                label: String(field.label || field.key || '').trim(),
                placeholder: String(field.placeholder || '').trim(),
                is_default: Boolean(field.is_default),
                source: field.source
            }))
            : [...DEFAULT_CONTACT_FIELDS, ...customContactFieldsCache];
    } catch (error) {
        customContactFieldsCache = [];
        contactFieldsCache = [...DEFAULT_CONTACT_FIELDS];
    }

    renderContactCustomFields();
    renderContactsTableHeader();
    renderContacts();
}

function collectCustomFieldsValues(inputClassName: string) {
    const values: Record<string, string> = {};
    const elements = Array.from(document.querySelectorAll(`.${inputClassName}`)) as HTMLInputElement[];

    for (const element of elements) {
        const key = normalizeContactFieldKey(element.dataset.customFieldKey || '');
        if (!key) continue;

        const value = normalizeCustomFieldValue(element.value);
        if (value) {
            values[key] = value;
        }
    }

    return values;
}

function applyCustomFieldsValues(inputClassName: string, customFields: Record<string, any>) {
    const elements = Array.from(document.querySelectorAll(`.${inputClassName}`)) as HTMLInputElement[];
    for (const element of elements) {
        const key = normalizeContactFieldKey(element.dataset.customFieldKey || '');
        if (!key) continue;
        const value = customFields[key];
        element.value = value === undefined || value === null ? '' : String(value);
    }
}

function loadTemplate() {
    const select = document.getElementById('bulkTemplate') as HTMLSelectElement | null;
    if (!select) return;
    const option = select.options[select.selectedIndex];
    if (option?.dataset?.content) {
        const bulkMessage = document.getElementById('bulkMessage') as HTMLTextAreaElement | null;
        if (bulkMessage) {
            bulkMessage.value = decodeURIComponent(option.dataset.content);
        }
    }
}

function updateStats() {
    const totalContacts = document.getElementById('totalContacts') as HTMLElement | null;
    const activeContacts = document.getElementById('activeContacts') as HTMLElement | null;
    const newContacts = document.getElementById('newContacts') as HTMLElement | null;
    const withWhatsapp = document.getElementById('withWhatsapp') as HTMLElement | null;

    if (totalContacts) totalContacts.textContent = formatNumber(allContacts.length);
    if (activeContacts) {
        activeContacts.textContent = formatNumber(allContacts.filter(c => c.status !== 4).length);
    }
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (newContacts) {
        newContacts.textContent = formatNumber(
            allContacts.filter(c => new Date(c.created_at) > weekAgo).length
        );
    }
    if (withWhatsapp) {
        withWhatsapp.textContent = formatNumber(
            allContacts.filter(c => c.phone).length
        );
    }
}

function syncSelectionUi() {
    const bulkActions = document.getElementById('bulkActions') as HTMLElement | null;
    const selectedCount = document.getElementById('selectedCount') as HTMLElement | null;
    const selectAll = document.getElementById('selectAll') as HTMLInputElement | null;

    if (bulkActions) bulkActions.style.display = selectedContacts.length > 0 ? 'block' : 'none';
    if (selectedCount) selectedCount.textContent = String(selectedContacts.length);

    if (!selectAll) return;

    if (filteredContacts.length === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
        return;
    }

    const filteredIds = new Set(filteredContacts.map((contact) => contact.id));
    const selectedInFilter = selectedContacts.filter((id) => filteredIds.has(id)).length;

    selectAll.checked = selectedInFilter > 0 && selectedInFilter === filteredContacts.length;
    selectAll.indeterminate = selectedInFilter > 0 && selectedInFilter < filteredContacts.length;
}

function pruneSelectedContactsByCurrentDataset() {
    const availableIds = new Set(allContacts.map((contact) => contact.id));
    selectedContacts = selectedContacts.filter((id) => availableIds.has(id));
}

function renderContacts() {
    renderContactsTableHeader();
    const tbody = document.getElementById('contactsTableBody') as HTMLElement | null;
    if (!tbody) return;
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const pageContacts = filteredContacts.slice(start, end);
    const selectedIds = new Set(selectedContacts);

    if (pageContacts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${getContactsTableColumnCount()}" class="table-empty"><div class="table-empty-icon icon icon-empty icon-lg"></div><p>Nenhum contato encontrado</p></td></tr>`;
    } else {
        const dynamicColumns = getContactsVisibleCustomColumns();
        tbody.innerHTML = pageContacts.map(c => `
            <tr data-id="${c.id}">
                <td><label class="checkbox-wrapper"><input type="checkbox" class="contact-checkbox" value="${c.id}" onchange="updateSelection()" ${selectedIds.has(c.id) ? 'checked' : ''}><span class="checkbox-custom"></span></label></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="avatar" style="background: ${getAvatarColor(c.name)}">${getInitials(c.name)}</div>
                        <div>
                            <div style="font-weight: 600;">${c.name || 'Sem nome'}</div>
                            <div style="font-size: 12px; color: var(--gray-500);">${c.email || ''}</div>
                        </div>
                    </div>
                </td>
                <td>${(() => {
                    const whatsappLink = buildWhatsappLinkFromPhone(c.phone);
                    const phoneLabel = formatContactPhoneForDisplay(c.phone) || '-';
                    if (!whatsappLink) return '-';
                    return `<a href="${whatsappLink}" target="_blank" style="color: var(--whatsapp);">${phoneLabel}</a>`;
                })()}</td>
                ${(() => {
                    const parsedCustomFields = parseLeadCustomFields(c.custom_fields);
                    return dynamicColumns
                        .map((field) => {
                            const value = resolveContactCustomFieldDisplayValue(c, field.key, parsedCustomFields);
                            return `<td>${value ? escapeHtml(value) : '-'}</td>`;
                        })
                        .join('');
                })()}
                <td>${getStatusBadge(c.status)}</td>
                <td>${renderContactTagChips(c)}</td>
                <td>${c.last_message_at ? timeAgo(c.last_message_at) : '-'}</td>
                <td>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn btn-sm btn-whatsapp btn-icon" onclick="quickMessage(${c.id})" title="Mensagem"><span class="icon icon-message icon-sm"></span></button>
                        <button class="btn btn-sm btn-outline btn-icon" onclick="editContact(${c.id})" title="Editar"><span class="icon icon-edit icon-sm"></span></button>
                        <button class="btn btn-sm btn-outline-danger btn-icon" onclick="deleteContact(${c.id})" title="Excluir"><span class="icon icon-delete icon-sm"></span></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Paginação
    const total = filteredContacts.length;
    const totalPages = Math.ceil(total / perPage);
    const paginationInfo = document.getElementById('paginationInfo') as HTMLElement | null;
    const prevPage = document.getElementById('prevPage') as HTMLButtonElement | null;
    const nextPage = document.getElementById('nextPage') as HTMLButtonElement | null;
    if (paginationInfo) {
        paginationInfo.textContent = `Mostrando ${start + 1}-${Math.min(end, total)} de ${total} contatos`;
    }
    if (prevPage) prevPage.disabled = currentPage === 1;
    if (nextPage) nextPage.disabled = currentPage >= totalPages;

    syncSelectionUi();
}

function changePage(delta: number) {
    currentPage += delta;
    renderContacts();
}

function filterContacts() {
    const search = (document.getElementById('searchContacts') as HTMLInputElement | null)?.value.toLowerCase() || '';
    const status = (document.getElementById('filterStatus') as HTMLSelectElement | null)?.value || '';
    const tag = (document.getElementById('filterTag') as HTMLSelectElement | null)?.value || '';
    const normalizedTag = String(tag || '').trim().toLowerCase();

    filteredContacts = allContacts.filter(c => {
        const customValues = getContactsVisibleCustomColumns()
            .map((field) => resolveContactCustomFieldDisplayValue(c, field.key).toLowerCase())
            .filter(Boolean);
        const matchSearch = !search ||
            (c.name && c.name.toLowerCase().includes(search)) ||
            (c.phone && c.phone.includes(search)) ||
            customValues.some((value) => value.includes(search));
        const matchStatus = !status || c.status == (parseInt(status, 10) as LeadStatus);
        const contactTags = parseLeadTags(c.tags).map((item) => item.toLowerCase());
        const matchTag = !normalizedTag || contactTags.includes(normalizedTag);
        return matchSearch && matchStatus && matchTag;
    });

    const filteredIds = new Set(filteredContacts.map((contact) => contact.id));
    selectedContacts = selectedContacts.filter((id) => filteredIds.has(id));

    currentPage = 1;
    renderContacts();
}

function toggleSelectAll() {
    const checked = (document.getElementById('selectAll') as HTMLInputElement | null)?.checked || false;
    if (checked) {
        selectedContacts = Array.from(new Set(filteredContacts.map((contact) => contact.id)));
    } else {
        const filteredIds = new Set(filteredContacts.map((contact) => contact.id));
        selectedContacts = selectedContacts.filter((id) => !filteredIds.has(id));
    }
    renderContacts();
}

function updateSelection() {
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const pageContacts = filteredContacts.slice(start, end);
    const pageIds = new Set(pageContacts.map((contact) => contact.id));

    const checkedOnPage = Array.from(document.querySelectorAll('.contact-checkbox:checked'))
        .map((checkbox) => parseInt((checkbox as HTMLInputElement).value, 10))
        .filter((id) => Number.isInteger(id) && id > 0);

    selectedContacts = selectedContacts.filter((id) => !pageIds.has(id));
    selectedContacts.push(...checkedOnPage);
    selectedContacts = Array.from(new Set(selectedContacts));

    syncSelectionUi();
}

function clearSelection() {
    selectedContacts = [];
    syncSelectionUi();
    renderContacts();
}

async function saveContact() {
    const data = {
        name: (document.getElementById('contactName') as HTMLInputElement | null)?.value.trim() || '',
        phone: (document.getElementById('contactPhone') as HTMLInputElement | null)?.value.replace(/\D/g, '') || '',
        email: (document.getElementById('contactEmail') as HTMLInputElement | null)?.value.trim() || '',
        status: parseInt((document.getElementById('contactStatus') as HTMLSelectElement | null)?.value || '1', 10) as LeadStatus,
        source: (document.getElementById('contactSource') as HTMLSelectElement | null)?.value || ''
    };
    const customFields = collectCustomFieldsValues('contact-custom-field');
    if (Object.keys(customFields).length > 0) {
        (data as Record<string, any>).custom_fields = customFields;
    }

    if (!data.name || !data.phone) {
        showToast('error', 'Erro', 'Nome e telefone são obrigatórios');
        return;
    }

    try {
        showLoading('Salvando...');
        await api.post('/api/leads', data);
        closeModal('addContactModal');
        (document.getElementById('addContactForm') as HTMLFormElement | null)?.reset();
        applyCustomFieldsValues('contact-custom-field', {});
        await loadContacts();
        showToast('success', 'Sucesso', 'Contato adicionado!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Erro ao salvar');
    }
}

function editContact(id: number) {
    const contact = allContacts.find(c => c.id === id);
    if (!contact) return;

    const editContactId = document.getElementById('editContactId') as HTMLInputElement | null;
    const editContactName = document.getElementById('editContactName') as HTMLInputElement | null;
    const editContactPhone = document.getElementById('editContactPhone') as HTMLInputElement | null;
    const editContactEmail = document.getElementById('editContactEmail') as HTMLInputElement | null;
    const editContactStatus = document.getElementById('editContactStatus') as HTMLSelectElement | null;
    const editContactNotes = document.getElementById('editContactNotes') as HTMLTextAreaElement | null;

    if (editContactId) editContactId.value = String(contact.id);
    if (editContactName) editContactName.value = contact.name || '';
    if (editContactPhone) editContactPhone.value = contact.phone || '';
    if (editContactEmail) editContactEmail.value = contact.email || '';
    if (editContactStatus) editContactStatus.value = String(contact.status || 1);
    if (editContactNotes) editContactNotes.value = contact.notes || '';
    const currentCustomFields = parseLeadCustomFields(contact.custom_fields);
    applyCustomFieldsValues('edit-contact-custom-field', currentCustomFields);
    if (!customContactFieldsCache.length) {
        loadContactFields().then(() => applyCustomFieldsValues('edit-contact-custom-field', currentCustomFields));
    }

    openModal('editContactModal');
}

async function updateContact() {
    const id = (document.getElementById('editContactId') as HTMLInputElement | null)?.value || '';
    const numericId = parseInt(id, 10);
    const existingContact = allContacts.find((contact) => contact.id === numericId);
    const mergedCustomFields = parseLeadCustomFields(existingContact?.custom_fields);
    const incomingCustomFields = collectCustomFieldsValues('edit-contact-custom-field');

    for (const field of customContactFieldsCache) {
        const key = normalizeContactFieldKey(field.key);
        if (!key) continue;
        const value = incomingCustomFields[key];
        if (value) {
            mergedCustomFields[key] = value;
        } else {
            delete mergedCustomFields[key];
        }
    }

    const data = {
        name: (document.getElementById('editContactName') as HTMLInputElement | null)?.value.trim() || '',
        phone: (document.getElementById('editContactPhone') as HTMLInputElement | null)?.value.replace(/\D/g, '') || '',
        email: (document.getElementById('editContactEmail') as HTMLInputElement | null)?.value.trim() || '',
        status: parseInt((document.getElementById('editContactStatus') as HTMLSelectElement | null)?.value || '1', 10) as LeadStatus,
        custom_fields: mergedCustomFields
    };

    try {
        showLoading('Salvando...');
        await api.put(`/api/leads/${id}`, data);
        closeModal('editContactModal');
        await loadContacts();
        showToast('success', 'Sucesso', 'Contato atualizado!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Erro ao salvar');
    }
}

async function deleteContact(id: number) {
    if (!confirm('Excluir este contato?')) return;
    try {
        showLoading('Excluindo...');
        await api.delete(`/api/leads/${id}`);
        await loadContacts();
        showToast('success', 'Sucesso', 'Contato excluído!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Erro ao excluir');
    }
}

function quickMessage(id: number) {
    const contact = allContacts.find(c => c.id === id);
    if (contact) {
        const whatsappLink = buildWhatsappLinkFromPhone(contact.phone);
        if (whatsappLink) {
            window.open(whatsappLink, '_blank');
        }
    }
}

function openWhatsApp() {
    const rawPhone = (document.getElementById('editContactPhone') as HTMLInputElement | null)?.value || '';
    const whatsappLink = buildWhatsappLinkFromPhone(rawPhone);
    if (whatsappLink) {
        window.open(whatsappLink, '_blank');
    }
}

function bulkSendMessage() {
    const bulkRecipients = document.getElementById('bulkRecipients') as HTMLElement | null;
    if (bulkRecipients) bulkRecipients.textContent = String(selectedContacts.length);
    openModal('bulkMessageModal');
}

async function sendBulkMessage() {
    const message = (document.getElementById('bulkMessage') as HTMLTextAreaElement | null)?.value.trim() || '';
    const delay = parseInt((document.getElementById('bulkDelay') as HTMLInputElement | null)?.value || '0', 10);

    if (!message) {
        showToast('error', 'Erro', 'Digite uma mensagem');
        return;
    }

    const hasConnectedSession = await hasConnectedSessionForContactsSend();
    if (!hasConnectedSession) {
        const statusMessage = contactsSessionFilter
            ? 'A conta selecionada nao esta conectada'
            : 'Nenhuma conta WhatsApp conectada para envio';
        showToast('error', 'Erro', statusMessage);
        return;
    }

    try {
        showLoading('Adicionando à fila...');
        
        const contacts = allContacts.filter(c => selectedContacts.includes(c.id));
        
        await api.post('/api/queue/bulk', {
            leadIds: selectedContacts,
            content: message,
            delay: delay
        });

        closeModal('bulkMessageModal');
        clearSelection();
        showToast('success', 'Sucesso', `${contacts.length} mensagens adicionadas à fila!`);
        hideLoading();
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Erro ao enviar');
    }
}

async function bulkDelete() {
    const uniqueLeadIds = Array.from(
        new Set(
            selectedContacts
                .map((value) => parseInt(String(value), 10))
                .filter((value) => Number.isInteger(value) && value > 0)
        )
    );

    if (uniqueLeadIds.length === 0) {
        showToast('warning', 'Atencao', 'Nenhum contato selecionado');
        return;
    }

    if (!confirm(`Excluir ${formatNumber(uniqueLeadIds.length)} contatos?`)) return;

    try {
        let deleted = 0;
        let skipped = 0;
        let failed = 0;

        for (let offset = 0; offset < uniqueLeadIds.length; offset += CONTACTS_BULK_DELETE_BATCH_SIZE) {
            const chunk = uniqueLeadIds.slice(offset, offset + CONTACTS_BULK_DELETE_BATCH_SIZE);
            const processed = Math.min(offset + chunk.length, uniqueLeadIds.length);
            showLoading(`Excluindo ${processed}/${uniqueLeadIds.length} contatos...`);

            try {
                const response: BulkLeadsDeleteResponse = await api.post('/api/leads/bulk-delete', { leadIds: chunk });
                deleted += Number(response?.deleted || 0);
                skipped += Number(response?.skipped || 0);
                failed += Number(response?.failed || 0);
            } catch (error) {
                failed += chunk.length;
            }
        }

        clearSelection();
        await loadContacts();

        const summary = [`${deleted} removidos`];
        if (skipped > 0) summary.push(`${skipped} ignorados`);
        if (failed > 0) summary.push(`${failed} com erro`);

        if (deleted === 0 && skipped === 0 && failed > 0) {
            showToast('error', 'Erro', `Falha na exclusao (${failed} com erro)`);
            return;
        }

        showToast(failed > 0 ? 'warning' : 'success', 'Sucesso', `Exclusao concluida: ${summary.join(', ')}`);
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Erro ao excluir');
    }
}

function bulkChangeStatus() {
    const status = prompt('Novo status (1=Novo, 2=Em Andamento, 3=Concluído, 4=Perdido):');
    if (!status || ![1,2,3,4].includes(parseInt(status))) return;
    
    // Implementar mudança em lote
    showToast('info', 'Info', 'Função em desenvolvimento');
}

function bulkAddTag() {
    showToast('info', 'Info', 'Função em desenvolvimento');
}

async function importContacts() {
    if (!contactFieldsCache.length) {
        await loadContactFields();
    }

    const fileInput = document.getElementById('importFile') as HTMLInputElement | null;
    const textInput = (document.getElementById('importText') as HTMLTextAreaElement | null)?.value.trim() || '';
    const status = parseInt((document.getElementById('importStatus') as HTMLSelectElement | null)?.value || '1', 10) as LeadStatus;
    const importTagValue = (document.getElementById('importTag') as HTMLSelectElement | null)?.value.trim() || '';
    const importTags = importTagValue ? [importTagValue] : [];

    let data: Array<Record<string, string>> = [];
    if (fileInput?.files && fileInput.files.length > 0) {
        const text = await fileInput.files[0].text();
        data = parseCSV(text);
    } else if (textInput) {
        data = parseCSV(textInput);
    }

    if (data.length === 0) {
        showToast('error', 'Erro', 'Nenhum dado válido');
        return;
    }

    const leadsToImport: Array<Record<string, any>> = [];
    for (const row of data) {
        const normalizedRow = buildNormalizedImportRow(row);
        const phone = getImportValue(normalizedRow, ['telefone', 'phone', 'whatsapp', 'celular', 'fone', 'numero']).replace(/\D/g, '');
        if (!phone) continue;

        const mergedTags = Array.from(new Set(importTags));
        const customFields: Record<string, string> = {};

        for (const field of customContactFieldsCache) {
            const aliases = [field.key, field.label || field.key];
            const value = getImportValue(normalizedRow, aliases);
            if (value) {
                customFields[normalizeContactFieldKey(field.key)] = value;
            }
        }

        const payload: Record<string, any> = {
            name: getImportValue(normalizedRow, ['nome', 'name', 'nome_completo', 'contato']) || 'Sem nome',
            phone,
            email: getImportValue(normalizedRow, ['email', 'e-mail', 'mail']),
            status,
            tags: mergedTags,
            source: 'import'
        };

        if (Object.keys(customFields).length > 0) {
            payload.custom_fields = customFields;
        }

        leadsToImport.push(payload);
    }

    if (leadsToImport.length === 0) {
        showToast('error', 'Erro', 'Nenhum contato valido para importar');
        return;
    }

    try {
        let imported = 0;
        let updated = 0;
        let insertConflicts = 0;
        let skipped = 0;
        let failed = 0;

        for (let offset = 0; offset < leadsToImport.length; offset += CONTACTS_IMPORT_BATCH_SIZE) {
            const chunk = leadsToImport.slice(offset, offset + CONTACTS_IMPORT_BATCH_SIZE);
            const processed = Math.min(offset + chunk.length, leadsToImport.length);
            showLoading(`Importando ${processed}/${leadsToImport.length} contatos...`);

            try {
                const response: BulkLeadsImportResponse = await api.post('/api/leads/bulk', { leads: chunk });
                imported += Number(response?.imported || 0);
                updated += Number(response?.updated || 0);
                insertConflicts += Number(response?.insertConflicts || 0);
                skipped += Number(response?.skipped || 0);
                failed += Number(response?.failed || 0);
            } catch (error) {
                failed += chunk.length;
            }
        }

        closeModal('importModal');
        const importTag = document.getElementById('importTag') as HTMLSelectElement | null;
        if (importTag) importTag.value = '';
        await loadContacts();

        if ((imported + updated) <= 0 && failed > 0) {
            showToast('error', 'Erro', `Falha na importação (${failed} com erro)`);
            return;
        }

        const summary = [`${imported} importados`];
        if (updated > 0) summary.push(`${updated} atualizados`);
        if (insertConflicts > 0) summary.push(`${insertConflicts} conflitos de insercao`);
        if (skipped > 0) summary.push(`${skipped} ignorados`);
        if (failed > 0) summary.push(`${failed} com erro`);
        showToast(failed > 0 ? 'warning' : 'success', 'Sucesso', `Importação concluída: ${summary.join(', ')}`);
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', 'Falha na importação');
    }
}

function exportContacts() {
    const data = filteredContacts.map(c => ({
        nome: c.name,
        telefone: c.phone,
        email: c.email,
        status: getStatusLabel(c.status)
    }));
    exportToCSV(data, `contatos_${formatDate(new Date(), 'short').replace(/\//g, '-')}.csv`);
    showToast('success', 'Sucesso', 'Contatos exportados!');
}

function switchTab(tab: string) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tab}"]`)?.classList.add('active');
    document.querySelector(`.tab-content[data-tab-content="${tab}"]`)?.classList.add('active');
}

function getStatusLabel(status: number) {
    return LEAD_STATUS[status]?.label || 'Desconhecido';
}

const windowAny = window as Window & {
    initContacts?: () => void;
    loadContacts?: () => void;
    changePage?: (delta: number) => void;
    changeContactsSessionFilter?: (sessionId: string) => void;
    filterContacts?: () => void;
    toggleSelectAll?: () => void;
    updateSelection?: () => void;
    clearSelection?: () => void;
    saveContact?: () => Promise<void>;
    editContact?: (id: number) => void;
    updateContact?: () => Promise<void>;
    deleteContact?: (id: number) => Promise<void>;
    quickMessage?: (id: number) => void;
    openWhatsApp?: () => void;
    bulkSendMessage?: () => void;
    sendBulkMessage?: () => Promise<void>;
    bulkDelete?: () => Promise<void>;
    bulkChangeStatus?: () => void;
    bulkAddTag?: () => void;
    importContacts?: () => Promise<void>;
    exportContacts?: () => void;
    switchTab?: (tab: string) => void;
    loadTemplate?: () => void;
};
windowAny.initContacts = initContacts;
windowAny.loadContacts = loadContacts;
windowAny.changePage = changePage;
windowAny.changeContactsSessionFilter = changeContactsSessionFilter;
windowAny.filterContacts = filterContacts;
windowAny.toggleSelectAll = toggleSelectAll;
windowAny.updateSelection = updateSelection;
windowAny.clearSelection = clearSelection;
windowAny.saveContact = saveContact;
windowAny.editContact = editContact;
windowAny.updateContact = updateContact;
windowAny.deleteContact = deleteContact;
windowAny.quickMessage = quickMessage;
windowAny.openWhatsApp = openWhatsApp;
windowAny.bulkSendMessage = bulkSendMessage;
windowAny.sendBulkMessage = sendBulkMessage;
windowAny.bulkDelete = bulkDelete;
windowAny.bulkChangeStatus = bulkChangeStatus;
windowAny.bulkAddTag = bulkAddTag;
windowAny.importContacts = importContacts;
windowAny.exportContacts = exportContacts;
windowAny.switchTab = switchTab;
windowAny.loadTemplate = loadTemplate;

export { initContacts };
