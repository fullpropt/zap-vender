const AUTH_PERSIST_STORAGE_KEY = 'self_dashboard_auth_v1';
const ACCESS_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

type PersistedAuthSession = {
    token: string;
    refreshToken?: string;
    user?: string;
    userId?: string;
    userEmail?: string;
    identity?: string;
    isAppAdmin?: boolean;
    expiry: number;
    savedAt: number;
};

function toTrimmedString(value: unknown) {
    return String(value || '').trim();
}

function parsePositiveNumber(value: unknown, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readPersistedAuthSession(): PersistedAuthSession | null {
    try {
        const raw = localStorage.getItem(AUTH_PERSIST_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<PersistedAuthSession>;
        const token = toTrimmedString(parsed?.token);
        const refreshToken = toTrimmedString(parsed?.refreshToken);
        const user = toTrimmedString(parsed?.user);
        const userId = toTrimmedString(parsed?.userId);
        const userEmail = toTrimmedString(parsed?.userEmail);
        const identity = toTrimmedString(parsed?.identity);
        const isAppAdmin = parsed?.isAppAdmin === true;
        const expiry = parsePositiveNumber(parsed?.expiry, 0);
        const savedAt = parsePositiveNumber(parsed?.savedAt, Date.now());

        if (!token) return null;
        if (!expiry) return null;

        return {
            token,
            refreshToken: refreshToken || undefined,
            user: user || undefined,
            userId: userId || undefined,
            userEmail: userEmail || undefined,
            identity: identity || undefined,
            isAppAdmin,
            expiry,
            savedAt
        };
    } catch (_) {
        return null;
    }
}

function writePersistedAuthSession(session: PersistedAuthSession) {
    try {
        localStorage.setItem(AUTH_PERSIST_STORAGE_KEY, JSON.stringify(session));
    } catch (_) {
        // ignore storage failures
    }
}

function getSessionStorageAuthSnapshot(): PersistedAuthSession | null {
    const token = toTrimmedString(sessionStorage.getItem('selfDashboardToken'));
    const refreshToken = toTrimmedString(sessionStorage.getItem('selfDashboardRefreshToken'));
    const user = toTrimmedString(sessionStorage.getItem('selfDashboardUser'));
    const userId = toTrimmedString(sessionStorage.getItem('selfDashboardUserId'));
    const userEmail = toTrimmedString(sessionStorage.getItem('selfDashboardUserEmail'));
    const identity = toTrimmedString(sessionStorage.getItem('selfDashboardIdentity'));
    const isAppAdmin = sessionStorage.getItem('selfDashboardIsAppAdmin') === '1';
    const expiry = parsePositiveNumber(sessionStorage.getItem('selfDashboardExpiry'), 0);

    if (!token || !expiry) return null;

    return {
        token,
        refreshToken: refreshToken || undefined,
        user: user || undefined,
        userId: userId || undefined,
        userEmail: userEmail || undefined,
        identity: identity || undefined,
        isAppAdmin,
        expiry,
        savedAt: Date.now()
    };
}

function applyAuthSnapshotToSessionStorage(snapshot: PersistedAuthSession) {
    sessionStorage.setItem('selfDashboardToken', snapshot.token);

    if (snapshot.refreshToken) {
        sessionStorage.setItem('selfDashboardRefreshToken', snapshot.refreshToken);
    } else {
        sessionStorage.removeItem('selfDashboardRefreshToken');
    }

    if (snapshot.user) {
        sessionStorage.setItem('selfDashboardUser', snapshot.user);
    } else {
        sessionStorage.removeItem('selfDashboardUser');
    }

    if (snapshot.userId) {
        sessionStorage.setItem('selfDashboardUserId', snapshot.userId);
    } else {
        sessionStorage.removeItem('selfDashboardUserId');
    }

    if (snapshot.userEmail) {
        sessionStorage.setItem('selfDashboardUserEmail', snapshot.userEmail);
    } else {
        sessionStorage.removeItem('selfDashboardUserEmail');
    }

    if (snapshot.identity) {
        sessionStorage.setItem('selfDashboardIdentity', snapshot.identity);
    } else {
        sessionStorage.removeItem('selfDashboardIdentity');
    }

    if (snapshot.isAppAdmin) {
        sessionStorage.setItem('selfDashboardIsAppAdmin', '1');
    } else {
        sessionStorage.removeItem('selfDashboardIsAppAdmin');
    }

    sessionStorage.setItem('selfDashboardExpiry', String(snapshot.expiry));
}

function getSessionExpiryTimestamp() {
    return parsePositiveNumber(sessionStorage.getItem('selfDashboardExpiry'), 0);
}

function hasValidSessionStorageToken() {
    const token = toTrimmedString(sessionStorage.getItem('selfDashboardToken'));
    const expiry = getSessionExpiryTimestamp();
    return Boolean(token) && expiry > Date.now();
}

export function writePersistedAuthSessionFromSessionStorage() {
    const snapshot = getSessionStorageAuthSnapshot();
    if (!snapshot) return;
    writePersistedAuthSession(snapshot);
}

export function clearPersistedAuthSession() {
    localStorage.removeItem(AUTH_PERSIST_STORAGE_KEY);
}

export function clearSessionAuthStorage() {
    sessionStorage.removeItem('selfDashboardToken');
    sessionStorage.removeItem('selfDashboardUser');
    sessionStorage.removeItem('selfDashboardExpiry');
    sessionStorage.removeItem('selfDashboardRefreshToken');
    sessionStorage.removeItem('selfDashboardUserId');
    sessionStorage.removeItem('selfDashboardUserEmail');
    sessionStorage.removeItem('selfDashboardIdentity');
    sessionStorage.removeItem('selfDashboardIsAppAdmin');
}

async function requestAccessTokenRefresh(refreshToken: string): Promise<string | null> {
    try {
        const response = await fetch(`${window.location.origin}/api/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refreshToken })
        });

        if (!response.ok) return null;
        const data = await response.json().catch(() => ({} as { token?: string }));
        const token = toTrimmedString(data?.token);
        return token || null;
    } catch (_) {
        return null;
    }
}

export async function restoreAuthSessionFromPersistence(options: { allowRefresh?: boolean } = {}) {
    const allowRefresh = options.allowRefresh !== false;

    if (hasValidSessionStorageToken()) {
        return true;
    }

    const persisted = readPersistedAuthSession();
    if (!persisted) {
        return false;
    }

    applyAuthSnapshotToSessionStorage(persisted);

    if (hasValidSessionStorageToken()) {
        return true;
    }

    if (!allowRefresh) {
        clearSessionAuthStorage();
        clearPersistedAuthSession();
        return false;
    }

    const refreshToken = toTrimmedString(
        sessionStorage.getItem('selfDashboardRefreshToken') || persisted.refreshToken
    );
    if (!refreshToken) {
        clearSessionAuthStorage();
        clearPersistedAuthSession();
        return false;
    }

    const refreshedToken = await requestAccessTokenRefresh(refreshToken);
    if (!refreshedToken) {
        clearSessionAuthStorage();
        clearPersistedAuthSession();
        return false;
    }

    sessionStorage.setItem('selfDashboardToken', refreshedToken);
    sessionStorage.setItem('selfDashboardRefreshToken', refreshToken);
    sessionStorage.setItem('selfDashboardExpiry', String(Date.now() + ACCESS_TOKEN_TTL_MS));
    writePersistedAuthSessionFromSessionStorage();
    return true;
}
