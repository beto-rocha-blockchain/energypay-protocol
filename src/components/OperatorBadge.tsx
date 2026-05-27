import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useOperator, maskAddress, ROLE_META } from "@/store/operator";
import { STELLAR_NETWORK_LABEL } from "@/lib/stellar";
import { apiResendVerification, apiSendPhoneCode, apiVerifyPhoneCode, apiUpdatePhone } from "@/lib/api";
import {
  Copy,
  LogOut,
  ShieldCheck,
  Activity,
  Building2,
  Mail,
  Hash,
  Check,
  KeyRound,
  MapPin,
  Sun,
  Moon,
  AlertTriangle,
  Loader2,
  MailCheck,
  Phone,
  PhoneCall,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useUiStore, type Theme } from "@/store/ui";

export function OperatorBadge() {
  const operator = useOperator((s) => s.operator);
  const logout = useOperator((s) => s.logout);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  if (!operator) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(operator.settlementAddress);
      setCopied(true);
      toast.success("Settlement address copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const onLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground transition hover:bg-accent/10"
        >
          <span className="flex items-center gap-1.5 text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            Operator Connected
          </span>
          <span className="hidden text-muted-foreground md:inline">·</span>
          <span className="hidden text-muted-foreground md:inline">{operator.operatorId}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[490px] max-h-[90vh] overflow-y-auto border-border bg-card/95 p-0 backdrop-blur"
      >
        <div className="flex items-center justify-between border-b border-border bg-background/40 px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Operator Profile
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            {operator.networkStatus}
          </span>
        </div>

        <div className="space-y-3 p-3.5">
          <Row
            icon={<Hash className="h-3 w-3" />}
            label="Operator ID"
            value={operator.operatorId}
            mono
          />
          <Row icon={<Hash className="h-3 w-3" />} label="Full Name" value={operator.fullName} />
          <Row
            icon={<Building2 className="h-3 w-3" />}
            label="Organization"
            value={operator.organization}
          />
          <Row
            icon={<Mail className="h-3 w-3" />}
            label="Operator Email"
            value={operator.email}
            mono
          />

          {/* Email Verification Status */}
          <EmailVerificationBanner verified={operator.emailVerified} />

          {/* Phone Verification Status */}
          <PhoneVerificationBanner
            verified={operator.phoneVerified}
            hasPhone={!!operator.phone}
            emailVerified={operator.emailVerified}
          />

          <Row
            icon={<MapPin className="h-3 w-3" />}
            label="Jurisdiction"
            value={`${operator.city} · ${operator.country}`}
          />

          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              Signer Address · Active Settlement Authority
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <code className="flex-1 truncate rounded-md border border-border bg-background/60 px-2 py-1 font-mono text-[11px] text-foreground">
                {operator.wallet.publicKey}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copy}
                className="h-7 px-2 font-mono text-[10px] uppercase tracking-widest"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              {maskAddress(operator.wallet.publicKey)} · ed25519 · {STELLAR_NETWORK_LABEL}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <KeyRound className="h-3 w-3" />
              Signer custody
            </div>
            <div className="mt-1 rounded-md border border-border bg-background/60 px-2 py-1.5 font-mono text-[11px] text-foreground">
              Backend custody · ed25519 · {operator.wallet.status}
            </div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              Secret seed is held by the EnergyPay backend. Settlement signing is performed
              server-side on {STELLAR_NETWORK_LABEL}.
            </div>
          </div>

          <Separator className="bg-border/60" />

          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Market Participant Roles
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {operator.roles.length === 0 && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  No roles provisioned
                </span>
              )}
              {operator.roles.map((r) => (
                <span
                  key={r}
                  className={`rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${ROLE_META[r].color.border} ${ROLE_META[r].color.bg} ${ROLE_META[r].color.text}`}
                >
                  {ROLE_META[r].label}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono uppercase tracking-widest">
            <Mini label="Access Level" value={operator.accessLevel.replace("_", " ")} />
            <Mini label="Network" value={operator.network || "Stellar"} />
            <Mini label="Funded" value={operator.funded ? "Yes" : "No"} />
            <Mini label="Connectivity" value="Horizon · OK" tone="success" />
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Reconciliation Permissions
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {operator.permissions.map((p) => (
                <span
                  key={p}
                  className="rounded-sm border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-background/40 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {useUiStore.getState().theme === "dark" ? (
                <Moon className="h-3 w-3" />
              ) : (
                <Sun className="h-3 w-3" />
              )}
              Interface Theme
            </span>
            <ThemeToggle />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-background/40 px-3 py-2">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <Activity className="h-3 w-3 text-success" />
            Session active
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="h-7 px-2 font-mono text-[10px] uppercase tracking-widest"
          >
            <LogOut className="h-3 w-3" /> Sign out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-0.5 truncate text-xs ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 text-[11px] ${tone === "success" ? "text-success" : "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

function EmailVerificationBanner({ verified }: { verified: boolean }) {
  const [sending, setSending] = useState(false);
  const setEmailVerified = useOperator((s) => s.setEmailVerified);

  if (verified) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-2.5 py-1.5">
        <MailCheck className="h-3.5 w-3.5 text-success" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-success">
          Email verified
        </span>
      </div>
    );
  }

  const handleResend = async () => {
    setSending(true);
    try {
      const res = await apiResendVerification();
      if (res.already_verified) {
        setEmailVerified(true);
        toast.success("Email already verified!");
      } else {
        toast.success("Verification email sent — check your inbox.");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to send verification email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 p-2.5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-warning">
          Email not verified
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Verify your email to appear on the Operational Grid and enable full settlement capabilities.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleResend}
        disabled={sending}
        className="mt-2 h-7 w-full font-mono text-[10px] uppercase tracking-widest"
      >
        {sending ? (
          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
        ) : (
          <Mail className="mr-1.5 h-3 w-3" />
        )}
        {sending ? "Sending…" : "Send Verification Email"}
      </Button>
    </div>
  );
}

function PhoneVerificationBanner({
  verified,
  hasPhone,
  emailVerified,
}: {
  verified: boolean;
  hasPhone: boolean;
  emailVerified: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const setPhoneVerified = useOperator((s) => s.setPhoneVerified);

  if (verified) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-2.5 py-1.5">
        <PhoneCall className="h-3.5 w-3.5 text-success" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-success">
          Phone verified
        </span>
      </div>
    );
  }

  if (!emailVerified) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2.5 py-1.5">
        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Phone verification · Verify email first
        </span>
      </div>
    );
  }

  if (!hasPhone) {
    return <PhoneRegisterForm />;
  }

  const handleSendCode = async () => {
    setSending(true);
    try {
      const res = await apiSendPhoneCode();
      if (res.already_verified) {
        setPhoneVerified(true);
        toast.success("Phone already verified!");
      } else {
        setCodeSent(true);
        toast.success("Verification code sent via WhatsApp.");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to send code.");
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (!code.trim()) return;
    setVerifying(true);
    try {
      await apiVerifyPhoneCode(code.trim());
      setPhoneVerified(true);
      toast.success("Phone verified successfully!");
      setCodeSent(false);
      setCode("");
    } catch (err) {
      toast.error((err as Error).message || "Invalid code.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 p-2.5">
      <div className="flex items-center gap-2">
        <Phone className="h-3.5 w-3.5 text-warning" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-warning">
          Phone not verified
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Verify your phone to be visible to other participants and enable settlements.
      </p>

      {!codeSent ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSendCode}
          disabled={sending}
          className="mt-2 h-7 w-full font-mono text-[10px] uppercase tracking-widest"
        >
          {sending ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <Phone className="mr-1.5 h-3 w-3" />
          )}
          {sending ? "Sending…" : "Send Verification Code"}
        </Button>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="h-7 flex-1 text-center font-mono text-sm tracking-[0.3em]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleVerify}
              disabled={verifying || code.length < 6}
              className="h-7 px-3 font-mono text-[10px] uppercase tracking-widest"
            >
              {verifying ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
            </Button>
          </div>
          <button
            type="button"
            onClick={handleSendCode}
            disabled={sending}
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary"
          >
            Resend code
          </button>
        </div>
      )}
    </div>
  );
}

function PhoneRegisterForm() {
  const [phone, setPhoneInput] = useState("");
  const [saving, setSaving] = useState(false);
  const setPhone = useOperator((s) => s.setPhone);

  const handleSave = async () => {
    const clean = phone.replace(/[^\d+]/g, "");
    if (clean.length < 8) {
      toast.error("Enter a valid phone number (min 8 digits).");
      return;
    }
    setSaving(true);
    try {
      await apiUpdatePhone(clean);
      setPhone(clean);
      toast.success("Phone number saved. You can now verify it.");
    } catch (err) {
      toast.error((err as Error).message || "Failed to save phone.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 p-2.5">
      <div className="flex items-center gap-2">
        <Phone className="h-3.5 w-3.5 text-warning" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-warning">
          No phone registered
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Add your phone number to proceed with verification.
      </p>
      <div className="mt-2 flex gap-2">
        <Input
          value={phone}
          onChange={(e) => setPhoneInput(e.target.value)}
          placeholder="+55 24 99999-0000"
          className="h-7 flex-1 font-mono text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={saving || phone.replace(/[^\d+]/g, "").length < 8}
          className="h-7 px-3 font-mono text-[10px] uppercase tracking-widest"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  return (
    <div className="flex gap-1">
      {(["dark", "light"] as Theme[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTheme(t)}
          className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 font-mono text-[9px] uppercase tracking-widest transition ${
            theme === t
              ? "border-primary/60 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
          }`}
        >
          {t === "dark" ? <Moon className="h-2.5 w-2.5" /> : <Sun className="h-2.5 w-2.5" />}
          {t}
        </button>
      ))}
    </div>
  );
}
