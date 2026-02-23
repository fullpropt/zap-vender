// Login page logic migrated to module

type LoginResponse = {
    token?: string;
    refreshToken?: string;
    user?: { id?: number | string; uuid?: string; name?: string; email?: string };
    error?: string;
};

type RegisterResponse = LoginResponse;

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

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

function getDashboardUrl() {
    return '#/dashboard';
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

function setErrorMessage(target: HTMLElement | null, message: string) {
    if (!target) return;
    target.style.display = 'block';
    target.textContent = message;
    setTimeout(() => {
        target.style.display = 'none';
    }, 4000);
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

function saveSession(data: LoginResponse, fallbackName: string) {
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
    if (nextIdentity) {
        sessionStorage.setItem('selfDashboardIdentity', nextIdentity);
        localStorage.setItem(LAST_IDENTITY_STORAGE_KEY, nextIdentity);
    } else {
        sessionStorage.removeItem('selfDashboardIdentity');
        localStorage.removeItem(LAST_IDENTITY_STORAGE_KEY);
    }
    sessionStorage.setItem('selfDashboardExpiry', String(Date.now() + (8 * 60 * 60 * 1000)));
}

async function handleLogin(e: Event) {
    e.preventDefault();

    const identifier = getInputValue('username').trim();
    const password = getInputValue('password');
    const errorMsg = getErrorMessageElement();

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

        saveSession(data, identifier);

        window.location.href = getDashboardUrl();
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

        if (!response.ok || !data?.token) {
            throw new Error(data?.error || 'Falha ao criar conta');
        }

        saveSession(data, name);
        window.location.href = getDashboardUrl();
    } catch (error) {
        setErrorMessage(errorMsg, error instanceof Error ? error.message : 'Falha ao criar conta');
    }

    return false;
}

function initLogin() {
    // Verificar se ja esta logado
    if (sessionStorage.getItem('selfDashboardToken')) {
        const expiry = sessionStorage.getItem('selfDashboardExpiry');
        if (expiry && Date.now() < parseInt(expiry)) {
            window.location.href = getDashboardUrl();
            return;
        }
    }

    const windowAny = window as Window & {
        handleLogin?: (e: Event) => boolean | Promise<boolean>;
        handleRegister?: (e: Event) => boolean | Promise<boolean>;
        initLogin?: () => void;
        showLogin?: () => void;
        showRegister?: () => void;
    };
    windowAny.handleLogin = handleLogin;
    windowAny.handleRegister = handleRegister;
    windowAny.initLogin = initLogin;
    windowAny.showLogin = () => setAuthMode('login');
    windowAny.showRegister = () => setAuthMode('register');

    setAuthMode('login');
}

onReady(initLogin);

export { initLogin };
