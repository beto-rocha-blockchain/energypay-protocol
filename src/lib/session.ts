/**
 * Session persistence — sessionStorage only (per spec).
 *
 * The session is dropped when the browser tab is closed; longer-lived auth
 * is delegated to the backend.
 */

import type { ApiUser } from "@/lib/api";

const KEY = "energypay.session.v1";

export type AuthSession = {
  token: string;
  user: ApiUser;
  createdAt: string;
};

const isBrowser = () => typeof window !== "undefined" && !!window.sessionStorage;

export const getSession = (): AuthSession | null => {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
};

export const setSession = (session: AuthSession) => {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(KEY, JSON.stringify(session));
};

export const clearSession = () => {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(KEY);
};
