/**
 * EnergyPay transport seam.
 *
 * The single boundary between the UI/service layer and the network.
 * Today: only http (TanStack server fns). Tomorrow: real WebSocket
 * channel for telemetry — swap `wsAdapter` without touching services.
 *
 * IMPORTANT: routes and components NEVER call fetch directly. They go
 * through a service in `src/services/*` which uses this transport.
 */

export type HttpInit = RequestInit & { timeoutMs?: number };

export interface HttpAdapter {
  get<T>(path: string, init?: HttpInit): Promise<T>;
  post<T>(path: string, body?: unknown, init?: HttpInit): Promise<T>;
}

export interface WsAdapter {
  subscribe(channel: string, onMessage: (data: unknown) => void): () => void;
  status(): "connected" | "connecting" | "offline";
}

class FetchHttp implements HttpAdapter {
  async get<T>(path: string, init?: HttpInit): Promise<T> {
    return this._do<T>(path, { ...init, method: "GET" });
  }
  async post<T>(path: string, body?: unknown, init?: HttpInit): Promise<T> {
    return this._do<T>(path, {
      ...init,
      method: "POST",
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
      body: body == null ? undefined : JSON.stringify(body),
    });
  }
  private async _do<T>(path: string, init: HttpInit): Promise<T> {
    const ctl = new AbortController();
    const timeout = setTimeout(() => ctl.abort(), init.timeoutMs ?? 15_000);
    try {
      const r = await fetch(path, { ...init, signal: ctl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${path}`);
      const ct = r.headers.get("content-type") ?? "";
      return (ct.includes("application/json") ? await r.json() : await r.text()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

class NoopWs implements WsAdapter {
  subscribe(_channel: string, _onMessage: (data: unknown) => void): () => void {
    return () => {};
  }
  status(): "connected" | "connecting" | "offline" {
    return "offline";
  }
}

export const http: HttpAdapter = new FetchHttp();
export const ws: WsAdapter = new NoopWs();
