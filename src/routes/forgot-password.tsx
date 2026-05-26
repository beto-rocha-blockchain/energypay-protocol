import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Zap, Mail, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Enter your operator email address.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      await res.json();
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
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            <Zap className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">EnergyPay</div>
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
