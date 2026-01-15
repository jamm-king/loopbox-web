export type AuthState = {
    userId: string;
    email: string;
    accessToken: string;
    refreshToken: string;
};

const STORAGE_KEY = "loopbox.auth";
const AUTH_CHANGE_EVENT = "auth-changed";

export const loadAuthState = (): AuthState | null => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<AuthState>;
        if (!isValidAuthState(parsed)) {
            window.localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        return parsed as AuthState;
    } catch {
        return null;
    }
};

export const saveAuthState = (state: AuthState) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
};

export const clearAuthState = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
};

const isValidAuthState = (state: Partial<AuthState> | null | undefined): state is AuthState => {
    if (!state) return false;
    return (
        isNonEmptyString(state.userId) &&
        isNonEmptyString(state.email) &&
        isNonEmptyString(state.accessToken) &&
        isNonEmptyString(state.refreshToken)
    );
};

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 0;

export const getUserId = (): string | null => loadAuthState()?.userId ?? null;
export const getAccessToken = (): string | null => loadAuthState()?.accessToken ?? null;
export const getRefreshToken = (): string | null => loadAuthState()?.refreshToken ?? null;
export const AUTH_STORAGE_KEY = STORAGE_KEY;
export const AUTH_EVENT_NAME = AUTH_CHANGE_EVENT;
