import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Notification,
  apiGetNotifications,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
  apiApproveContract,
  apiRejectContract,
} from "@/lib/api";
import { useOperator } from "@/store/operator";

const POLL_INTERVAL_MS = 30_000; // 30 s

type UseNotificationsReturn = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  approve: (contractId: string) => Promise<{ activated: boolean }>;
  reject: (contractId: string, reason?: string) => Promise<void>;
  refresh: () => void;
};

export function useNotifications(): UseNotificationsReturn {
  const isAuthenticated = useOperator((s) => s.isAuthenticated);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiGetNotifications();
      setNotifications(res.notifications);
      setUnreadCount(res.unread_count);
    } catch {
      // non-fatal — notifications are a secondary feature
    }
  }, [isAuthenticated]);

  const refresh = useCallback(() => {
    void fetch();
  }, [fetch]);

  // Initial fetch + polling
  useEffect(() => {
    if (!isAuthenticated) return;
    void fetch();
    timerRef.current = setInterval(fetch, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAuthenticated, fetch]);

  const markRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      await apiMarkNotificationRead(id).catch(() => {});
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await apiMarkAllNotificationsRead().catch(() => {});
  }, []);

  const approve = useCallback(
    async (contractId: string): Promise<{ activated: boolean }> => {
      setLoading(true);
      try {
        const res = await apiApproveContract(contractId);
        await fetch();
        return { activated: res.activated };
      } finally {
        setLoading(false);
      }
    },
    [fetch],
  );

  const reject = useCallback(
    async (contractId: string, reason?: string) => {
      setLoading(true);
      try {
        await apiRejectContract(contractId, reason);
        await fetch();
      } finally {
        setLoading(false);
      }
    },
    [fetch],
  );

  return { notifications, unreadCount, loading, markRead, markAllRead, approve, reject, refresh };
}
