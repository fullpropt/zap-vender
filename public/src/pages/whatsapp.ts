// WhatsApp page logic migrated to module

declare const io:
    | undefined
    | ((url: string, options?: Record<string, unknown>) => {
          on: (event: string, handler: (data?: any) => void) => void;
          emit: (event: string, payload?: any) => void;
          connect?: () => void;
          connected?: boolean;
          io?: { opts?: { transports?: unknown } };
      });
declare const api:
    | undefined
    | {
          get: (endpoint: string) => Promise<any>;
          post?: (endpoint: string, body?: any) => Promise<any>;
          delete?: (endpoint: string) => Promise<any>;
      };

type WhatsappSessionItem = {
    session_id: string;
    connected?: boolean;
    status?: string;
    name?: string;
    phone?: string;
    campaign_enabled?: boolean | number;
};

type PlanUsageMetricPayload = {
    current?: number;
    max?: number | null;
    unlimited?: boolean;
};

type PlanStatusApiPayload = {
    plan?: {
        name?: string;
        limits?: {
            whatsapp_sessions?: PlanUsageMetricPayload;
        };
    };
};

// ConfiguraÃ§Ãµes
const CONFIG = {
    SOCKET_URL: window.location.origin,
    DEFAULT_SESSION_ID: 'default_whatsapp_session',
    QR_REFRESH_INTERVAL: 30000
};
const LEGACY_DEFAULT_SESSION_ID = 'self_whatsapp_session';
const QR_IDLE_PLACEHOLDER_TEXT = 'Clique no bot&atilde;o abaixo para gerar QR Code de acesso';

// Estado
let socket: null | {
    on: (event: string, handler: (data?: any) => void) => void;
    emit: (event: string, payload?: any) => void;
    connect?: () => void;
    connected?: boolean;
    io?: { opts?: { transports?: unknown } };
} = null;
let socketBound = false;
let currentSessionId = CONFIG.DEFAULT_SESSION_ID;
let preferredDefaultSessionId = CONFIG.DEFAULT_SESSION_ID;
let availableSessions: WhatsappSessionItem[] = [];
let isConnected = false;
let isConnecting = false;
let qrTimer: number | null = null;
let timerCountdown = 30;
let pairingCodeHideTimer: number | null = null;
let pairingCodeVisible = false;
let lastPairingCode = '';
let qrGenerationWatchdog: number | null = null;
const reconnectUiRequestedSessionIds = new Set<string>();
const numberFormatter = new Intl.NumberFormat('pt-BR');
let whatsappPlanUsageState = {
    loaded: false,
    planName: 'Plano',
    current: 0,
    max: null as number | null,
    unlimited: true
};

function appConfirm(message: string, title = 'Confirmação') {
    const win = window as Window & { showAppConfirm?: (message: string, title?: string) => Promise<boolean> };
    if (typeof win.showAppConfirm === 'function') {
        return win.showAppConfirm(message, title);
    }
    return Promise.resolve(window.confirm(message));
}

function appPrompt(message: string, options: { title?: string; defaultValue?: string; placeholder?: string; confirmLabel?: string; cancelLabel?: string } = {}) {
    const win = window as Window & {
        showAppPrompt?: (
            message: string,
            options?: { title?: string; defaultValue?: string; placeholder?: string; confirmLabel?: string; cancelLabel?: string }
        ) => Promise<string | null>;
    };
    if (typeof win.showAppPrompt === 'function') {
        return win.showAppPrompt(message, options);
    }
    return Promise.resolve(window.prompt(message, options.defaultValue || ''));
}

function clearQrGenerationWatchdog() {
    if (qrGenerationWatchdog) {
        clearTimeout(qrGenerationWatchdog);
        qrGenerationWatchdog = null;
    }
}

function resetPendingConnection(message: string) {
    isConnecting = false;
    clearQrGenerationWatchdog();
    updateConnectButton(false);
    updatePairingButton(false);
    if (!pairingCodeVisible) {
        showQRLoading(message);
    }
}

function renderWhatsappPlanUsage() {
    const container = document.getElementById('whatsapp-plan-usage') as HTMLElement | null;
    if (!container) return;

    if (!whatsappPlanUsageState.loaded) {
        container.textContent = 'Carregando limite do plano...';
        return;
    }

    const planName = String(whatsappPlanUsageState.planName || 'Plano').trim() || 'Plano';
    const normalizedPlanToken = planName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const planTone = normalizedPlanToken.includes('monster')
        ? 'monster'
        : normalizedPlanToken.includes('avancad') || normalizedPlanToken.includes('advanced')
            ? 'advanced'
            : normalizedPlanToken.includes('premium')
                ? 'premium'
                : normalizedPlanToken.includes('starter')
                    ? 'starter'
                    : 'default';
    const usageText = whatsappPlanUsageState.unlimited || whatsappPlanUsageState.max === null
        ? `${numberFormatter.format(whatsappPlanUsageState.current)} conexoes em uso - sem limite`
        : `${numberFormatter.format(whatsappPlanUsageState.current)} de ${numberFormatter.format(whatsappPlanUsageState.max)} conexoes em uso`;
    const remainingText = whatsappPlanUsageState.unlimited || whatsappPlanUsageState.max === null
        ? 'Voce pode adicionar novas contas sem restricao de plano.'
        : whatsappPlanUsageState.current >= whatsappPlanUsageState.max
            ? 'Limite de conexoes atingido para este plano.'
            : `Restam ${numberFormatter.format(Math.max(whatsappPlanUsageState.max - whatsappPlanUsageState.current, 0))} conexoes disponiveis.`;

    container.innerHTML = `
        <div class="whatsapp-plan-panel whatsapp-plan-panel--${escapeHtml(planTone)}">
            <span class="whatsapp-plan-label">Plano atual</span>
            <strong class="whatsapp-plan-name">${escapeHtml(planName)}</strong>
            <span class="whatsapp-plan-copy">${escapeHtml(usageText)}</span>
            <span class="whatsapp-plan-hint">${escapeHtml(remainingText)}</span>
        </div>
    `;
}

function updateWhatsappPlanUsageCurrent(current: number) {
    whatsappPlanUsageState.current = Math.max(0, Number(current || 0) || 0);
    renderWhatsappPlanUsage();
}

async function loadWhatsappPlanUsage() {
    try {
        if (!api?.get) throw new Error('API indisponível');
        const response = await api.get('/api/plan/status') as PlanStatusApiPayload;
        const metric = response?.plan?.limits?.whatsapp_sessions;
        const rawMax = metric?.max;
        const hasFiniteMax = rawMax !== null && typeof rawMax !== 'undefined' && Number.isInteger(Number(rawMax)) && Number(rawMax) >= 0;
        whatsappPlanUsageState = {
            loaded: true,
            planName: String(response?.plan?.name || 'Plano').trim() || 'Plano',
            current: Math.max(0, Number(metric?.current || whatsappPlanUsageState.current || 0) || 0),
            max: hasFiniteMax ? Math.floor(Number(rawMax)) : null,
            unlimited: metric?.unlimited === true || rawMax === null || typeof rawMax === 'undefined'
        };
    } catch (_) {
        whatsappPlanUsageState.loaded = true;
    }
    renderWhatsappPlanUsage();
}

// InicializaÃ§Ã£o
function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}


function getLoginUrl() {
    return '#/login';
}

function getPostLogoutUrl() {
    return '#/planos';
}

function normalizePairingPhoneInput(value: string) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';

    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
        return `55${digits}`;
    }

    return digits;
}

function sanitizeSessionId(value: string | null | undefined, fallback = '') {
    const normalized = String(value || '').trim();
    return normalized || fallback;
}

function escapeHtml(value: string) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getDefaultSessionId() {
    return sanitizeSessionId(preferredDefaultSessionId, CONFIG.DEFAULT_SESSION_ID);
}

function normalizeSessionToken(value: string) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function getOwnerUserIdFromSessionToken() {
    const token = String(sessionStorage.getItem('selfDashboardToken') || '').trim();
    if (!token) return 0;

    try {
        const parts = token.split('.');
        if (parts.length < 2) return 0;
        const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payloadBase64 + '='.repeat((4 - (payloadBase64.length % 4)) % 4);
        const payload = JSON.parse(atob(padded));
        const ownerUserId = Number(payload?.owner_user_id || payload?.id || 0);
        return Number.isFinite(ownerUserId) && ownerUserId > 0 ? Math.floor(ownerUserId) : 0;
    } catch (_) {
        return 0;
    }
}

function buildOwnerFallbackSessionId(ownerUserId: unknown, fallback = CONFIG.DEFAULT_SESSION_ID) {
    const parsedOwnerUserId = Number(ownerUserId || 0);
    if (!Number.isFinite(parsedOwnerUserId) || parsedOwnerUserId <= 0) {
        return fallback;
    }
    return `owner_${Math.floor(parsedOwnerUserId)}_session`;
}

function buildCompanyDefaultSessionId(companyName: unknown, ownerUserId: unknown = 0) {
    const normalized = normalizeSessionToken(String(companyName || ''));
    if (!normalized) return buildOwnerFallbackSessionId(ownerUserId, CONFIG.DEFAULT_SESSION_ID);
    if (normalized.endsWith('_session')) return normalized;
    return `${normalized}_session`;
}

async function resolvePreferredDefaultSessionId() {
    const ownerUserId = getOwnerUserIdFromSessionToken();
    preferredDefaultSessionId = buildOwnerFallbackSessionId(ownerUserId, CONFIG.DEFAULT_SESSION_ID);
    try {
        if (!api?.get) throw new Error('API indisponível');
        const response = await api.get('/api/settings');
        preferredDefaultSessionId = buildCompanyDefaultSessionId(response?.settings?.company_name, ownerUserId);
    } catch (_) {
        preferredDefaultSessionId = buildOwnerFallbackSessionId(ownerUserId, CONFIG.DEFAULT_SESSION_ID);
    }
}

function getStoredSessionId() {
    return sanitizeSessionId(localStorage.getItem('zapvender_active_whatsapp_session'), getDefaultSessionId());
}

function persistCurrentSessionId(sessionId: string) {
    localStorage.setItem('zapvender_active_whatsapp_session', sessionId);
}

function getCurrentSessionId() {
    return sanitizeSessionId(currentSessionId, getDefaultSessionId());
}

function getSessionSelectElement() {
    return document.getElementById('whatsapp-session-select') as HTMLSelectElement | null;
}

function getSessionListElement() {
    return document.getElementById('whatsapp-session-list') as HTMLElement | null;
}

function getConnectionIdleStateElement() {
    return document.getElementById('connection-idle-state') as HTMLElement | null;
}

function markReconnectUiRequested(sessionId: string) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId) return;
    reconnectUiRequestedSessionIds.add(normalizedSessionId);
}

function unmarkReconnectUiRequested(sessionId: string) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId) return;
    reconnectUiRequestedSessionIds.delete(normalizedSessionId);
}

function shouldShowReconnectUiForSession(sessionId: string) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId) return false;
    return reconnectUiRequestedSessionIds.has(normalizedSessionId);
}

function syncConnectionSectionVisibility() {
    const disconnected = document.getElementById('disconnected-state') as HTMLElement | null;
    const connected = document.getElementById('connected-state') as HTMLElement | null;
    const idleState = getConnectionIdleStateElement();
    const showDetailsForCurrentSession = shouldShowReconnectUiForSession(getCurrentSessionId());

    if (!showDetailsForCurrentSession) {
        if (connected) connected.style.display = 'none';
        if (disconnected) disconnected.style.display = 'none';
        if (idleState) idleState.style.display = 'block';
        return;
    }

    if (isConnected) {
        if (connected) connected.style.display = 'block';
        if (disconnected) disconnected.style.display = 'none';
        if (idleState) idleState.style.display = 'none';
        return;
    }

    if (connected) connected.style.display = 'none';
    if (disconnected) disconnected.style.display = 'block';
    if (idleState) idleState.style.display = 'none';
}

function syncCurrentSessionFromSelect() {
    const select = getSessionSelectElement();
    if (!select) return getCurrentSessionId();

    const selectedSessionId = sanitizeSessionId(select.value);
    if (!selectedSessionId) return getCurrentSessionId();

    if (currentSessionId !== selectedSessionId) {
        currentSessionId = selectedSessionId;
        persistCurrentSessionId(selectedSessionId);
        syncGlobalAppSessionId(selectedSessionId);
    }
    return selectedSessionId;
}

function syncGlobalAppSessionId(sessionId: string) {
    const app = (window as Window & { APP?: { sessionId?: string } }).APP;
    if (app) {
        app.sessionId = sessionId;
    }
}

function isPayloadForCurrentSession(payload: any) {
    const payloadSessionId = sanitizeSessionId(payload?.sessionId);
    if (!payloadSessionId) return true;
    return payloadSessionId === getCurrentSessionId();
}

function isConnectedSession(session: WhatsappSessionItem) {
    return Boolean(session.connected) || String(session.status || '').toLowerCase() === 'connected';
}

function getSessionStatusLabel(session: WhatsappSessionItem) {
    return isConnectedSession(session) ? 'Conectada' : 'Desconectada';
}

function getSessionDisplayName(session: WhatsappSessionItem) {
    const sessionId = sanitizeSessionId(session.session_id);
    const name = String(session.name || '').trim();
    if (name) return name;
    const phone = String(session.phone || '').trim();
    if (phone) return phone;
    return sessionId;
}

function getSuggestedNewSessionId() {
    const used = new Set(
        (availableSessions || [])
            .map((item) => sanitizeSessionId(item.session_id))
            .filter(Boolean)
    );

    const base = getDefaultSessionId();
    if (!used.has(base)) return base;

    let counter = 2;
    while (counter < 100) {
        const candidate = `${base}_${counter}`;
        if (!used.has(candidate)) return candidate;
        counter += 1;
    }
    return `${base}_${Date.now()}`;
}

function renderSessionList(sessions: WhatsappSessionItem[], currentId: string) {
    const list = getSessionListElement();
    if (!list) return;

    if (!Array.isArray(sessions) || sessions.length === 0) {
        list.innerHTML = '<div class="whatsapp-session-list-empty">Nenhuma conta disponível.</div>';
        return;
    }

    list.innerHTML = sessions.map((session) => {
        const sessionId = sanitizeSessionId(session.session_id);
        const displayName = getSessionDisplayName(session);
        const statusLabel = getSessionStatusLabel(session);
        const statusClass = isConnectedSession(session) ? 'connected' : 'disconnected';
        const isActive = sessionId === currentId;
        const isExpanded = shouldShowReconnectUiForSession(sessionId);
        const detail = displayName === sessionId ? statusLabel : sessionId;

        return `
            <button
                type="button"
                class="whatsapp-session-list-item${isActive ? ' is-active' : ''}"
                data-session-id="${escapeHtml(sessionId)}"
                title="Mostrar ou ocultar detalhes da conta ${escapeHtml(displayName)}"
                aria-expanded="${isExpanded ? 'true' : 'false'}"
            >
                <span class="whatsapp-session-list-main">
                    <span class="whatsapp-session-list-name">${escapeHtml(displayName)}</span>
                    <span class="whatsapp-session-list-meta">
                        <span class="whatsapp-session-list-status ${statusClass}">${escapeHtml(statusLabel)}</span>
                        <span class="whatsapp-session-list-arrow${isExpanded ? ' is-expanded' : ''}" aria-hidden="true">&#9662;</span>
                    </span>
                </span>
                <span class="whatsapp-session-list-detail">${escapeHtml(detail)}</span>
            </button>
        `;
    }).join('');

    const buttons = list.querySelectorAll<HTMLButtonElement>('.whatsapp-session-list-item[data-session-id]');
    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            const nextSessionId = sanitizeSessionId(button.dataset.sessionId);
            if (!nextSessionId) return;
            if (nextSessionId === getCurrentSessionId()) {
                const isExpanded = shouldShowReconnectUiForSession(nextSessionId);
                if (isExpanded) {
                    unmarkReconnectUiRequested(nextSessionId);
                    syncConnectionSectionVisibility();
                } else {
                    markReconnectUiRequested(nextSessionId);
                    if (!isConnected) {
                        resetConnectionUi();
                    } else {
                        syncConnectionSectionVisibility();
                    }
                    socket?.emit('check-session', { sessionId: nextSessionId });
                }
                renderSessionOptions();
                return;
            }
            changeSession(nextSessionId, { revealReconnectUi: true });
        });
    });
}

function renderSessionOptions() {
    const select = getSessionSelectElement();

    const sessions = Array.isArray(availableSessions) ? [...availableSessions] : [];
    const uniqueSessions: WhatsappSessionItem[] = [];
    const seenSessionIds = new Set<string>();

    for (const session of sessions) {
        const normalizedSessionId = sanitizeSessionId(session.session_id);
        if (!normalizedSessionId || seenSessionIds.has(normalizedSessionId)) continue;
        seenSessionIds.add(normalizedSessionId);
        uniqueSessions.push({
            ...session,
            session_id: normalizedSessionId
        });
    }

    uniqueSessions.sort((a, b) => {
        const byConnected = Number(isConnectedSession(b)) - Number(isConnectedSession(a));
        if (byConnected !== 0) return byConnected;
        const aLabel = getSessionDisplayName(a);
        const bLabel = getSessionDisplayName(b);
        return aLabel.localeCompare(bLabel);
    });
    availableSessions = uniqueSessions;

    if (select) {
        select.innerHTML = uniqueSessions.map((session) => {
            const status = getSessionStatusLabel(session);
            const labelBase = getSessionDisplayName(session);
            const sessionId = sanitizeSessionId(session.session_id);
            const label = labelBase === sessionId
                ? `${labelBase} - ${status}`
                : `${labelBase} - ${sessionId} - ${status}`;
            return `<option value="${escapeHtml(sessionId)}">${escapeHtml(label)}</option>`;
        }).join('');
    }

    let currentId = getCurrentSessionId();
    const hasCurrent = uniqueSessions.some((session) => sanitizeSessionId(session.session_id) === currentId);
    if (!hasCurrent && uniqueSessions.length) {
        currentId = sanitizeSessionId(uniqueSessions[0].session_id, getDefaultSessionId());
        currentSessionId = currentId;
        persistCurrentSessionId(currentId);
        syncGlobalAppSessionId(currentId);
    }

    if (select) {
        select.value = currentId;
    }
    renderSessionList(uniqueSessions, currentId);
    syncConnectionSectionVisibility();
}

async function loadSessionOptions(preferredSessionId?: string) {
    const fallbackSessionId = sanitizeSessionId(preferredSessionId, getCurrentSessionId());
    try {
        if (!api?.get) throw new Error('API indisponível');
        const response = await api.get('/api/whatsapp/sessions?includeDisabled=true');
        availableSessions = Array.isArray(response?.sessions) ? response.sessions : [];
        updateWhatsappPlanUsageCurrent(availableSessions.length);
    } catch (error) {
        availableSessions = [];
        updateWhatsappPlanUsageCurrent(0);
    }

    const availableSessionIds = new Set(
        (availableSessions || [])
            .map((session) => sanitizeSessionId(session?.session_id))
            .filter(Boolean)
    );

    const storedSessionId = getStoredSessionId();
    const candidates = [
        fallbackSessionId,
        storedSessionId,
        getCurrentSessionId(),
        getDefaultSessionId(),
        CONFIG.DEFAULT_SESSION_ID,
        LEGACY_DEFAULT_SESSION_ID
    ];
    let nextSessionId = candidates.find((candidate) => {
        const normalizedCandidate = sanitizeSessionId(candidate);
        if (!normalizedCandidate) return false;
        if (!availableSessionIds.size) return true;
        return availableSessionIds.has(normalizedCandidate);
    });

    if (!nextSessionId) {
        nextSessionId = sanitizeSessionId(availableSessions[0]?.session_id, getDefaultSessionId());
    }

    currentSessionId = sanitizeSessionId(nextSessionId, getDefaultSessionId());
    persistCurrentSessionId(currentSessionId);
    syncGlobalAppSessionId(currentSessionId);
    renderSessionOptions();
}

function resetConnectionUi() {
    isConnected = false;
    isConnecting = false;
    if (qrTimer) clearInterval(qrTimer);
    hidePairingCode();
    updateConnectButton(false);
    updatePairingButton(false);
    updateStatus('disconnected', 'Desconectado');

    const connectBtn = document.getElementById('connect-btn') as HTMLElement | null;
    const qrTimerEl = document.getElementById('qr-timer') as HTMLElement | null;
    if (connectBtn) connectBtn.style.display = 'flex';
    if (qrTimerEl) qrTimerEl.style.display = 'none';

    if (shouldShowReconnectUiForSession(getCurrentSessionId())) {
        showQRLoading('Aguardando conexão...');
    }
    syncConnectionSectionVisibility();
}

function changeSession(sessionId: string, options: { revealReconnectUi?: boolean } = {}) {
    const normalizedSessionId = sanitizeSessionId(sessionId, getDefaultSessionId());
    if (options.revealReconnectUi) {
        markReconnectUiRequested(normalizedSessionId);
    }
    currentSessionId = normalizedSessionId;
    persistCurrentSessionId(normalizedSessionId);
    syncGlobalAppSessionId(normalizedSessionId);
    renderSessionOptions();
    resetConnectionUi();
    socket?.emit('check-session', { sessionId: normalizedSessionId });
}

async function createSessionPrompt() {
    const suggestedSessionId = getSuggestedNewSessionId();
    const rawInput = await appPrompt(
        'Informe o identificador da nova conta WhatsApp (ex: vendas_sp_session):',
        {
            title: 'Nova conta WhatsApp',
            defaultValue: suggestedSessionId,
            placeholder: 'ex.: vendas_sp_session',
            confirmLabel: 'Criar'
        }
    );
    if (rawInput === null) return;

    const normalized = sanitizeSessionId(rawInput)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    if (!normalized) {
        showToast('warning', 'Identificador da conta inválido');
        return;
    }

    const alreadyExists = availableSessions.some((session) => sanitizeSessionId(session.session_id) === normalized);
    if (!alreadyExists) {
        availableSessions.push({
            session_id: normalized,
            status: 'disconnected',
            connected: false
        });
    }

    changeSession(normalized, { revealReconnectUi: true });
    showToast('info', `Conta selecionada: ${normalized}`);
}

// Inicializa??o
function initWhatsapp() {
    if (!checkAuth()) return;

    void (async () => {
        await resolvePreferredDefaultSessionId();
        currentSessionId = getStoredSessionId();
        syncGlobalAppSessionId(currentSessionId);
        renderSessionOptions();
        renderWhatsappPlanUsage();
        initSocket();
        bindPairingCodeCopy();
        void loadWhatsappPlanUsage();
        await loadSessionOptions(currentSessionId);
    })();
}

onReady(initWhatsapp);

function checkAuth() {
    const token = sessionStorage.getItem('selfDashboardToken');
    const expiry = sessionStorage.getItem('selfDashboardExpiry');
    if (!token || !expiry || Date.now() > parseInt(expiry)) {
        window.location.href = getLoginUrl();
        return false;
    }
    return true;
}

// Inicializar Socket.IO
function initSocket() {
    const win = window as Window & {
        APP?: {
            socket?: {
                on: (event: string, handler: (data?: any) => void) => void;
                emit: (event: string, payload?: any) => void;
                io?: { opts?: { transports?: unknown } };
            };
        };
    };

    const sharedSocket = win.APP?.socket;
    const sharedTransports = Array.isArray(sharedSocket?.io?.opts?.transports)
        ? (sharedSocket?.io?.opts?.transports as string[])
        : [];
    const sharedSupportsPolling = sharedTransports.includes('polling');

    if (sharedSocket && sharedSupportsPolling) {
        socket = sharedSocket;
    }
    console.log('ðŸ”Œ Conectando ao servidor:', CONFIG.SOCKET_URL);

    const token = sessionStorage.getItem('selfDashboardToken');
    const socketOptions: {
        transports: string[];
        reconnection: boolean;
        reconnectionAttempts: number;
        reconnectionDelay: number;
        timeout: number;
        tryAllTransports?: boolean;
        upgrade?: boolean;
        auth?: { token: string };
    } = {
        // Forca polling para evitar falhas de WSS em ambientes com proxy/rede restritiva.
        transports: ['polling'],
        tryAllTransports: false,
        upgrade: false,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 20000
    };

    if (token) {
        socketOptions.auth = { token };
    }
    if (!socket) {
        if (!io) {
            console.warn('Socket.IO não carregado');
            return;
        }
        socket = io(CONFIG.SOCKET_URL, socketOptions);
        if (win.APP) {
            win.APP.socket = socket;
        }
    }

    if (socketBound) return;
    socketBound = true;

    socket.on('connect', function() {
        console.log('âœ… Socket conectado');
        showToast('success', 'Conectado ao servidor');
        
        // Verificar sessÃ£o existente
        socket.emit('check-session', { sessionId: getCurrentSessionId() });
        void loadSessionOptions(getCurrentSessionId());
    });
    
    socket.on('disconnect', function() {
        console.log('âŒ Socket desconectado');
        showToast('warning', 'ConexÃ£o com servidor perdida');
    });
    
    socket.on('connect_error', function(error) {
        console.error('âŒ Erro de conexÃ£o:', error);
        showToast('error', 'Erro ao conectar com servidor');
        if (isConnecting) {
            resetPendingConnection('Falha ao conectar com servidor. Tente novamente.');
        }
    });
    
    // Eventos do WhatsApp
    socket.on('session-status', function(data) {
        if (!isPayloadForCurrentSession(data)) return;
        console.log('ðŸ“± Status da sessÃ£o:', data);
        const normalizedStatus = String(data?.status || '').trim().toLowerCase();
        if (normalizedStatus === 'connected') {
            handleConnected(data.user);
            return;
        }
        if (normalizedStatus === 'connecting' || normalizedStatus === 'reconnecting' || normalizedStatus === 'qr' || normalizedStatus === 'qr_pending') {
            isConnected = false;
            isConnecting = true;
            updateStatus('connecting', normalizedStatus === 'reconnecting' ? 'Reconectando...' : 'Conectando...');
            updateConnectButton(true);
            if (!pairingCodeVisible) {
                showQRLoading(normalizedStatus === 'reconnecting' ? 'Reconectando sessão...' : 'Gerando QR Code...');
            }
            return;
        }
        handleDisconnected();
    });
    
    socket.on('qr', function(data) {
        if (!isPayloadForCurrentSession(data)) return;
        console.log('ðŸ“· QR Code recebido');
        clearQrGenerationWatchdog();
        displayQRCode(data.qr);
        startQRTimer();
        // Garantir que o botÃ£o de conectar suma e o timer apareÃ§a
        const connectBtn = document.getElementById('connect-btn') as HTMLElement | null;
        const qrTimerEl = document.getElementById('qr-timer') as HTMLElement | null;
        if (connectBtn) connectBtn.style.display = 'none';
        if (qrTimerEl) qrTimerEl.style.display = 'block';
        updatePairingButton(false);
    });

    socket.on('pairing-code', function(data) {
        if (!isPayloadForCurrentSession(data)) return;
        console.log('Pairing code recebido');
        clearQrGenerationWatchdog();
        displayPairingCode(data?.code || '', data?.phoneNumber || data?.phone || '');
        isConnecting = false;
        updateConnectButton(false);
        updatePairingButton(false);
        showToast('success', 'Codigo de pareamento gerado com sucesso');
    });
    
    socket.on('connecting', function(data) {
        if (!isPayloadForCurrentSession(data)) return;
        console.log('ðŸ”„ Conectando...');
        updateStatus('connecting', 'Conectando...');
        showQRLoading('Conectando ao WhatsApp...');
    });

    socket.on('reconnecting', function(data) {
        if (!isPayloadForCurrentSession(data)) return;
        updateStatus('connecting', 'Reconectando...');
        showQRLoading('Reconectando sessão...');
    });
    
    socket.on('connected', function(data) {
        if (!isPayloadForCurrentSession(data)) return;
        console.log('âœ… WhatsApp conectado:', data);
        clearQrGenerationWatchdog();
        void loadSessionOptions(getCurrentSessionId());
        handleConnected(data.user);
    });
    
    socket.on('disconnected', function(data) {
        if (!isPayloadForCurrentSession(data)) return;
        console.log('âŒ WhatsApp desconectado');
        clearQrGenerationWatchdog();
        void loadSessionOptions(getCurrentSessionId());
        handleDisconnected();
    });

    socket.on('qr-expired', function(data) {
        if (!isPayloadForCurrentSession(data)) return;
        if (isConnected) return;
        showQRLoading('QR expirado. Gerando novo QR Code...');
        socket?.emit('refresh-qr', { sessionId: getCurrentSessionId() });
    });
    
    socket.on('error', function(data) {
        console.error('âŒ Erro:', data);
        clearQrGenerationWatchdog();
        showToast('error', data.message || 'Erro na operaÃ§Ã£o');
        
        if (isConnecting) {
            isConnecting = false;
            updateConnectButton(false);
            updatePairingButton(false);
            showQRLoading('Erro ao conectar. Tente novamente.');
        }
    });
    
    socket.on('auth-failure', function(data) {
        if (!isPayloadForCurrentSession(data)) return;
        console.error('âŒ Falha na autenticaÃ§Ã£o');
        showToast('error', 'Falha na autenticaÃ§Ã£o. Tente novamente.');
        handleDisconnected();
    });
    socket.emit('check-session', { sessionId: getCurrentSessionId() });
}

// Iniciar conexÃ£o
function startConnection() {
    if (isConnecting) return;
    const sessionId = syncCurrentSessionFromSelect();
    markReconnectUiRequested(sessionId);
    syncConnectionSectionVisibility();
    if (!socket) {
        initSocket();
    }
    const runtimeSocket = socket;
    if (!runtimeSocket) {
        showToast('error', 'Conexão com o servidor indisponível. Recarregue a página.');
        return;
    }
    if (runtimeSocket.connected !== true && typeof runtimeSocket.connect === 'function') {
        runtimeSocket.connect();
    }
    
    isConnecting = true;
    updateConnectButton(true);
    updatePairingButton(true);
    hidePairingCode();
    showQRLoading('Gerando QR Code...');
    
    console.log('ðŸš€ Iniciando conexÃ£o...');
    runtimeSocket.emit('start-session', { sessionId, forceNewQr: true });
    clearQrGenerationWatchdog();
    qrGenerationWatchdog = window.setTimeout(() => {
        if (!isConnected && isConnecting) {
            showQRLoading('Demorou para gerar QR. Tentando novamente...');
            if (runtimeSocket.connected !== true && typeof runtimeSocket.connect === 'function') {
                runtimeSocket.connect();
            }
            runtimeSocket.emit('refresh-qr', { sessionId, forceNewQr: true });
        }
    }, 25000);
}

function requestPairingCode() {
    if (isConnecting) return;
    const sessionId = syncCurrentSessionFromSelect();
    markReconnectUiRequested(sessionId);
    syncConnectionSectionVisibility();
    if (!socket) {
        initSocket();
    }
    const runtimeSocket = socket;
    if (!runtimeSocket) {
        showToast('error', 'Conexão com o servidor indisponível. Recarregue a página.');
        return;
    }
    if (runtimeSocket.connected !== true && typeof runtimeSocket.connect === 'function') {
        runtimeSocket.connect();
    }

    const phoneInput = document.getElementById('pairing-phone') as HTMLInputElement | null;
    const normalizedPhone = normalizePairingPhoneInput(phoneInput?.value || '');

    if (!normalizedPhone || normalizedPhone.length < 12 || normalizedPhone.length > 15) {
        showToast('warning', 'Informe o numero com DDI + DDD + numero');
        return;
    }

    if (phoneInput) {
        phoneInput.value = normalizedPhone;
    }

    isConnecting = true;
    updateConnectButton(true);
    updatePairingButton(true);
    showPairingCodeLoading('Gerando codigo de pareamento...');

    runtimeSocket.emit('request-pairing-code', {
        sessionId,
        phoneNumber: normalizedPhone
    });
}

// Desconectar sem remover a conta
async function disconnectSession() {
    const sessionId = syncCurrentSessionFromSelect();
    if (!sessionId) {
        showToast('warning', 'Nenhuma conta selecionada.');
        return;
    }

    if (await appConfirm(`Tem certeza que deseja desconectar a conta ${sessionId}? Ela permanecera cadastrada para reconectar depois.`, 'Desconectar conta WhatsApp')) {
        try {
            if (typeof api?.post !== 'function') {
                throw new Error('API indisponivel');
            }

            markReconnectUiRequested(sessionId);
            await api.post('/api/whatsapp/disconnect', { sessionId });
            handleDisconnected();
            await loadSessionOptions(sessionId);
            socket?.emit('check-session', { sessionId });
            showToast('info', `Conta desconectada: ${sessionId}`);
        } catch (error) {
            unmarkReconnectUiRequested(sessionId);
            const message = error instanceof Error ? error.message : 'Nao foi possivel desconectar a conta.';
            showToast('error', message);
        }
    }
}

// Remover a conta
async function removeSession() {
    const sessionId = syncCurrentSessionFromSelect();
    if (!sessionId) {
        showToast('warning', 'Nenhuma conta selecionada.');
        return;
    }

    if (await appConfirm(`Tem certeza de que deseja remover a conta ${sessionId}? Essa ação desconecta e exclui a sessão.`, 'Remover conta WhatsApp')) {
        try {
            if (typeof api?.delete !== 'function') {
                throw new Error('API indisponível');
            }

            await api.delete(`/api/whatsapp/sessions/${encodeURIComponent(sessionId)}`);
            unmarkReconnectUiRequested(sessionId);

            const activeSessionId = sanitizeSessionId(localStorage.getItem('zapvender_active_whatsapp_session'));
            if (activeSessionId === sessionId) {
                localStorage.removeItem('zapvender_active_whatsapp_session');
                currentSessionId = getDefaultSessionId();
                syncGlobalAppSessionId(currentSessionId);
            }

            handleDisconnected();
            await loadSessionOptions();
            socket?.emit('check-session', { sessionId: getCurrentSessionId() });
            showToast('success', `Conta removida: ${sessionId}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Não foi possível remover a conta.';
            showToast('error', message);
        }
    }
}

// Exibir QR Code
function displayQRCode(qrData: string) {
    console.log('ðŸ–¼ï¸ Renderizando QR Code...');
    clearQrGenerationWatchdog();
    const qrContainer = document.getElementById('qr-code') as HTMLElement | null;
    
    if (!qrData) {
        console.error('âŒ Dados do QR Code vazios');
        return;
    }
    if (!qrContainer) return;
    
    // Criar imagem do QR Code
    const img = document.createElement('img');
    img.src = qrData;
    img.alt = 'QR Code WhatsApp';
    img.style.cssText = 'width: 100%; height: 100%; object-fit: contain;';
    
    qrContainer.innerHTML = '';
    qrContainer.appendChild(img);
    
    isConnecting = false;
    updateConnectButton(false);
    const connectBtn = document.getElementById('connect-btn') as HTMLElement | null;
    if (connectBtn) connectBtn.style.display = 'none';
}

function isIdleQrLoadingMessage(message: string) {
    const normalized = String(message || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    return normalized.startsWith('aguardando conex');
}

// Mostrar loading do QR
function showQRLoading(message: string) {
    const qrContainer = document.getElementById('qr-code') as HTMLElement | null;
    if (!qrContainer) return;

    if (isIdleQrLoadingMessage(message)) {
        qrContainer.innerHTML = `
            <div class="qr-loading qr-loading-idle">
                <div class="qr-idle-arrow" aria-hidden="true">&darr;</div>
                <p>${QR_IDLE_PLACEHOLDER_TEXT}</p>
            </div>
        `;
        return;
    }

    qrContainer.innerHTML = `
        <div class="qr-loading">
            <div class="spinner"></div>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

function showPairingCodeLoading(message: string) {
    const pairingBox = document.getElementById('pairing-code-box') as HTMLElement | null;
    const pairingValue = document.getElementById('pairing-code-value') as HTMLElement | null;
    if (!pairingBox || !pairingValue) return;

    pairingCodeVisible = true;
    pairingBox.style.display = 'block';
    pairingBox.classList.add('loading');
    pairingValue.textContent = message;
}

function displayPairingCode(code: string, phoneNumber: string) {
    const pairingBox = document.getElementById('pairing-code-box') as HTMLElement | null;
    const pairingValue = document.getElementById('pairing-code-value') as HTMLElement | null;
    const pairingMeta = document.getElementById('pairing-code-meta') as HTMLElement | null;
    if (!pairingBox || !pairingValue) return;

    pairingCodeVisible = true;
    lastPairingCode = String(code || '').trim();
    pairingBox.style.display = 'block';
    pairingBox.classList.remove('loading');
    pairingValue.textContent = code || '-';
    pairingValue.title = 'Toque para copiar';
    if (pairingMeta) {
        pairingMeta.textContent = phoneNumber ? `Número: +${phoneNumber}` : '';
    }

    if (pairingCodeHideTimer) clearTimeout(pairingCodeHideTimer);
    pairingCodeHideTimer = window.setTimeout(() => {
        if (!isConnected) {
            hidePairingCode();
        }
    }, 180000);
}

function hidePairingCode() {
    const pairingBox = document.getElementById('pairing-code-box') as HTMLElement | null;
    const pairingValue = document.getElementById('pairing-code-value') as HTMLElement | null;
    const pairingMeta = document.getElementById('pairing-code-meta') as HTMLElement | null;

    pairingCodeVisible = false;
    lastPairingCode = '';
    if (pairingBox) {
        pairingBox.style.display = 'none';
        pairingBox.classList.remove('loading');
    }
    if (pairingValue) pairingValue.textContent = '';
    if (pairingMeta) pairingMeta.textContent = '';

    if (pairingCodeHideTimer) {
        clearTimeout(pairingCodeHideTimer);
        pairingCodeHideTimer = null;
    }
}

// Timer do QR Code
function startQRTimer() {
    if (qrTimer) clearInterval(qrTimer);
    timerCountdown = 30;
    
    const timerEl = document.getElementById('qr-timer') as HTMLElement | null;
    const countdownEl = document.getElementById('timer-countdown') as HTMLElement | null;
    if (timerEl) timerEl.style.display = 'block';
    
    qrTimer = window.setInterval(function() {
        timerCountdown--;
        if (countdownEl) countdownEl.textContent = String(timerCountdown);
        
        if (timerCountdown <= 0) {
            if (qrTimer) clearInterval(qrTimer);
            if (timerEl) timerEl.style.display = 'none';
            
            // Solicitar novo QR
            if (!isConnected) {
                showQRLoading('Atualizando QR Code...');
                socket?.emit('refresh-qr', { sessionId: getCurrentSessionId() });
            }
        }
    }, 1000);
}

// Handle conexÃ£o estabelecida
function handleConnected(user: { name?: string; phone?: string } | undefined) {
    const wasConnected = isConnected;
    isConnected = true;
    isConnecting = false;
    clearQrGenerationWatchdog();
    if (qrTimer) clearInterval(qrTimer);
    hidePairingCode();
    updatePairingButton(false);
    updateConnectButton(false);
    
    // Atualizar UI
    updateStatus('connected', 'Conectado');
    syncConnectionSectionVisibility();
    
    // Atualizar informaÃ§Ãµes do usuÃ¡rio
    if (user) {
        const userName = document.getElementById('user-name') as HTMLElement | null;
        const userPhone = document.getElementById('user-phone') as HTMLElement | null;
        if (userName) userName.textContent = user.name || '-';
        if (userPhone) userPhone.textContent = user.phone ? formatPhone(user.phone) : '-';
    }
    
    if (!wasConnected) {
        showToast('success', 'WhatsApp conectado com sucesso!');
    }
}

// Handle desconexÃ£o
function handleDisconnected() {
    isConnected = false;
    isConnecting = false;
    clearQrGenerationWatchdog();
    if (qrTimer) clearInterval(qrTimer);
    if (!pairingCodeVisible) {
        hidePairingCode();
    }
    updateConnectButton(false);
    updatePairingButton(false);
    
    updateStatus('disconnected', 'Desconectado');
    const connectBtn = document.getElementById('connect-btn') as HTMLElement | null;
    const qrTimerEl = document.getElementById('qr-timer') as HTMLElement | null;
    if (connectBtn) connectBtn.style.display = 'flex';
    if (qrTimerEl) qrTimerEl.style.display = 'none';

    if (shouldShowReconnectUiForSession(getCurrentSessionId())) {
        showQRLoading('Aguardando conexao...');
    }
    syncConnectionSectionVisibility();
}

// Atualizar status
function updateStatus(status: 'connected' | 'disconnected' | 'connecting' | 'qr', text: string) {
    document.body.setAttribute('data-whatsapp-connection-status', status);
    document.body.setAttribute('data-whatsapp-connection-label', text);
}

// Atualizar botÃ£o de conexÃ£o
function updateConnectButton(loading: boolean) {
    const btn = document.getElementById('connect-btn') as HTMLButtonElement | null;
    if (!btn) return;
    if (loading) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width: 20px; height: 20px; border-width: 2px; margin: 0;"></span> Conectando...';
    } else {
        btn.disabled = false;
        btn.textContent = 'Conectar WhatsApp';
    }
}

function updatePairingButton(loading: boolean) {
    const btn = document.getElementById('pairing-btn') as HTMLButtonElement | null;
    if (!btn) return;

    if (loading) {
        btn.disabled = true;
        btn.textContent = 'Gerando...';
    } else {
        btn.disabled = false;
        btn.textContent = 'Gerar codigo';
    }
}

// Formatar telefone
function formatPhone(phone: string) {
    if (!phone) return '';
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 13) {
        return `+${cleaned.slice(0,2)} (${cleaned.slice(2,4)}) ${cleaned.slice(4,9)}-${cleaned.slice(9)}`;
    } else if (cleaned.length === 11) {
        return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7)}`;
    }
    return phone;
}

// Toast
function showToast(type: 'success' | 'error' | 'warning' | 'info', message: string) {
    const container = document.getElementById('toast-container') as HTMLElement | null;
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = { success: 'OK', error: 'ERR', warning: 'WARN', info: 'INFO' };
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || 'INFO'}</span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(function() {
        toast.classList.add('fade-out');
        setTimeout(function() {
            toast.remove();
        }, 300);
    }, 4000);
}

async function copyTextToClipboard(text: string) {
    const value = String(text || '').trim();
    if (!value) return false;

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(value);
            return true;
        }
    } catch (error) {
        // fallback below
    }

    try {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        return copied;
    } catch (error) {
        return false;
    }
}

async function copyPairingCode() {
    const pairingValue = document.getElementById('pairing-code-value') as HTMLElement | null;
    const currentText = String(pairingValue?.textContent || '').trim();
    const code = lastPairingCode || currentText;

    if (!code || code.includes('Gerando')) {
        showToast('warning', 'Aguarde o codigo de pareamento');
        return;
    }

    const copied = await copyTextToClipboard(code);
    if (copied) {
        showToast('success', 'Codigo copiado');
        return;
    }
    showToast('warning', 'Não foi possível copiar automaticamente');
}

function bindPairingCodeCopy() {
    const pairingValue = document.getElementById('pairing-code-value') as HTMLElement | null;
    if (!pairingValue || pairingValue.dataset.copyBound === '1') return;

    pairingValue.dataset.copyBound = '1';
    pairingValue.style.cursor = 'pointer';
    pairingValue.addEventListener('click', () => {
        copyPairingCode();
    });
}

// Toggle sidebar
function toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('active');
    document.querySelector('.sidebar-overlay')?.classList.toggle('active');
}

// Logout
async function logout() {
    const token = sessionStorage.getItem('selfDashboardToken');
    if (token) {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                keepalive: true,
                body: '{}'
            });
        } catch (_) {
            // best-effort
        }
    }
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('self_dashboard_auth_v1');
    sessionStorage.removeItem('selfDashboardToken');
    sessionStorage.removeItem('selfDashboardExpiry');
    sessionStorage.removeItem('selfDashboardUser');
    sessionStorage.removeItem('selfDashboardRefreshToken');
    sessionStorage.removeItem('selfDashboardUserId');
    sessionStorage.removeItem('selfDashboardUserEmail');
    sessionStorage.removeItem('selfDashboardIdentity');
    window.location.href = getPostLogoutUrl();
}

const windowAny = window as Window & {
    initWhatsapp?: () => void;
    startConnection?: () => void;
    requestPairingCode?: () => void;
    disconnect?: () => Promise<void>;
    removeSession?: () => Promise<void>;
    changeSession?: (sessionId: string, options?: { revealReconnectUi?: boolean }) => void;
    createSessionPrompt?: () => void;
    toggleSidebar?: () => void;
    logout?: () => void;
};
windowAny.initWhatsapp = initWhatsapp;
windowAny.startConnection = startConnection;
windowAny.requestPairingCode = requestPairingCode;
windowAny.disconnect = disconnectSession;
windowAny.removeSession = removeSession;
windowAny.changeSession = changeSession;
windowAny.createSessionPrompt = createSessionPrompt;
windowAny.toggleSidebar = toggleSidebar;
windowAny.logout = logout;

export { initWhatsapp };
