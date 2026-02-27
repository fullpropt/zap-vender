// Login page logic migrated to module

import { restoreAuthSessionFromPersistence, writePersistedAuthSessionFromSessionStorage } from '../core/authPersistence';

type LoginResponse = {
    token?: string;
    refreshToken?: string;
    user?: {
        id?: number | string;
        uuid?: string;
        name?: string;
        email?: string;
        role?: string;
        is_application_admin?: boolean;
    };
    error?: string;
    code?: string;
};

type RegisterResponse = LoginResponse & {
    success?: boolean;
    message?: string;
    email?: string;
    expiresInText?: string;
    requiresEmailConfirmation?: boolean;
    retryable?: boolean;
    accountCreated?: boolean;
    sent?: boolean;
    alreadyConfirmed?: boolean;
};

type AuthMode = 'login' | 'register';

const APP_LOCAL_STORAGE_EXACT_KEYS = [
    'isLoggedIn',
    'selfSettings',
    'self_leads',
    'self_templates',
    'self_messages',
    'self_contacts',
    'whatsapp_connected',
    'whatsapp_user',
    'zapvender_active_whatsapp_session',
    'zapvender_inbox_session_filter',
    'zapvender_contacts_session_filter',
    'zapvender_last_open_flow_id'
];

const APP_LOCAL_STORAGE_PREFIXES = [
    'self_',
    'zapvender_',
    'whatsapp_'
];
const LAST_IDENTITY_STORAGE_KEY = 'self_last_identity';
const REMEMBER_SESSION_PREF_STORAGE_KEY = 'self_dashboard_remember_session';

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

function getDashboardUrl(isApplicationAdmin = false) {
    return isApplicationAdmin ? '#/admin-dashboard' : '#/dashboard';
}

function getInputValue(id: string): string {
    const input = document.getElementById(id) as HTMLInputElement | null;
    return input?.value ?? '';
}

function getErrorMessageElement(): HTMLElement | null {
    return document.getElementById('errorMsg');
}

function getRegisterErrorElement(): HTMLElement | null {
    return document.getElementById('registerErrorMsg');
}

function getAuthInfoElement(): HTMLElement | null {
    return document.getElementById('authInfoMsg');
}

function getResendConfirmationButton(): HTMLButtonElement | null {
    return document.getElementById('resendConfirmationBtn') as HTMLButtonElement | null;
}

function setResendConfirmationLoading(loading: boolean) {
    const button = getResendConfirmationButton();
    if (!button) return;
    button.disabled = loading;
    button.textContent = loading ? 'Reenviando...' : 'Reenviar confirmação';
}

function normalizeEmailAddress(value: unknown) {
    return String(value || '').trim().toLowerCase();
}

function isValidEmailAddress(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function setErrorMessage(target: HTMLElement | null, message: string) {
    if (!target) return;
    target.classList.remove('success-message');
    target.style.display = 'block';
    target.textContent = message;
    setTimeout(() => {
        target.style.display = 'none';
    }, 4000);
}

function setInfoMessage(target: HTMLElement | null, message: string, success = true) {
    if (!target) return;
    target.classList.toggle('success-message', success);
    target.style.display = 'block';
    target.textContent = message;
}

function hideInfoMessage() {
    const target = getAuthInfoElement();
    if (!target) return;
    target.style.display = 'none';
    target.textContent = '';
    target.classList.remove('success-message');
}

function getHashRouteQueryParams(): URLSearchParams {
    const hash = String(window.location.hash || '');
    const queryStart = hash.indexOf('?');
    if (queryStart < 0) return new URLSearchParams();
    return new URLSearchParams(hash.slice(queryStart + 1));
}

function replaceLoginHashQuery(params: URLSearchParams) {
    const query = params.toString();
    const nextHash = query ? `#/login?${query}` : '#/login';
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
    window.history.replaceState(null, '', nextUrl);
}

function setAuthMode(mode: AuthMode) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');
    const loginError = getErrorMessageElement();
    const registerError = getRegisterErrorElement();

    if (mode === 'login') {
        loginForm?.classList.remove('hidden');
        registerForm?.classList.add('hidden');
        if (authTitle) authTitle.textContent = 'Acesso ao Dashboard';
        if (authSubtitle) authSubtitle.textContent = 'Entre com seu usu\u00E1rio para continuar.';
        const usernameInput = document.getElementById('username') as HTMLInputElement | null;
        usernameInput?.focus();
    } else {
        loginForm?.classList.add('hidden');
        registerForm?.classList.remove('hidden');
        if (authTitle) authTitle.textContent = 'Criar conta';
        if (authSubtitle) authSubtitle.textContent = 'Cadastre sua conta para acessar a plataforma.';
        hideInfoMessage();
        const registerNameInput = document.getElementById('registerName') as HTMLInputElement | null;
        registerNameInput?.focus();
    }

    if (loginError) loginError.style.display = 'none';
    if (registerError) registerError.style.display = 'none';
}

function normalizeIdentityPart(value: unknown): string {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function resolveSessionIdentity(data: LoginResponse, fallbackName: string): string {
    const userId = normalizeIdentityPart(data?.user?.id);
    if (userId) return `id:${userId}`;

    const userEmail = normalizeIdentityPart(data?.user?.email);
    if (userEmail) return `email:${userEmail}`;

    const userUuid = normalizeIdentityPart(data?.user?.uuid);
    if (userUuid) return `uuid:${userUuid}`;

    const userName = normalizeIdentityPart(data?.user?.name || fallbackName);
    return userName ? `name:${userName}` : '';
}

function clearAppLocalStorageState() {
    const toRemove: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = String(localStorage.key(index) || '');
        if (!key) continue;
        if (key === LAST_IDENTITY_STORAGE_KEY) continue;
        const hasExactMatch = APP_LOCAL_STORAGE_EXACT_KEYS.includes(key);
        const hasPrefixMatch = APP_LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
        if (hasExactMatch || hasPrefixMatch) {
            toRemove.push(key);
        }
    }

    toRemove.forEach((key) => localStorage.removeItem(key));
}

function readRememberSessionPreference() {
    return localStorage.getItem(REMEMBER_SESSION_PREF_STORAGE_KEY) === '1';
}

function persistRememberSessionPreference(remember: boolean) {
    localStorage.setItem(REMEMBER_SESSION_PREF_STORAGE_KEY, remember ? '1' : '0');
}

function saveSession(data: LoginResponse, fallbackName: string, rememberSession = readRememberSessionPreference()) {
    if (!data?.token) return;
    const previousIdentity = normalizeIdentityPart(localStorage.getItem(LAST_IDENTITY_STORAGE_KEY));
    const nextIdentity = resolveSessionIdentity(data, fallbackName);

    if (!previousIdentity || !nextIdentity || previousIdentity !== nextIdentity) {
        clearAppLocalStorageState();
    }

    sessionStorage.setItem('selfDashboardToken', data.token);
    if (data.refreshToken) {
        sessionStorage.setItem('selfDashboardRefreshToken', data.refreshToken);
    } else {
        sessionStorage.removeItem('selfDashboardRefreshToken');
    }
    sessionStorage.setItem('selfDashboardUser', data.user?.name || fallbackName);
    if (data?.user?.id !== undefined && data?.user?.id !== null) {
        sessionStorage.setItem('selfDashboardUserId', String(data.user.id));
    } else {
        sessionStorage.removeItem('selfDashboardUserId');
    }
    if (data?.user?.email) {
        sessionStorage.setItem('selfDashboardUserEmail', String(data.user.email));
    } else {
        sessionStorage.removeItem('selfDashboardUserEmail');
    }
    if (data?.user?.is_application_admin === true) {
        sessionStorage.setItem('selfDashboardIsAppAdmin', '1');
    } else {
        sessionStorage.removeItem('selfDashboardIsAppAdmin');
    }
    if (nextIdentity) {
        sessionStorage.setItem('selfDashboardIdentity', nextIdentity);
        localStorage.setItem(LAST_IDENTITY_STORAGE_KEY, nextIdentity);
    } else {
        sessionStorage.removeItem('selfDashboardIdentity');
        localStorage.removeItem(LAST_IDENTITY_STORAGE_KEY);
    }
    sessionStorage.setItem('selfDashboardExpiry', String(Date.now() + (8 * 60 * 60 * 1000)));
    persistRememberSessionPreference(rememberSession);
    if (rememberSession) {
        writePersistedAuthSessionFromSessionStorage();
    } else {
        localStorage.removeItem('self_dashboard_auth_v1');
    }
}

async function handleLogin(e: Event) {
    e.preventDefault();

    const identifier = getInputValue('username').trim();
    const password = getInputValue('password');
    const rememberSession = (document.getElementById('rememberSession') as HTMLInputElement | null)?.checked === true;
    const errorMsg = getErrorMessageElement();
    hideInfoMessage();

    try {
        const response = await fetch(`${window.location.origin}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: identifier,
                password
            })
        });

        const data: LoginResponse = await response.json();

        if (!response.ok || !data?.token) {
            throw new Error(data?.error || 'Credenciais inv\u00E1lidas');
        }

        saveSession(data, identifier, rememberSession);

        const isApplicationAdmin = data?.user?.is_application_admin === true;
        window.location.href = getDashboardUrl(isApplicationAdmin);
    } catch (error) {
        setErrorMessage(errorMsg, error instanceof Error ? error.message : 'Falha ao realizar login');
    }

    return false;
}

async function handleRegister(e: Event) {
    e.preventDefault();

    const name = getInputValue('registerName').trim();
    const email = getInputValue('registerEmail').trim();
    const password = getInputValue('registerPassword');
    const confirm = getInputValue('registerConfirm');
    const errorMsg = getRegisterErrorElement();
    const infoMsg = getAuthInfoElement();
    hideInfoMessage();

    if (!name || !email || !password || !confirm) {
        setErrorMessage(errorMsg, 'Preencha todos os campos');
        return false;
    }

    if (password.length < 6) {
        setErrorMessage(errorMsg, 'Senha deve ter pelo menos 6 caracteres');
        return false;
    }

    if (password !== confirm) {
        setErrorMessage(errorMsg, 'As senhas n\u00E3o coincidem');
        return false;
    }

    try {
        const response = await fetch(`${window.location.origin}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                email,
                password
            })
        });

        const data: RegisterResponse = await response.json();

        if (!response.ok) {
            throw new Error(data?.error || 'Falha ao criar conta');
        }

        if (data?.token) {
            saveSession(data, name);
            const isApplicationAdmin = data?.user?.is_application_admin === true;
            window.location.href = getDashboardUrl(isApplicationAdmin);
            return false;
        }

        if (data?.requiresEmailConfirmation) {
            const loginUsername = document.getElementById('username') as HTMLInputElement | null;
            if (loginUsername) {
                loginUsername.value = String(data.email || email);
            }

            const registerFormEl = document.getElementById('registerForm') as HTMLFormElement | null;
            registerFormEl?.reset();

            setAuthMode('login');
            setInfoMessage(
                infoMsg,
                data.message || 'Conta criada. Verifique seu email para confirmar o cadastro.'
            );
            return false;
        }

        throw new Error(data?.error || 'Falha ao criar conta');
    } catch (error) {
        setErrorMessage(errorMsg, error instanceof Error ? error.message : 'Falha ao criar conta');
    }

    return false;
}

async function resendEmailConfirmation() {
    const errorMsg = getErrorMessageElement();
    const infoMsg = getAuthInfoElement();
    hideInfoMessage();

    const email = normalizeEmailAddress(getInputValue('username'));
    if (!email) {
        setErrorMessage(errorMsg, 'Digite seu e-mail no campo Usuário para reenviar a confirmação');
        return;
    }

    if (!isValidEmailAddress(email)) {
        setErrorMessage(errorMsg, 'Informe um e-mail válido para reenviar a confirmação');
        return;
    }

    setResendConfirmationLoading(true);

    try {
        const response = await fetch(`${window.location.origin}/api/auth/resend-confirmation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const data: RegisterResponse = await response.json().catch(() => ({} as RegisterResponse));

        if (!response.ok) {
            throw new Error(data?.error || 'Não foi possível reenviar o e-mail de confirmação');
        }

        const message = String(
            data?.message
            || 'Se existir uma conta pendente para este e-mail, enviaremos um novo link de confirmação.'
        );
        setInfoMessage(infoMsg, message, true);
    } catch (error) {
        setErrorMessage(
            errorMsg,
            error instanceof Error ? error.message : 'Falha ao reenviar e-mail de confirmação'
        );
    } finally {
        setResendConfirmationLoading(false);
    }
}

let confirmEmailRequestInFlight = false;

async function handleConfirmEmailFromRoute() {
    const infoMsg = getAuthInfoElement();
    const hashParams = getHashRouteQueryParams();
    const confirmEmailToken = String(hashParams.get('confirmEmailToken') || '').trim();
    const confirmEmailError = String(hashParams.get('emailConfirmError') || '').trim();

    if (!confirmEmailToken) {
        if (confirmEmailError === 'token_required') {
            setAuthMode('login');
            setInfoMessage(infoMsg, 'Link de confirmacao invalido: token ausente.', false);
            hashParams.delete('emailConfirmError');
            replaceLoginHashQuery(hashParams);
        }
        return;
    }

    if (confirmEmailRequestInFlight) return;
    confirmEmailRequestInFlight = true;

    try {
        setAuthMode('login');
        setInfoMessage(infoMsg, 'Confirmando seu email...', true);

        const response = await fetch(
            `${window.location.origin}/api/auth/confirm-email?token=${encodeURIComponent(confirmEmailToken)}`,
            { method: 'GET' }
        );

        const data = await response.json().catch(() => ({} as RegisterResponse));

        if (!response.ok) {
            setInfoMessage(infoMsg, String(data?.error || 'Falha ao confirmar email'), false);
            return;
        }

        setInfoMessage(
            infoMsg,
            String(data?.message || 'Email confirmado com sucesso. Voce ja pode entrar.'),
            true
        );
    } catch (error) {
        setInfoMessage(
            infoMsg,
            error instanceof Error ? error.message : 'Falha ao confirmar email',
            false
        );
    } finally {
        hashParams.delete('confirmEmailToken');
        replaceLoginHashQuery(hashParams);
        confirmEmailRequestInFlight = false;
    }
}

async function initLogin() {
    const hashParams = getHashRouteQueryParams();
    const hasPendingEmailConfirmation = Boolean(String(hashParams.get('confirmEmailToken') || '').trim());

    // Verificar se ja esta logado
    if (!hasPendingEmailConfirmation) {
        await restoreAuthSessionFromPersistence({ allowRefresh: true });
    }

    if (!hasPendingEmailConfirmation && sessionStorage.getItem('selfDashboardToken')) {
        const expiry = sessionStorage.getItem('selfDashboardExpiry');
        if (expiry && Date.now() < parseInt(expiry)) {
            const isApplicationAdmin = sessionStorage.getItem('selfDashboardIsAppAdmin') === '1';
            window.location.href = getDashboardUrl(isApplicationAdmin);
            return;
        }
    }

    const windowAny = window as Window & {
        handleLogin?: (e: Event) => boolean | Promise<boolean>;
        handleRegister?: (e: Event) => boolean | Promise<boolean>;
        resendEmailConfirmation?: () => Promise<void>;
        initLogin?: () => void;
        showLogin?: () => void;
        showRegister?: () => void;
    };
    windowAny.handleLogin = handleLogin;
    windowAny.handleRegister = handleRegister;
    windowAny.resendEmailConfirmation = resendEmailConfirmation;
    windowAny.initLogin = initLogin;
    windowAny.showLogin = () => setAuthMode('login');
    windowAny.showRegister = () => setAuthMode('register');

    setAuthMode('login');
    const rememberInput = document.getElementById('rememberSession') as HTMLInputElement | null;
    if (rememberInput) {
        rememberInput.checked = readRememberSessionPreference();
    }
    setResendConfirmationLoading(false);
    void handleConfirmEmailFromRoute();
}

onReady(initLogin);

export { initLogin };
