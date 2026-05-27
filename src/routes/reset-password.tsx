import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import {
  Lock,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { BrandBadge, BrandName } from "@/components/BrandLogo";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [{ title: "Reset Password — EnergyPay" }],
  }),
  component: ResetPasswordPage,
});

type ResetStep = "password" | "phone-otp" | "done";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = Route.useSearch();

  // Step management
  const [step, setStep] = useState<ResetStep>("password");

  // Password step
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  // Phone OTP step
  const [phoneMasked, setPhoneMasked] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  // Step 1 — submit new password
  const onSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    if (!token) {
      toast.error("Invalid or missing reset token.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "Reset failed.");
        return;
      }
      if (data.require_phone) {
        // Phone 2FA required — move to OTP step
        setPhoneMasked(data.phone_masked || "");
        if (data.dev_otp) setDevOtp(data.dev_otp);
        setStep("phone-otp");
      } else {
        // No phone on account — reset complete
        setStep("done");
        setTimeout(() => navigate({ to: "/login" }), 2500);
      }
    } catch {
      toast.error("Request failed — check your connection and retry.");
    } finally {
      setBusy(false);
    }
  };

  // Step 2 — verify phone OTP
  const onSubmitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code.");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password/confirm-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, code: otp }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "Verification failed.");
        return;
      }
      setStep("done");
      setTimeout(() => navigate({ to: "/login" }), 2500);
    } catch {
      toast.error("Request failed — check your connection and retry.");
    } finally {
      setVerifying(false);
    }
  };

  // Resend OTP — re-submit password to trigger a new code
  const onResendOtp = async () => {
    setResending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (data.require_phone) {
        if (data.dev_otp) setDevOtp(data.dev_otp);
        setOtp("");
        toast.success("A new verification code was sent to your phone.");
      } else {
        toast.error("Could not resend code.");
      }
    } catch {
      toast.error("Request failed.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="grid min-h-screen w-full place-items-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-6 flex items-center gap-2">
          <BrandBadge size="md" />
          <div className="leading-tight" style={{ gap: 3, display: "flex", flexDirection: "column" }}>
            <BrandName size="md" />
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Set New Password
            </div>
          </div>
        </div>

        <Card className="overflow-hidden border-border bg-card/70">
          {/* Header bar */}
          <div className="flex items-center justify-between border-b border-border bg-background/40 px-4 py-2.5">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Password Reset Terminal
            </div>
            {/* Step indicator */}
            <div className="flex items-center gap-1.5">
              {(["password", "phone-otp"] as const).map((s, i) => (
                <div
                  key={s}
                  className={cn(
                    "h-1.5 w-6 rounded-full transition-colors",
                    step === s || (step === "done" && i <= 1)
                      ? "bg-primary"
                      : "bg-muted",
                  )}
                />
              ))}
            </div>
          </div>

          {/* ── Step: Done ── */}
          {step === "done" && (
            <div className="space-y-4 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
              <h2 className="font-display text-xl font-semibold">Password updated</h2>
              <p className="text-sm text-muted-foreground">
                Your password has been reset successfully. Redirecting to login…
              </p>
            </div>
          )}

          {/* ── Step 1: New Password ── */}
          {step === "password" && (
            <form onSubmit={onSubmitPassword} className="space-y-4 p-5">
              {!token && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 font-mono text-[11px] text-destructive">
                  Invalid or missing reset token. Request a new password reset link.
                </div>
              )}

              <div className="space-y-1.5">
                <Label
                  htmlFor="pw"
                  className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
                >
                  New Password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="pw"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="h-9 pl-8 pr-9 font-mono text-xs tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="confirm"
                  className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
                >
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type={showPw ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••••••"
                    className={cn(
                      "h-9 pl-8 font-mono text-xs tracking-widest",
                      confirm && confirm !== password && "border-destructive",
                    )}
                  />
                </div>
                {confirm && confirm !== password && (
                  <p className="font-mono text-[10px] text-destructive">Passwords do not match.</p>
                )}
              </div>

              {/* 2FA notice */}
              <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <p className="font-mono text-[10px] text-muted-foreground">
                  A verification code will be sent to your registered phone to confirm this change.
                </p>
              </div>

              <Button
                type="submit"
                disabled={busy || !token}
                className="h-9 w-full font-mono text-xs uppercase tracking-widest"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    Continue <ArrowRight className="ml-1 h-3.5 w-3.5" />
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

          {/* ── Step 2: Phone OTP ── */}
          {step === "phone-otp" && (
            <form onSubmit={onSubmitOtp} className="space-y-4 p-5">
              {/* Icon + title */}
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-foreground">
                    Phone Verification
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    A 6-digit code was sent via WhatsApp to{" "}
                    <span className="font-mono text-foreground">{phoneMasked}</span>
                  </p>
                </div>
              </div>

              {/* Dev OTP banner */}
              {devOtp && (
                <div className="rounded-md border border-warning/40 bg-warning/5 p-3">
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-warning">
                    ⚠ Dev mode — Twilio not configured
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Your verification code is:{" "}
                    <span className="font-mono font-bold text-foreground">{devOtp}</span>
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label
                  htmlFor="otp"
                  className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
                >
                  Verification Code
                </Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="h-10 text-center font-mono text-xl tracking-[0.5em]"
                  autoFocus
                />
                <p className="font-mono text-[10px] text-muted-foreground">
                  Code expires in 10 minutes.
                </p>
              </div>

              <Button
                type="submit"
                disabled={verifying || otp.length !== 6}
                className="h-9 w-full font-mono text-xs uppercase tracking-widest"
              >
                {verifying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    Verify & Reset Password <ShieldCheck className="ml-1 h-3.5 w-3.5" />
                  </>
                )}
              </Button>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <button
                  type="button"
                  onClick={onResendOtp}
                  disabled={resending}
                  className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary disabled:opacity-50"
                >
                  {resending ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Sending…
                    </span>
                  ) : (
                    "Resend Code"
                  )}
                </button>
                <Link
                  to="/forgot-password"
                  className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary"
                >
                  Start Over
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
