import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { getSession } from "@/lib/session";

export type DashboardStats = {
  active_contracts: number;
  total_contracts: number;
  total_settlements: number;
  settled_count: number;
  failed_count: number;
  total_volume_mwh: number;
  total_value_brl: number;
  avg_finality_ms: number;
  total_users: number;
  network: string;
};

export type DashboardSettlement = {
  id: string;
  contract_id: string;
  buyer: string;
  seller: string;
  amount_brl: number;
  volume_mwh: number;
  pld: number;
  tx_hash: string;
  ledger: number;
  status: string;
  created_at: string;
};

export type HorizonStatus = {
  horizon_online: boolean;
  latency_ms: number;
  network: string;
  operator_balance: { xlm?: string; epwr?: string } | null;
  distribution_balance: { xlm?: string; epwr?: string } | null;
};

function authHeaders() {
  const session = getSession();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.token) h.Authorization = `Bearer ${session.token}`;
  return h;
}

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [settlements, setSettlements] = useState<DashboardSettlement[]>([]);
  const [horizon, setHorizon] = useState<HorizonStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const headers = authHeaders();
      const [statsRes, settlRes, horizonRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/dashboard/stats`, { headers }),
        fetch(`${API_BASE_URL}/api/dashboard/settlements?limit=10`, { headers }),
        fetch(`${API_BASE_URL}/api/dashboard/horizon`, { headers }),
      ]);

      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        const json = await statsRes.value.json();
        if (json.success) setStats(json.stats);
      }

      if (settlRes.status === "fulfilled" && settlRes.value.ok) {
        const json = await settlRes.value.json();
        if (json.success) setSettlements(json.settlements);
      }

      if (horizonRes.status === "fulfilled" && horizonRes.value.ok) {
        const json = await horizonRes.value.json();
        if (json.success) setHorizon(json);
      }

      setError(null);
    } catch (err: any) {
      setError(err.message || "Dashboard fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchAll, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAll]);

  return { stats, settlements, horizon, loading, error, refresh: fetchAll };
}
