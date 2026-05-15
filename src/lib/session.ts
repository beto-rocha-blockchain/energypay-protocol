import type { ApiUser } from "./api";

const KEY = "session";

export type AuthSession = {
  token: string;
  user: ApiUser;
  createdAt: string;
};

const isBrowser = () => typeof window !== "undefined";

export const getSession = (): AuthSession | null => {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(KEY);

    if (!raw) return null;

    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
};

export const setSession = (session: AuthSession) => {
  if (!isBrowser()) return;

  window.localStorage.setItem(KEY, JSON.stringify(session));
};

export const clearSession = () => {
  if (!isBrowser()) return;

  window.localStorage.removeItem(KEY);
};
