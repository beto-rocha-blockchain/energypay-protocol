const SESSION_KEY = "energypay-session";

export function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setSession(data: unknown) {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify(data)
  );
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}