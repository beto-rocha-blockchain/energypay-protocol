export function getSession() {
  const session =
    sessionStorage.getItem(
      "energypay_session"
    );

  if (!session) {
    return null;
  }

  return JSON.parse(session);
}

export function logout() {
  sessionStorage.clear();

  window.location.href = "/login";
}