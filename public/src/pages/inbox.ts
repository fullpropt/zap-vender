// Inbox page logic migrated to module

declare const io:
    | undefined
    | ((url?: string, options?: Record<string, unknown>) => {
          on: (event: string, handler: (data?: any) => void) => void;
          emit: (event: string, payload?: any) => void;
      });

type LeadStatus = 1 | 2 | 3 | 4;

type Conversation = {
    id: number;
    leadId: number;
    sessionId?: string;
    sessionLabel?: string;
    name: string;
    phone: string;
    avatarUrl?: string;
    lastMessage?: string;
    lastMessageAt?: string;
    unread?: number;
    status?: LeadStatus;
};

type ChatMessage = {
    id: number | string;
    content: string;
    direction: 'outgoing' | 'incoming';
    status?: string;
    created_at: string;
    media_type?: string;
    media_url?: string;
    media_mime_type?: string;
    media_filename?: string;
};

type ConversationsResponse = { conversations?: Array<Record<string, any>> };
type MessagesResponse = { messages?: Array<Record<string, any>> };
type QuickRepliesResponse = { templates?: Array<Record<string, any>> };

type TemplateItem = {
    id: number;
    name: string;
    content: string;
    category?: string;
    media_type?: string;
    media_url?: string;
};

type LeadDetails = {
    id: number;
    name?: string;
    phone?: string;
    email?: string;
    avatar_url?: string;
    avatarUrl?: string;
    status?: LeadStatus | number | string;
    source?: string;
    tags?: string[] | string | null;
    created_at?: string;
    updated_at?: string;
    custom_fields?: string | Record<string, any> | null;
};

type ContactField = {
    key: string;
    label?: string;
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

let conversations: Conversation[] = [];
let currentConversation: Conversation | null = null;
let messages: ChatMessage[] = [];
let quickReplies: TemplateItem[] = [];
let socket: null | { on: (event: string, handler: (data?: any) => void) => void; emit: (event: string, payload?: any) => void } = null;
let socketBound = false;
let refreshInterval: number | null = null;
let currentFilter: 'all' | 'unread' = 'all';
let quickReplyDismissBound = false;
let currentLeadDetails: LeadDetails | null = null;
let contactFieldsCache: ContactField[] = [];
let isContactInfoOpen = false;
let inboxSessionFilter = '';
let inboxAvailableSessions: WhatsappSessionItem[] = [];
let mediaUploadInProgress = false;

const INBOX_SESSION_FILTER_STORAGE_KEY = 'zapvender_inbox_session_filter';

const DEFAULT_CONTACT_FIELDS: ContactField[] = [
    { key: 'nome', label: 'Nome', is_default: true, source: 'name' },
    { key: 'telefone', label: 'Telefone', is_default: true, source: 'phone' },
    { key: 'email', label: 'Email', is_default: true, source: 'email' }
];

function normalizeDirection(message: Record<string, any>): 'outgoing' | 'incoming' {
    const rawDirection = String(message.direction || '').trim().toLowerCase();
    if (['outgoing', 'sent', 'agent', 'bot', 'me', 'from_me'].includes(rawDirection)) return 'outgoing';
    if (['incoming', 'received', 'lead', 'contact', 'customer', 'from_them'].includes(rawDirection)) return 'incoming';

    const senderType = String(message.sender_type || '').trim().toLowerCase();
    if (['agent', 'bot', 'system'].includes(senderType)) return 'outgoing';
    if (['lead', 'contact', 'customer'].includes(senderType)) return 'incoming';

    const fromMe = message.is_from_me;
    if (fromMe === true || fromMe === 1 || fromMe === '1' || fromMe === 'true') return 'outgoing';
    if (fromMe === false || fromMe === 0 || fromMe === '0' || fromMe === 'false') return 'incoming';

    return 'incoming';
}

function escapeHtml(value: string) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizeName(value: string) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function normalizeContactFieldKey(value: string) {
    return normalizeName(value)
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);
}

function sanitizeSessionId(value: unknown, fallback = '') {
    const normalized = String(value || '').trim();
    return normalized || fallback;
}

function getStoredInboxSessionFilter() {
    return sanitizeSessionId(localStorage.getItem(INBOX_SESSION_FILTER_STORAGE_KEY));
}

function persistInboxSessionFilter(sessionId: string) {
    const normalized = sanitizeSessionId(sessionId);
    if (!normalized) {
        localStorage.removeItem(INBOX_SESSION_FILTER_STORAGE_KEY);
        return;
    }
    localStorage.setItem(INBOX_SESSION_FILTER_STORAGE_KEY, normalized);
}

function getSessionStatusLabel(session: WhatsappSessionItem) {
    const connected = Boolean(session.connected) || String(session.status || '').toLowerCase() === 'connected';
    return connected ? 'Conectada' : 'Desconectada';
}

function isInboxSessionConnected(session: WhatsappSessionItem) {
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

function findInboxSessionById(sessionId: string) {
    const normalized = sanitizeSessionId(sessionId);
    if (!normalized) return null;
    return inboxAvailableSessions.find((session) => sanitizeSessionId(session.session_id) === normalized) || null;
}

function upsertInboxSessionConnection(sessionId: string, connected: boolean) {
    const normalized = sanitizeSessionId(sessionId);
    if (!normalized) return;

    const index = inboxAvailableSessions.findIndex(
        (session) => sanitizeSessionId(session.session_id) === normalized
    );
    const nextStatus = connected ? 'connected' : 'disconnected';

    if (index >= 0) {
        const current = inboxAvailableSessions[index];
        inboxAvailableSessions[index] = {
            ...current,
            session_id: normalized,
            connected,
            status: nextStatus
        };
    } else {
        inboxAvailableSessions.push({
            session_id: normalized,
            connected,
            status: nextStatus
        });
    }

    renderInboxSessionFilterOptions();
}

async function ensureSessionConnected(sessionId: string) {
    const normalized = sanitizeSessionId(sessionId);
    if (!normalized) return false;

    const knownSession = findInboxSessionById(normalized);
    if (knownSession && isInboxSessionConnected(knownSession)) {
        return true;
    }

    try {
        const response = await api.get(`/api/whatsapp/status?sessionId=${encodeURIComponent(normalized)}`);
        const connected = Boolean(response?.connected);
        upsertInboxSessionConnection(normalized, connected);
        return connected;
    } catch (_) {
        // Avoid false warnings when status check fails momentarily.
        return true;
    }
}

function resolveConversationSessionLabel(sessionId: string) {
    const normalized = sanitizeSessionId(sessionId);
    if (!normalized) return '';

    const knownSession = findInboxSessionById(normalized);
    if (!knownSession) return normalized;

    const displayName = getSessionDisplayName(knownSession);
    return displayName || normalized;
}

function renderInboxSessionFilterOptions() {
    const select = document.getElementById('inboxSessionFilter') as HTMLSelectElement | null;
    if (!select) return;

    const options = [
        `<option value="">Todas as contas</option>`,
        ...inboxAvailableSessions.map((session) => {
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
    select.value = inboxSessionFilter;
    renderInboxSessionIndicator();
}

function renderInboxSessionIndicator() {
    const container = document.getElementById('inboxSessionIndicator') as HTMLElement | null;
    if (!container) return;

    const nameEl = container.querySelector('.inbox-session-highlight-name') as HTMLElement | null;
    const metaEl = container.querySelector('.inbox-session-highlight-meta') as HTMLElement | null;
    const statusEl = container.querySelector('.inbox-session-highlight-status') as HTMLElement | null;

    if (!inboxSessionFilter) {
        if (nameEl) nameEl.textContent = 'Todas as contas';
        if (metaEl) metaEl.textContent = 'Mostrando conversas de todas as contas';
        if (statusEl) {
            statusEl.textContent = 'Filtro geral';
            statusEl.className = 'inbox-session-highlight-status all';
        }
        return;
    }

    const selectedSession = findInboxSessionById(inboxSessionFilter);
    const sessionDisplayName = selectedSession ? getSessionDisplayName(selectedSession) : inboxSessionFilter;
    const sessionId = selectedSession ? sanitizeSessionId(selectedSession.session_id, inboxSessionFilter) : inboxSessionFilter;
    const connected = selectedSession ? isInboxSessionConnected(selectedSession) : false;
    const statusLabel = selectedSession ? getSessionStatusLabel(selectedSession) : 'Indisponível';

    if (nameEl) nameEl.textContent = sessionDisplayName;
    if (metaEl) {
        metaEl.textContent = selectedSession
            ? `${sessionId} • ${statusLabel}`
            : `${inboxSessionFilter} • Conta não encontrada na lista`;
    }
    if (statusEl) {
        statusEl.textContent = statusLabel;
        statusEl.className = `inbox-session-highlight-status ${connected ? 'connected' : 'disconnected'}`;
    }
}

async function loadInboxSessionFilters() {
    const storedFilter = getStoredInboxSessionFilter();
    inboxSessionFilter = sanitizeSessionId(storedFilter);

    try {
        const response = await api.get('/api/whatsapp/sessions?includeDisabled=true');
        inboxAvailableSessions = Array.isArray(response?.sessions) ? response.sessions : [];
    } catch (_) {
        inboxAvailableSessions = [];
    }

    const sessionIds = new Set(
        inboxAvailableSessions.map((item) => sanitizeSessionId(item.session_id)).filter(Boolean)
    );
    if (inboxSessionFilter && !sessionIds.has(inboxSessionFilter)) {
        inboxSessionFilter = '';
        persistInboxSessionFilter('');
    }

    renderInboxSessionFilterOptions();
}

function changeInboxSessionFilter(sessionId: string) {
    inboxSessionFilter = sanitizeSessionId(sessionId);
    persistInboxSessionFilter(inboxSessionFilter);
    renderInboxSessionIndicator();
    currentConversation = null;
    currentLeadDetails = null;
    renderContactInfoPanel();
    setMobileConversationMode(false);
    loadConversations();
}

function resolveConversationSessionId(conversation: Conversation | null | undefined) {
    const fromConversation = sanitizeSessionId(conversation?.sessionId);
    if (fromConversation) return fromConversation;
    const appSession = sanitizeSessionId((window as any).APP?.sessionId);
    if (appSession) return appSession;
    const storedSession = sanitizeSessionId(localStorage.getItem('zapvender_active_whatsapp_session'));
    if (storedSession) return storedSession;
    return 'default_whatsapp_session';
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

function sanitizeAvatarUrl(value: unknown) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (raw.startsWith('/uploads/')) return raw;
    return '';
}

function resolveConversationAvatarUrl(conversation: Conversation | null | undefined) {
    return sanitizeAvatarUrl(conversation?.avatarUrl);
}

function resolveLeadAvatarUrl(lead: LeadDetails | null, conversation: Conversation | null) {
    const direct = sanitizeAvatarUrl(lead?.avatar_url || lead?.avatarUrl);
    if (direct) return direct;

    const customFields = parseLeadCustomFields(lead?.custom_fields);
    const fromCustomFields = sanitizeAvatarUrl(customFields?.avatar_url || customFields?.avatarUrl);
    if (fromCustomFields) return fromCustomFields;

    return resolveConversationAvatarUrl(conversation);
}

function renderAvatarMarkup({
    name,
    avatarUrl,
    className,
    style = ''
}: {
    name: string;
    avatarUrl?: string | null;
    className: string;
    style?: string;
}) {
    const safeName = String(name || 'Contato').trim() || 'Contato';
    const safeAvatar = sanitizeAvatarUrl(avatarUrl);
    const styleParts = [`background: ${getAvatarColor(safeName)}`];
    if (style.trim()) {
        styleParts.push(style.trim().replace(/;+$/, ''));
    }
    const styleAttr = styleParts.join('; ');

    if (safeAvatar) {
        const fullAvatarUrl = escapeHtml(getMediaUrl(safeAvatar));
        return `
            <div class="${className} has-image" style="${styleAttr}">
                <img class="${className}-image" src="${fullAvatarUrl}" alt="${escapeHtml(safeName)}" loading="lazy" />
            </div>
        `;
    }

    return `
        <div class="${className}" style="${styleAttr}">
            ${getInitials(safeName)}
        </div>
    `;
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

function formatLeadStatus(status: unknown) {
    const normalized = Number(status);
    switch (normalized) {
        case 1:
            return 'Novo';
        case 2:
            return 'Em andamento';
        case 3:
            return 'Concluido';
        case 4:
            return 'Perdido';
        default:
            return 'Nao definido';
    }
}

function formatLeadSource(source: unknown) {
    const value = String(source || '').trim().toLowerCase();
    if (!value) return 'Nao definido';
    if (value === 'manual') return 'Manual';
    if (value === 'whatsapp') return 'WhatsApp';
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}


function getContatosUrl(id: string | number) {
    return `#/contatos?id=${id}`;
}

function initInbox() {
    bindQuickReplyDismiss();
    loadContactFields();
    void loadInboxSessionFilters().finally(() => {
        loadConversations();
    });
    loadQuickReplies();
    initSocket();
    renderContactInfoPanel();
    setMobileConversationMode(false);
    if (refreshInterval === null) {
        refreshInterval = window.setInterval(loadConversations, 10000);
    }
}

onReady(initInbox);

function isMobileInboxView() {
    return window.matchMedia('(max-width: 768px)').matches;
}

function isTabletOrMobileView() {
    return window.matchMedia('(max-width: 1024px)').matches;
}

function setMobileConversationMode(chatOpen: boolean) {
    const conversationsPanel = document.getElementById('conversationsPanel') as HTMLElement | null;
    const chatPanel = document.getElementById('chatPanel') as HTMLElement | null;
    if (!conversationsPanel || !chatPanel) return;

    if (!isMobileInboxView()) {
        conversationsPanel.classList.remove('hidden');
        chatPanel.classList.remove('active');
        return;
    }

    if (chatOpen) {
        conversationsPanel.classList.add('hidden');
        chatPanel.classList.add('active');
    } else {
        conversationsPanel.classList.remove('hidden');
        chatPanel.classList.remove('active');
    }
}

function setContactInfoPanelState(forceOpen?: boolean) {
    const panel = document.getElementById('inboxRightPanel') as HTMLElement | null;
    const backdrop = document.getElementById('contactInfoBackdrop') as HTMLElement | null;
    if (!panel || !backdrop) return;

    const nextState = typeof forceOpen === 'boolean' ? forceOpen : !isContactInfoOpen;
    isContactInfoOpen = nextState;
    panel.classList.toggle('active', isContactInfoOpen);
    backdrop.classList.toggle('active', isContactInfoOpen);
}

function closeContactInfoPanel() {
    setContactInfoPanelState(false);
}

function buildLeadInfoRows() {
    const lead = currentLeadDetails;
    const conversation = currentConversation;
    const customFields = parseLeadCustomFields(lead?.custom_fields);
    const fields = contactFieldsCache.length ? contactFieldsCache : DEFAULT_CONTACT_FIELDS;

    const rows: Array<{ label: string; value: string }> = [];
    for (const field of fields) {
        const normalizedKey = normalizeContactFieldKey(field.key);
        if (!normalizedKey) continue;

        let value = '';
        if (field.source === 'name' || normalizedKey === 'nome') {
            value = String(lead?.name || conversation?.name || '').trim();
        } else if (field.source === 'phone' || normalizedKey === 'telefone') {
            value = formatPhone(String(lead?.phone || conversation?.phone || '').trim());
        } else if (field.source === 'email' || normalizedKey === 'email') {
            value = String(lead?.email || '').trim();
        } else {
            const byNormalizedKey = customFields[normalizedKey];
            const byOriginalKey = customFields[field.key];
            const resolved = byNormalizedKey !== undefined ? byNormalizedKey : byOriginalKey;
            value = resolved === undefined || resolved === null ? '' : String(resolved).trim();
        }

        if (!value) continue;
        rows.push({
            label: field.label || field.key,
            value
        });
    }

    return rows;
}

function renderContactInfoPanel() {
    const container = document.getElementById('inboxRightContent') as HTMLElement | null;
    if (!container) return;
    container.classList.remove('ready');

    if (!currentConversation) {
        closeContactInfoPanel();
        container.innerHTML = `
            <div class="contact-card-empty">
                <span class="inbox-right-panel-robot icon icon-user icon-lg"></span>
                <p><strong>Selecione uma conversa</strong></p>
                <p>Abra um chat para visualizar os dados do contato aqui.</p>
            </div>
        `;
        return;
    }

    if (!currentLeadDetails?.id) {
        container.innerHTML = `
            <div class="contact-card-empty">
                <span class="inbox-right-panel-robot icon icon-automation icon-lg"></span>
                <p><strong>Este cliente ainda nao esta cadastrado na sua audiencia.</strong></p>
                <p>Cadastre para liberar o cartao completo e os campos dinamicos.</p>
                <button class="btn-register-user" onclick="registerCurrentUser()">
                    Cadastrar contato
                </button>
            </div>
        `;
        return;
    }

    container.classList.add('ready');

    const lead = currentLeadDetails;
    const rows = buildLeadInfoRows();
    const tags = parseLeadTags(lead.tags);
    const rowsHtml = rows.length
        ? rows
            .map(
                (row) => `
                    <div class="contact-info-row">
                        <span class="contact-info-label">${escapeHtml(row.label)}</span>
                        <span class="contact-info-value">${escapeHtml(row.value)}</span>
                    </div>
                `
            )
            .join('')
        : `<p class="contact-card-muted">Nenhum campo preenchido para este contato.</p>`;

    const tagsHtml = tags.length
        ? tags.map((tag) => `<span class="contact-tag-chip">${escapeHtml(tag)}</span>`).join('')
        : `<span class="contact-card-muted">Sem etiquetas</span>`;

    const createdAt = lead.created_at ? formatDate(lead.created_at, 'datetime') : '';
    const headerName = escapeHtml(String(lead.name || currentConversation.name || 'Contato').trim() || 'Contato');
    const contactAvatarMarkup = renderAvatarMarkup({
        name: lead.name || currentConversation.name || 'Contato',
        avatarUrl: resolveLeadAvatarUrl(lead, currentConversation),
        className: 'contact-card-avatar'
    });

    container.innerHTML = `
        <div class="contact-card">
            <div class="contact-card-header">
                ${contactAvatarMarkup}
                <div>
                    <div class="contact-card-title">${headerName}</div>
                    <div class="contact-card-subtitle">${escapeHtml(formatPhone(lead.phone || currentConversation.phone || ''))}</div>
                </div>
            </div>

            <div class="contact-info-grid">
                <div class="contact-info-row">
                    <span class="contact-info-label">Status</span>
                    <span class="contact-info-value">${escapeHtml(formatLeadStatus(lead.status))}</span>
                </div>
                <div class="contact-info-row">
                    <span class="contact-info-label">Origem</span>
                    <span class="contact-info-value">${escapeHtml(formatLeadSource(lead.source))}</span>
                </div>
                ${createdAt ? `
                    <div class="contact-info-row">
                        <span class="contact-info-label">Criado em</span>
                        <span class="contact-info-value">${escapeHtml(createdAt)}</span>
                    </div>
                ` : ''}
            </div>

            <div class="contact-card-section">
                <div class="contact-card-section-title">Dados do contato</div>
                ${rowsHtml}
            </div>

            <div class="contact-card-section">
                <div class="contact-card-section-title">Etiquetas</div>
                <div class="contact-tag-list">${tagsHtml}</div>
            </div>

            <div class="contact-card-actions">
                <button class="btn btn-outline btn-sm" onclick="openWhatsApp()">Abrir no WhatsApp</button>
                <button class="btn btn-primary btn-sm" onclick="viewContact()">Abrir contato</button>
            </div>
        </div>
    `;
}

function bindQuickReplyDismiss() {
    if (quickReplyDismissBound) return;
    quickReplyDismissBound = true;

    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        const picker = document.getElementById('quickReplyPicker') as HTMLElement | null;
        if (!picker || !picker.classList.contains('open')) return;
        if (target?.closest('.quick-reply-toolbar')) return;
        closeQuickReplyPicker();
    });
}

function initSocket() {
    try {
        const win = window as Window & { APP?: { socket?: any; socketUrl?: string } };
        const appSocket = win.APP?.socket;
        if (appSocket) {
            socket = appSocket;
        } else if (io) {
            const token = sessionStorage.getItem('selfDashboardToken');
            const socketOptions: {
                transports: string[];
                reconnection: boolean;
                reconnectionAttempts: number;
                reconnectionDelay: number;
                auth?: { token: string };
            } = {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 2000
            };
            if (token) socketOptions.auth = { token };
            socket = io(win.APP?.socketUrl, socketOptions);
        } else {
            console.log('Socket não disponível');
            return;
        }

        if (!socket || socketBound) return;
        socketBound = true;
        
        socket.on('new-message', (data) => {
            const incomingConversationId = Number(data?.conversationId || 0);
            const incomingLeadId = Number(data?.leadId || 0);
            const incomingSessionId = sanitizeSessionId(data?.sessionId || data?.session_id || '');
            const isCurrent =
                currentConversation &&
                (
                    (incomingConversationId > 0 && incomingConversationId === Number(currentConversation.id))
                    || (
                        incomingLeadId > 0
                        && incomingLeadId === Number(currentConversation.leadId)
                        && incomingSessionId
                        && incomingSessionId === resolveConversationSessionId(currentConversation)
                    )
                );
            if (isCurrent) {
                const mediaType = String(data.mediaType || data.media_type || 'text');
                const mediaUrl = data.mediaUrl || data.media_url || null;
                const mediaMimeType = data.mediaMimeType || data.media_mime_type || null;
                const mediaFilename = data.mediaFilename || data.media_filename || null;
                messages.push({
                    id: data.id || Date.now(),
                    content: data.text || '',
                    direction: data.isFromMe ? 'outgoing' : 'incoming',
                    status: data.status || (data.isFromMe ? 'sent' : 'received'),
                    created_at: new Date(data.timestamp || Date.now()).toISOString(),
                    media_type: mediaType,
                    media_url: mediaUrl,
                    media_mime_type: mediaMimeType,
                    media_filename: mediaFilename
                });
                const chatMessages = document.getElementById('chatMessages') as HTMLElement | null;
                renderMessagesInto(chatMessages);
                scrollToBottom();
            }
            loadConversations();
        });

        socket.on('message-status', (data) => {
            const status = String(data?.status || '').trim();
            const messageId = String(data?.messageId || '').trim();
            if (!status || !messageId) return;

            let changed = false;
            messages = messages.map((message) => {
                const raw = message as Record<string, any>;
                const candidateIds = [
                    String(raw.message_id || ''),
                    String(raw.messageId || ''),
                    String(message.id || '')
                ].filter(Boolean);

                if (!candidateIds.includes(messageId)) {
                    return message;
                }

                changed = true;
                return {
                    ...message,
                    status
                };
            });

            if (changed) {
                renderMessagesInto(document.getElementById('chatMessages') as HTMLElement | null);
            }
        });
    } catch (e) {
        console.log('Socket não disponível');
    }
}

async function loadConversations() {
    try {
        const query = inboxSessionFilter
            ? `?session_id=${encodeURIComponent(inboxSessionFilter)}`
            : '';
        const response: ConversationsResponse = await api.get(`/api/conversations${query}`);
        const items = response.conversations || [];
        conversations = items.map((c) => ({
            sessionId: sanitizeSessionId(c.session_id || c.sessionId),
            id: c.id,
            leadId: c.lead_id || c.leadId || c.id,
            sessionLabel: resolveConversationSessionLabel(sanitizeSessionId(c.session_id || c.sessionId)),
            name: c.name || c.lead_name || c.phone,
            phone: c.phone,
            avatarUrl: sanitizeAvatarUrl(c.avatar_url || c.avatarUrl),
            lastMessage: c.lastMessage || c.last_message || 'Clique para iniciar conversa',
            lastMessageAt: c.lastMessageAt || c.last_message_at || c.updated_at || c.created_at,
            unread: c.unread || c.unread_count || 0,
            status: c.status
        }));

        if (currentConversation) {
            const refreshedConversation = conversations.find((conversation) => conversation.id === currentConversation?.id) || null;
            if (!refreshedConversation) {
                currentConversation = null;
                currentLeadDetails = null;
                const chatPanel = document.getElementById('chatPanel') as HTMLElement | null;
                if (chatPanel) {
                    chatPanel.innerHTML = `
                        <div class="chat-empty">
                            <div class="chat-empty-icon icon icon-empty icon-lg"></div>
                            <h3>Nenhum chat selecionado</h3>
                            <p>Selecione uma conversa da lista ao lado para começar a conversar</p>
                        </div>
                    `;
                }
                renderContactInfoPanel();
                setMobileConversationMode(false);
            } else {
                currentConversation = refreshedConversation;
            }
        }

        if (currentFilter === 'unread') {
            renderFilteredConversations(conversations.filter((conversation) => (conversation.unread || 0) > 0));
        } else {
            renderConversations();
        }
        updateUnreadBadge();
    } catch (error) {
        console.error(error);
        showToast('error', 'Erro', 'Não foi possível carregar as conversas');
    }
}

function renderConversations() {
    const list = document.getElementById('conversationsList') as HTMLElement | null;
    if (!list) return;
    
    if (conversations.length === 0) {
        list.innerHTML = `
            <div class="empty-state" style="padding: 40px;">
                <div class="empty-state-icon icon icon-empty icon-lg"></div>
                <p>Nenhuma conversa</p>
            </div>
        `;
        return;
    }

    list.innerHTML = conversations.map(c => `
        <div class="conversation-item ${c.unread > 0 ? 'unread' : ''} ${currentConversation?.id === c.id ? 'active' : ''}" 
             onclick="selectConversation(${c.id})">
            ${renderAvatarMarkup({
                name: c.name,
                avatarUrl: resolveConversationAvatarUrl(c),
                className: 'conversation-avatar'
            })}
            <div class="conversation-info">
                <div class="conversation-name-row">
                    <div class="conversation-name">${escapeHtml(c.name || 'Sem nome')}</div>
                    ${c.sessionLabel ? `<span class="conversation-session-chip" title="${escapeHtml(c.sessionId || '')}">${escapeHtml(c.sessionLabel)}</span>` : ''}
                </div>
                <div class="conversation-preview">${escapeHtml(c.lastMessage || 'Sem mensagens')}</div>
            </div>
            <div class="conversation-meta">
                <div class="conversation-time">${c.lastMessageAt ? timeAgo(c.lastMessageAt) : ''}</div>
                ${c.unread > 0 ? `<div class="conversation-badge">${c.unread}</div>` : ''}
            </div>
        </div>
    `).join('');
}

function filterConversations(filter: 'all' | 'unread') {
    currentFilter = filter;
    document.querySelectorAll('.conversations-tabs button').forEach((button) => button.classList.remove('active'));
    document.getElementById('filterAllBtn')?.classList.toggle('active', filter === 'all');
    document.getElementById('filterUnreadBtn')?.classList.toggle('active', filter === 'unread');
    
    if (filter === 'unread') {
        const filtered = conversations.filter(c => c.unread > 0);
        renderFilteredConversations(filtered);
    } else {
        renderConversations();
    }
}

function renderFilteredConversations(filtered: Conversation[]) {
    const list = document.getElementById('conversationsList') as HTMLElement | null;
    if (!list) return;
    if (filtered.length === 0) {
        list.innerHTML = `<div class="empty-state" style="padding: 40px;"><p>Nenhuma conversa encontrada</p></div>`;
        return;
    }
    // Usar mesma lógica de renderConversations
    list.innerHTML = filtered.map(c => `
        <div class="conversation-item ${c.unread > 0 ? 'unread' : ''}" onclick="selectConversation(${c.id})">
            ${renderAvatarMarkup({
                name: c.name,
                avatarUrl: resolveConversationAvatarUrl(c),
                className: 'conversation-avatar'
            })}
            <div class="conversation-info">
                <div class="conversation-name-row">
                    <div class="conversation-name">${escapeHtml(c.name || 'Sem nome')}</div>
                    ${c.sessionLabel ? `<span class="conversation-session-chip" title="${escapeHtml(c.sessionId || '')}">${escapeHtml(c.sessionLabel)}</span>` : ''}
                </div>
                <div class="conversation-preview">${escapeHtml(c.lastMessage || '')}</div>
            </div>
            <div class="conversation-meta">
                <div class="conversation-time">${c.lastMessageAt ? timeAgo(c.lastMessageAt) : ''}</div>
                ${c.unread > 0 ? `<div class="conversation-badge">${c.unread}</div>` : ''}
            </div>
        </div>
    `).join('');
}

function searchConversations() {
    const search = (document.getElementById('searchConversations') as HTMLInputElement | null)?.value.toLowerCase() || '';
    const filtered = conversations.filter(c => 
        (c.name && c.name.toLowerCase().includes(search)) ||
        (c.phone && c.phone.includes(search))
    );
    renderFilteredConversations(filtered);
}

async function selectConversation(id: number) {
    currentConversation = conversations.find(c => c.id === id);
    if (!currentConversation) return;
    currentLeadDetails = null;

    // Marcar localmente como lida para atualizar badge imediatamente
    if ((currentConversation.unread || 0) > 0) {
        currentConversation.unread = 0;
        conversations = conversations.map((c) => (c.id === id ? { ...c, unread: 0 } : c));
        if (currentFilter === 'unread') {
            renderFilteredConversations(conversations.filter((c) => (c.unread || 0) > 0));
        } else {
            renderConversations();
        }
        updateUnreadBadge();
    }

    // Marcar como ativo
    document.querySelectorAll('.conversation-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`.conversation-item[onclick="selectConversation(${id})"]`)?.classList.add('active');

    // Persistir no backend que a conversa foi lida
    try {
        const conversationSessionId = resolveConversationSessionId(currentConversation);
        socket?.emit('mark-read', {
            sessionId: conversationSessionId,
            conversationId: id
        });
        await api.post(`/api/conversations/${id}/read`, {});
    } catch {
        // Não bloqueia abertura da conversa se falhar sincronização de leitura
    }

    // Carregar mensagens e dados completos do contato
    const conversationSessionId = resolveConversationSessionId(currentConversation);
    await Promise.all([
        loadMessages(currentConversation.leadId, currentConversation.id, conversationSessionId, currentConversation.phone),
        loadCurrentLeadDetails(currentConversation.leadId)
    ]);

    // Renderizar chat
    renderChat();
    renderContactInfoPanel();
    setMobileConversationMode(true);
    if (isTabletOrMobileView()) {
        closeContactInfoPanel();
    }
}

async function loadMessages(leadId: number, conversationId?: number, sessionId?: string, contactJid?: string) {
    try {
        const params = new URLSearchParams();
        const normalizedConversationId = Number(conversationId);
        if (Number.isFinite(normalizedConversationId) && normalizedConversationId > 0) {
            params.set('conversation_id', String(normalizedConversationId));
        }
        const normalizedSessionId = sanitizeSessionId(sessionId);
        if (normalizedSessionId) {
            params.set('session_id', normalizedSessionId);
        }
        const normalizedContactJid = sanitizeSessionId(contactJid);
        if (normalizedContactJid) {
            params.set('contact_jid', normalizedContactJid);
        }

        const query = params.toString() ? `?${params.toString()}` : '';
        const response: MessagesResponse = await api.get(`/api/messages/${leadId}${query}`);
        messages = (response.messages || []).map(m => ({
            ...m,
            direction: normalizeDirection(m),
            created_at: m.created_at || m.sent_at || new Date().toISOString(),
            media_type: m.media_type || 'text',
            media_url: m.media_url || null,
            media_mime_type: m.media_mime_type || null,
            media_filename: m.media_filename || null
        }));
    } catch (error) {
        messages = [];
    }
}

async function loadContactFields() {
    try {
        const response = await api.get('/api/contact-fields');
        const fields = Array.isArray(response?.fields) ? response.fields : [];

        contactFieldsCache = fields.length
            ? fields
                .map((field: ContactField) => ({
                    key: normalizeContactFieldKey(field.key),
                    label: field.label || field.key,
                    is_default: Boolean(field.is_default),
                    source: field.source
                }))
                .filter((field: ContactField) => Boolean(field.key))
            : [...DEFAULT_CONTACT_FIELDS];
    } catch (error) {
        contactFieldsCache = [...DEFAULT_CONTACT_FIELDS];
    }
    renderContactInfoPanel();
}

async function loadCurrentLeadDetails(leadId: number) {
    currentLeadDetails = null;
    if (!leadId) {
        renderContactInfoPanel();
        return;
    }
    try {
        const response = await api.get(`/api/leads/${leadId}`);
        currentLeadDetails = response?.lead || null;
    } catch (error) {
        currentLeadDetails = null;
    }
    renderContactInfoPanel();
}

async function loadQuickReplies() {
    try {
        const response: QuickRepliesResponse = await api.get('/api/templates');
        quickReplies = (response.templates || [])
            .filter((item) => {
                const category = normalizeName(item.category || 'custom');
                return category === 'quick_reply' || category === 'custom' || category === '';
            })
            .map((item) => ({
                id: item.id,
                name: item.name,
                content: item.content || '',
                category: item.category,
                media_type: item.media_type,
                media_url: item.media_url
            }));
    } catch (error) {
        quickReplies = [];
    }
}

function renderQuickReplyItems() {
    if (!quickReplies.length) {
        return `<div class="quick-reply-empty">Nenhuma resposta r&aacute;pida cadastrada</div>`;
    }

    return quickReplies
        .map((item) => {
            const isAudio = item.media_type === 'audio';
            const label = isAudio ? `${item.name} (áudio)` : item.name;
            return `<button class="quick-reply-option" onclick="selectQuickReply(${item.id})">${escapeHtml(label)}</button>`;
        })
        .join('');
}

function applyQuickReplyVariables(content: string) {
    if (!currentConversation) return content;

    const customFields = parseLeadCustomFields(currentLeadDetails?.custom_fields);
    const variables: Record<string, string> = {
        nome: currentLeadDetails?.name || currentConversation.name || '',
        telefone: formatPhone(currentLeadDetails?.phone || currentConversation.phone || ''),
        email: currentLeadDetails?.email || '',
        empresa: 'ZapVender'
    };

    const fields = contactFieldsCache.length ? contactFieldsCache : DEFAULT_CONTACT_FIELDS;
    for (const field of fields) {
        const key = normalizeContactFieldKey(field.key);
        if (!key || variables[key]) continue;
        const value = customFields[key];
        variables[key] = value === undefined || value === null ? '' : String(value);
    }

    return String(content || '').replace(/\{\{\s*([\w-]+)\s*\}\}/gi, (match, rawKey) => {
        const key = normalizeContactFieldKey(String(rawKey || ''));
        if (!key) return '';
        return Object.prototype.hasOwnProperty.call(variables, key) ? (variables[key] || '') : '';
    });
}

function toggleQuickReplyPicker() {
    const picker = document.getElementById('quickReplyPicker') as HTMLElement | null;
    if (!picker) return;
    picker.classList.toggle('open');
}

function closeQuickReplyPicker() {
    const picker = document.getElementById('quickReplyPicker') as HTMLElement | null;
    if (!picker) return;
    picker.classList.remove('open');
}

function selectQuickReply(id: number) {
    const input = document.getElementById('messageInput') as HTMLTextAreaElement | null;
    if (!input) return;

    const selectedReply = quickReplies.find((item) => item.id === id);
    if (!selectedReply) return;

    closeQuickReplyPicker();

    if (selectedReply.media_type === 'audio') {
        sendQuickReplyAudio(selectedReply);
        return;
    }

    const text = applyQuickReplyVariables(selectedReply.content || '');
    input.value = text;
    input.focus();
}

async function sendQuickReplyAudio(quickReply: TemplateItem) {
    if (!currentConversation) return;
    if (!quickReply.media_url) {
        showToast('warning', 'Aviso', 'Resposta rapida de audio sem arquivo');
        return;
    }
    const mediaUrl = quickReply.media_url;

    const newMessage: ChatMessage = {
        id: Date.now(),
        content: '[audio]',
        direction: 'outgoing',
        status: 'pending',
        created_at: new Date().toISOString(),
        media_type: 'audio',
        media_url: mediaUrl
    };
    messages.push(newMessage);

    const chatMessages = document.getElementById('chatMessages') as HTMLElement | null;
    renderMessagesInto(chatMessages);
    scrollToBottom();

    try {
        const sessionId = resolveConversationSessionId(currentConversation);
        const response = await api.post('/api/send', {
            sessionId,
            to: currentConversation.phone,
            message: mediaUrl,
            type: 'audio',
            options: { url: mediaUrl }
        });
        if (response?.messageId) {
            (newMessage as Record<string, any>).message_id = String(response.messageId);
        }
        newMessage.status = 'sent';
        renderMessagesInto(chatMessages);
    } catch (error) {
        newMessage.status = 'failed';
        renderMessagesInto(chatMessages);
        showToast('error', 'Erro', 'Nao foi possivel enviar o audio');
    }
}

function getMediaUrl(url?: string | null) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const base = (window as any).APP?.socketUrl || '';
    return `${base}${url}`;
}

function normalizeMessageStatus(status?: string) {
    const normalized = String(status || 'sent').trim().toLowerCase();
    if (['read', 'lida'].includes(normalized)) return 'read';
    if (['delivered', 'entregue'].includes(normalized)) return 'delivered';
    if (['failed', 'error', 'erro'].includes(normalized)) return 'failed';
    if (['pending', 'queued', 'enviando'].includes(normalized)) return 'pending';
    return 'sent';
}

function renderMessageStatus(status?: string) {
    const normalized = normalizeMessageStatus(status);
    if (normalized === 'failed') {
        return `<span class="message-status is-failed" title="Falha no envio">!</span>`;
    }

    const isDouble = normalized === 'delivered' || normalized === 'read';
    const isRead = normalized === 'read';
    const label = isRead
        ? 'Lida'
        : (normalized === 'delivered' ? 'Entregue' : (normalized === 'pending' ? 'Enviando' : 'Enviada'));

    return `
        <span class="message-status ${isDouble ? 'is-double' : 'is-single'} ${isRead ? 'is-read' : ''}" title="${label}">
            <span class="tick tick-1">✓</span>
            ${isDouble ? `<span class="tick tick-2">✓</span>` : ''}
        </span>
    `;
}

function isMediaPreviewText(value?: string | null) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return true;
    return [
        '[imagem]',
        '[video]',
        '[audio]',
        '[documento]',
        '[sticker]',
        '[contato]',
        '[localizacao]',
        '[mensagem]'
    ].includes(normalized);
}

function resolveDocumentLabel(message: ChatMessage) {
    const explicit = String(message.media_filename || '').trim();
    if (explicit) return explicit;

    const rawUrl = String(message.media_url || '').trim();
    if (rawUrl) {
        try {
            const pathname = rawUrl.startsWith('http')
                ? new URL(rawUrl).pathname
                : rawUrl;
            const candidate = decodeURIComponent(pathname.split('/').pop() || '').trim();
            if (candidate) return candidate;
        } catch (error) {
            const fallback = rawUrl.split('/').pop() || '';
            if (fallback) return fallback;
        }
    }

    return 'documento';
}

function renderMessageContent(message: ChatMessage) {
    const mediaType = String(message.media_type || 'text').toLowerCase();
    const mediaUrl = getMediaUrl(message.media_url);
    const text = String(message.content || '');
    const hasReadableText = Boolean(text.trim()) && !isMediaPreviewText(text);
    const safeText = escapeHtml(text);

    if (mediaType === 'image' && mediaUrl) {
        const safeUrl = escapeHtml(mediaUrl);
        return `
            <div class="message-media">
                <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">
                    <img class="message-media-image" src="${safeUrl}" alt="Imagem recebida" loading="lazy" />
                </a>
            </div>
            ${hasReadableText ? `<div class="message-caption">${safeText}</div>` : ''}
        `;
    }

    if (mediaType === 'audio' && mediaUrl) {
        const safeUrl = escapeHtml(mediaUrl);
        return `
            <div class="message-media message-media-audio-wrap">
                <audio controls preload="metadata" class="message-media-audio" src="${safeUrl}"></audio>
                <a class="message-media-download" href="${safeUrl}" target="_blank" rel="noopener noreferrer" download>Baixar audio</a>
            </div>
            ${hasReadableText ? `<div class="message-caption">${safeText}</div>` : ''}
        `;
    }

    if (mediaType === 'video' && mediaUrl) {
        const safeUrl = escapeHtml(mediaUrl);
        return `
            <div class="message-media">
                <video controls preload="metadata" class="message-media-video" src="${safeUrl}"></video>
            </div>
            ${hasReadableText ? `<div class="message-caption">${safeText}</div>` : ''}
        `;
    }

    if (mediaType === 'document' && mediaUrl) {
        const safeUrl = escapeHtml(mediaUrl);
        const docLabel = escapeHtml(resolveDocumentLabel(message));
        return `
            <div class="message-media">
                <a class="message-document-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer" download>
                    <span class="icon icon-attachment icon-sm"></span>
                    <span>${docLabel}</span>
                </a>
            </div>
            ${hasReadableText ? `<div class="message-caption">${safeText}</div>` : ''}
        `;
    }

    return `<div class="message-text">${safeText}</div>`;
}

function detectOutgoingMediaType(file: File): 'image' | 'video' | 'audio' | 'document' {
    const mime = String(file?.type || '').toLowerCase();
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return 'document';
}

function getAuthToken() {
    return sessionStorage.getItem('selfDashboardToken') || '';
}

async function uploadMediaFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: formData
    });

    const data = await response.json();
    if (!response.ok || !data?.success || !data?.file?.url) {
        throw new Error(data?.error || 'Falha ao enviar arquivo');
    }
    return data.file as {
        url: string;
        mimetype?: string;
        originalname?: string;
        filename?: string;
    };
}

function triggerMediaPicker() {
    if (!currentConversation) {
        showToast('info', 'Info', 'Selecione uma conversa primeiro');
        return;
    }
    const input = document.getElementById('chatMediaInput') as HTMLInputElement | null;
    if (!input) return;
    input.click();
}

async function handleMediaInputChange(event: Event) {
    const target = event.target as HTMLInputElement | null;
    const file = target?.files?.[0];
    if (!target) return;

    try {
        const activeConversation = currentConversation;
        if (!file || !activeConversation) return;
        if (mediaUploadInProgress) {
            showToast('warning', 'Aviso', 'Aguarde o envio atual terminar');
            return;
        }
        const sessionId = resolveConversationSessionId(activeConversation);
        const sessionConnected = await ensureSessionConnected(sessionId);
        if (!sessionConnected) {
            showToast('warning', 'Aviso', 'WhatsApp nao esta conectado');
            return;
        }

        mediaUploadInProgress = true;
        const mediaType = detectOutgoingMediaType(file);
        const uploadedFile = await uploadMediaFile(file);
        const mediaUrl = String(uploadedFile.url || '').trim();
        if (!mediaUrl) {
            throw new Error('Arquivo enviado sem URL');
        }

        const input = document.getElementById('messageInput') as HTMLTextAreaElement | null;
        const caption = (mediaType === 'image' || mediaType === 'video' || mediaType === 'document')
            ? String(input?.value || '').trim()
            : '';

        const tempMessage: ChatMessage = {
            id: `temp-media-${Date.now()}`,
            content: caption || `[${mediaType}]`,
            direction: 'outgoing',
            status: 'pending',
            created_at: new Date().toISOString(),
            media_type: mediaType,
            media_url: mediaUrl,
            media_mime_type: uploadedFile.mimetype || file.type || null,
            media_filename: uploadedFile.originalname || file.name || null
        };

        messages.push(tempMessage);
        const chatMessages = document.getElementById('chatMessages') as HTMLElement | null;
        renderMessagesInto(chatMessages);
        scrollToBottom();

        const response = await api.post('/api/send', {
            sessionId,
            to: activeConversation.phone,
            message: mediaUrl,
            type: mediaType,
            options: {
                url: mediaUrl,
                mimetype: uploadedFile.mimetype || file.type || '',
                fileName: uploadedFile.originalname || file.name || 'arquivo',
                caption,
                ptt: false
            }
        });
        if (response?.messageId) {
            (tempMessage as Record<string, any>).message_id = String(response.messageId);
        }

        tempMessage.status = 'sent';
        renderMessagesInto(chatMessages);
        if (caption && input) {
            input.value = '';
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Nao foi possivel enviar o arquivo';
        showToast('error', 'Erro', message);
    } finally {
        mediaUploadInProgress = false;
        target.value = '';
    }
}

function renderChat() {
    const panel = document.getElementById('chatPanel') as HTMLElement | null;
    if (!panel || !currentConversation) return;

    const quickReplyItems = renderQuickReplyItems();

    panel.innerHTML = `
        <div class="chat-header">
            <button class="btn btn-sm btn-outline btn-icon chat-back-btn" onclick="backToList()" id="backBtn" title="Voltar para lista">
                <span class="icon icon-arrow-left icon-sm"></span>
            </button>
            ${renderAvatarMarkup({
                name: currentConversation.name,
                avatarUrl: resolveLeadAvatarUrl(currentLeadDetails, currentConversation),
                className: 'conversation-avatar',
                style: 'width: 40px; height: 40px; font-size: 14px;'
            })}
            <div class="chat-header-info">
                <div class="chat-header-name">${escapeHtml(currentConversation.name || 'Sem nome')}</div>
                <div class="chat-header-status">${formatPhone(currentConversation.phone)}</div>
            </div>
            <div class="chat-header-actions">
                <button class="btn btn-sm btn-outline btn-icon" onclick="openWhatsApp()" title="Abrir no WhatsApp"><span class="icon icon-whatsapp icon-sm"></span></button>
                <button class="btn btn-sm btn-outline btn-icon" onclick="toggleContactInfo(true)" title="Dados do contato"><span class="icon icon-user icon-sm"></span></button>
            </div>
        </div>

        <div class="chat-messages" id="chatMessages">
            <div class="chat-messages-stack">
                ${renderMessages()}
            </div>
        </div>

        <div class="quick-reply-toolbar">
            <button class="btn btn-sm btn-outline quick-reply-trigger" onclick="toggleQuickReplyPicker()" title="Selecionar resposta rapida">
                <span class="icon icon-bolt icon-sm"></span> Respostas rapidas
            </button>
            <div class="quick-reply-picker" id="quickReplyPicker">
                ${quickReplyItems}
            </div>
        </div>

        <div class="chat-input">
            <input id="chatMediaInput" type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onchange="handleMediaInputChange(event)" style="display:none" />
            <button class="chat-input-btn chat-attach-btn" onclick="triggerMediaPicker()" title="Anexar arquivo">
                <span class="icon icon-attachment icon-sm"></span>
            </button>
            <textarea id="messageInput" placeholder="Digite uma mensagem..." rows="1" onkeydown="handleKeyDown(event)"></textarea>
            <button class="chat-input-btn chat-send-btn" onclick="sendMessage()" title="Enviar"><span class="icon icon-send icon-sm"></span></button>
        </div>
    `;

    setMobileConversationMode(true);
    closeContactInfoPanel();
    scrollToBottom();
}
function renderMessages() {
    if (messages.length === 0) {
        return `
            <div style="text-align: center; padding: 40px; color: var(--gray-500);">
                <p>Nenhuma mensagem ainda</p>
                <p style="font-size: 12px;">Envie uma mensagem para iniciar a conversa</p>
            </div>
        `;
    }

    return messages.map(m => {
        const contentHtml = renderMessageContent(m);

        return `
        <div class="message ${m.direction === 'outgoing' ? 'sent' : 'received'} ${m.media_type && m.media_type !== 'text' ? `media-${m.media_type}` : ''}">
            <div class="message-content">${contentHtml}</div>
            <div class="message-time">
                ${formatDate(m.created_at, 'time')}
                ${m.direction === 'outgoing' ? renderMessageStatus(m.status) : ''}
            </div>
        </div>
    `;
    }).join('');
}

function renderMessagesInto(container: HTMLElement | null) {
    if (!container) return;
    container.innerHTML = `<div class="chat-messages-stack">${renderMessages()}</div>`;
}

function scrollToBottom() {
    const container = document.getElementById('chatMessages') as HTMLElement | null;
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function sendMessage() {
    const input = document.getElementById('messageInput') as HTMLTextAreaElement | null;
    const content = input?.value.trim() || '';
    
    const activeConversation = currentConversation;
    if (!content || !activeConversation) return;

    const sessionId = resolveConversationSessionId(activeConversation);
    const sessionConnected = await ensureSessionConnected(sessionId);
    if (!sessionConnected) {
        showToast('warning', 'Aviso', 'WhatsApp nao esta conectado');
        return;
    }


    // Adicionar mensagem localmente
    const newMessage: ChatMessage = {
        id: Date.now(),
        content,
        direction: 'outgoing',
        status: 'pending',
        created_at: new Date().toISOString()
    };
    messages.push(newMessage);
    
    // Atualizar UI
    const chatMessages = document.getElementById('chatMessages') as HTMLElement | null;
    renderMessagesInto(chatMessages);
    scrollToBottom();
    if (input) input.value = '';

    try {
        const response = await api.post('/api/send', {
            sessionId,
            to: activeConversation.phone,
            message: content,
            type: 'text'
        });
        if (response?.messageId) {
            (newMessage as Record<string, any>).message_id = String(response.messageId);
        }
        
        newMessage.status = 'sent';
        renderMessagesInto(chatMessages);
    } catch (error) {
        newMessage.status = 'failed';
        renderMessagesInto(chatMessages);
        showToast('error', 'Erro', 'Não foi possível enviar a mensagem');
    }
}

function openWhatsApp() {
    if (currentConversation?.phone) {
        const digits = String(currentConversation.phone || '').replace(/\D/g, '');
        const normalized = digits.startsWith('55') ? digits : `55${digits}`;
        window.open(`https://wa.me/${normalized}`, '_blank');
    }
}

function viewContact() {
    if (currentConversation) {
        window.location.href = getContatosUrl(currentConversation.leadId);
    }
}

function toggleContactInfo(forceOpen?: boolean) {
    if (forceOpen === false) {
        closeContactInfoPanel();
        return;
    }

    if (!currentConversation) {
        showToast('info', 'Info', 'Selecione uma conversa primeiro');
        return;
    }

    renderContactInfoPanel();
    if (!isTabletOrMobileView()) return;
    setContactInfoPanelState(forceOpen);
}

async function registerCurrentUser() {
    if (!currentConversation) return;
    try {
        showLoading('Cadastrando usuario...');
        await api.post('/api/leads', {
            name: currentConversation.name || 'Contato',
            phone: currentConversation.phone,
            status: 1
        });

        hideLoading();
        showToast('success', 'Sucesso', 'Contato cadastrado com sucesso');

        await loadConversations();
        const refreshedConversation =
            conversations.find((conversation) => conversation.id === currentConversation?.id) ||
            conversations.find((conversation) => conversation.phone === currentConversation?.phone) ||
            null;
        if (refreshedConversation) {
            currentConversation = refreshedConversation;
            await loadCurrentLeadDetails(refreshedConversation.leadId);
        } else {
            renderContactInfoPanel();
        }
        closeContactInfoPanel();
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', 'Nao foi possivel cadastrar o contato');
    }
}

function backToList() {
    setMobileConversationMode(false);
    closeContactInfoPanel();
}
function updateUnreadBadge() {
    const unread = conversations.reduce((sum, c) => sum + (c.unread || 0), 0);
    const badge = document.getElementById('unreadBadge') as HTMLElement | null;
    if (!badge) return;
    if (unread > 0) {
        badge.textContent = String(unread);
        badge.style.display = 'inline';
    } else {
        badge.style.display = 'none';
    }
}

// Atualizar conversas a cada 10 segundos (iniciado em initInbox)

const windowAny = window as Window & {
    initInbox?: () => void;
    filterConversations?: (filter: 'all' | 'unread') => void;
    searchConversations?: () => void;
    changeInboxSessionFilter?: (sessionId: string) => void;
    selectConversation?: (id: number) => Promise<void>;
    toggleQuickReplyPicker?: () => void;
    closeQuickReplyPicker?: () => void;
    selectQuickReply?: (id: number) => void;
    handleKeyDown?: (event: KeyboardEvent) => void;
    sendMessage?: () => Promise<void>;
    triggerMediaPicker?: () => void;
    handleMediaInputChange?: (event: Event) => Promise<void>;
    openWhatsApp?: () => void;
    viewContact?: () => void;
    toggleContactInfo?: (forceOpen?: boolean) => void;
    registerCurrentUser?: () => Promise<void>;
    backToList?: () => void;
    logout?: () => void;
};
windowAny.initInbox = initInbox;
windowAny.filterConversations = filterConversations;
windowAny.searchConversations = searchConversations;
windowAny.changeInboxSessionFilter = changeInboxSessionFilter;
windowAny.registerCurrentUser = registerCurrentUser;
windowAny.logout = logout;
windowAny.selectConversation = selectConversation;
windowAny.toggleQuickReplyPicker = toggleQuickReplyPicker;
windowAny.closeQuickReplyPicker = closeQuickReplyPicker;
windowAny.selectQuickReply = selectQuickReply;
windowAny.handleKeyDown = handleKeyDown;
windowAny.sendMessage = sendMessage;
windowAny.triggerMediaPicker = triggerMediaPicker;
windowAny.handleMediaInputChange = handleMediaInputChange;
windowAny.openWhatsApp = openWhatsApp;
windowAny.viewContact = viewContact;
windowAny.toggleContactInfo = toggleContactInfo;
windowAny.backToList = backToList;

export { initInbox };
