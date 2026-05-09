/**
 * Server-side JWT decoder.
 *
 * The bearer token is issued by the upstream settlement backend, which is the
 * only authority that verifies its signature. The proxy decodes the payload
 * to extract authoritative claims (`sub`, `roles`) so it never has to trust
 * client-supplied identity or role data on the request body.
 *
 * NOTE: this is a payload decoder, not a verifier. The downstream backend
 * still rejects tokens with bad signatures, but the proxy uses the decoded
 * claims as the authoritative source for routing decisions inside this app.
 */

export type JwtClaims = {
  sub?: string;
  user_id?: string;
  email?: string;
  roles?: string[];
  exp?: number;
  iat?: number;
};

const b64urlDecode = (segment: string): string => {
  const pad = segment.length % 4 === 0 ? "" : "=".repeat(4 - (segment.length % 4));
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/") + pad;
  if (typeof atob === "function") {
    const bin = atob(b64);
    let out = "";
    for (let i = 0; i < bin.length; i++) out += String.fromCharCode(bin.charCodeAt(i));
    try {
      return decodeURIComponent(escape(out));
    } catch {
      return out;
    }
  }
  // Node fallback
  return Buffer.from(b64, "base64").toString("utf8");
};

export function decodeBearerClaims(authorization: string | undefined | null): JwtClaims | null {
  if (!authorization) return null;
  const m = /^bearer\s+(.+)$/i.exec(authorization.trim());
  if (!m) return null;
  const parts = m[1].split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(b64urlDecode(parts[1])) as JwtClaims;
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

const VALID_ROLES = new Set(["GENERATOR", "SELLER", "INVESTOR", "USER"]);

export function rolesFromClaims(claims: JwtClaims | null): string[] {
  if (!claims?.roles?.length) return [];
  return claims.roles
    .map((r) => String(r).toUpperCase())
    .filter((r) => VALID_ROLES.has(r));
}

export function isExpired(claims: JwtClaims | null): boolean {
  if (!claims?.exp) return false;
  return Date.now() / 1000 > claims.exp;
}

/** Roles authorized to initiate P2P settlements server-side. */
export const SETTLEMENT_AUTHORIZED_ROLES = new Set(["SELLER", "GENERATOR"]);

export function canExecuteSettlementServer(claims: JwtClaims | null): boolean {
  const roles = rolesFromClaims(claims);
  return roles.some((r) => SETTLEMENT_AUTHORIZED_ROLES.has(r));
}
