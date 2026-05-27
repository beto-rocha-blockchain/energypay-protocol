import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { Mail, ArrowRight, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { BrandBadge, BrandName } from "@/components/BrandLogo";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Forgot Password — EnergyPay" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  // dev_reset_url is only returned when RESEND_API_KEY is absent (dev mode)
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Enter your operator email address.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.dev_reset_url) {
        setDevResetUrl(data.dev_reset_url);
      }
      setSent(true);
    } catch {
      toast.error("Request failed — check your connection and retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen w-full place-items-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <BrandBadge size="md" />
          <div className="leading-tight" style={{ gap: 3, display: "flex", flexDirection: "column" }}>
            <BrandName size="md" />
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Account Recovery
            </div>
          </div>
        </div>

        <Card className="overflow-hidden border-border bg-card/70">
          <div className="flex items-center justify-between border-b border-border bg-background/40 px-4 py-2.5">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Password Recovery Terminal
            </div>
          </div>

          {sent ? (
            <div className="space-y-4 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
              <h2 className="font-display text-xl font-semibold">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                If <span className="font-mono text-foreground">{email}</span> is registered, a
                password reset link has been sent. The link expires in 1 hour.
              </p>

              {/* Dev-mode fallback: shown when the mail provider is not configured */}
              {devResetUrl && (
                <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-left">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-warning">
                    ⚠ Dev mode — email not configured
                  </p>
                  <p className="mb-3 text-[11px] text-muted-foreground">
                    No mail provider (RESEND_API_KEY) is set. Use this link directly to reset your
                    password:
                  </p>
                  <a
                    href={devResetUrl}
                    className="inline-flex items-center gap-1.5 break-all font-mono text-[11px] text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    {devResetUrl}
                  </a>
                </div>
              )}

              <Link
                to="/login"
                className="block font-mono text-[11px] uppercase tracking-widest text-primary hover:underline"
              >
                ← Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4 p-5">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Enter the email address registered to your operator account and we'll send you a
                  password reset link.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
                >
                  Operator Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@clearing-desk.com"
                    className="h-9 pl-8 font-mono text-xs"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={busy}
                className="h-9 w-full font-mono text-xs uppercase tracking-widest"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    Send Reset Link <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </>
                )}
              </Button>

              <div className="border-t border-border pt-3 text-center">
                <Link
                  to="/login"
                  className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary"
                >
                  ← Back to login
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
