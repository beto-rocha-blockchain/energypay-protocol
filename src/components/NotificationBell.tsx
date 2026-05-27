import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  CheckCircle2,
  XCircle,
  Info,
  AlertTriangle,
  Check,
  X,
  CheckCheck,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import { type Notification } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ── Icon per notification type ── */
function NIcon({ type }: { type: Notification["type"] }) {
  if (type === "APPROVAL_REQUIRED")
    return <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />;
  if (type === "APPROVED")
    return <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />;
  if (type === "REJECTED")
    return <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />;
  if (type === "SETTLED")
    return <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />;
  return <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markRead, markAllRead, approve, reject } =
    useNotifications();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleApprove = async (n: Notification) => {
    if (!n.contract_id) return;
    setApproving(n.contract_id);
    try {
      await markRead(n.id);
      const { activated } = await approve(n.contract_id);
      toast.success(
        activated
          ? "Contract approved and activated — ready for settlement."
          : "Approval recorded.",
      );
      if (activated) {
        setOpen(false);
        navigate({ to: "/contracts" });
      }
    } catch (err) {
      toast.error((err as Error).message || "Approval failed.");
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (n: Notification) => {
    if (!n.contract_id) return;
    setRejecting(n.contract_id);
    try {
      await markRead(n.id);
      await reject(n.contract_id);
      toast.success("Contract rejected.");
    } catch (err) {
      toast.error((err as Error).message || "Rejection failed.");
    } finally {
      setRejecting(null);
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) await markRead(n.id);
    if (n.action_url) {
      setOpen(false);
      navigate({ to: n.action_url as "/" });
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          "hover:bg-muted text-muted-foreground hover:text-foreground",
          open && "bg-muted text-foreground",
        )}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive font-mono text-[9px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-md border border-border bg-card shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-widest text-foreground">
                Notifications
              </span>
              {unreadCount > 0 && (
                <Badge
                  variant="outline"
                  className="h-4 border-destructive/40 px-1.5 font-mono text-[9px] text-destructive"
                >
                  {unreadCount} new
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground/30" />
                <p className="font-mono text-[11px] text-muted-foreground">No notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "border-b border-border/50 px-4 py-3 transition-colors",
                    !n.read && "bg-primary/[0.04]",
                  )}
                >
                  <div
                    className="flex cursor-pointer items-start gap-2.5"
                    onClick={() => handleNotificationClick(n)}
                  >
                    <NIcon type={n.type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "text-[12px] leading-snug",
                            !n.read ? "font-medium text-foreground" : "text-foreground/80",
                          )}
                        >
                          {n.title}
                        </p>
                        <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {n.message}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>

                  {/* Approval actions */}
                  {n.type === "APPROVAL_REQUIRED" && n.contract_id && (
                    <div className="mt-2.5 flex items-center gap-2 pl-6">
                      <Button
                        size="sm"
                        className="h-7 gap-1 font-mono text-[10px] uppercase tracking-widest"
                        disabled={approving === n.contract_id || rejecting === n.contract_id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApprove(n);
                        }}
                      >
                        {approving === n.contract_id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 border-destructive/40 font-mono text-[10px] uppercase tracking-widest text-destructive hover:bg-destructive/10"
                        disabled={approving === n.contract_id || rejecting === n.contract_id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReject(n);
                        }}
                      >
                        {rejecting === n.contract_id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
