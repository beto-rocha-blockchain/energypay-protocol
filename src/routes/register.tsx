import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { stellarExpertAccount, STELLAR_NETWORK_LABEL, HORIZON_URL, IS_MAINNET } from "@/lib/stellar";
import {
  Zap,
  Building2,
  Mail,
  MapPin,
  Globe2,
  User,
  Lock,
  ShieldCheck,
  Activity,
  Terminal,
  Loader2,
  Check,
  ArrowRight,
  Factory,
  Coins,
  LineChart,
  Plug,
  Copy,
  KeyRound,
  Eye,
  EyeOff,
  Phone,
  Sun,
  Moon,
  ExternalLink,
  Droplets,
  Wind,
  Flame,
  Waves,
  Leaf,
  Atom,
  Recycle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useOperator, maskAddress, ROLE_META, ROLE_COLORS, type ParticipantRole } from "@/store/operator";
import { BrandBadge, BrandName } from "@/components/BrandLogo";
import { useUiStore, type Theme } from "@/store/ui";
import { toast } from "sonner";
import { safeErrorMessage } from "@/lib/safe-error";
import { apiResendVerification, apiSendPhoneCode, apiVerifyPhoneCode } from "@/lib/api";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

type Step = "form" | "provisioning" | "verify-email" | "verify-phone" | "success";

const ROLE_ICON: Record<ParticipantRole, React.ComponentType<{ className?: string }>> = {
  GENERATOR: Factory,
  SELLER: Coins,
  INVESTOR: LineChart,
  USER: Plug,
  UTILITY: Building2,
};

const PROVISIONING_STEPS = [
  "Validating institutional credentials",
  "Allocating operator identity",
  "Generating ed25519 keypair",
  "Binding settlement address to operator",
  IS_MAINNET ? "Verifying settlement account funding" : "Funding settlement account · Friendbot",
  "Registering market participant roles",
  "Publishing identity to Settlement Network",
];

function RegisterPage() {
  const navigate = useNavigate();
  const isAuthenticated = useOperator((s) => s.isAuthenticated);
  const register = useOperator((s) => s.register);
  const operator = useOperator((s) => s.operator);

  const [step, setStep] = useState<Step>("form");
  const [progress, setProgress] = useState(0);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [organization, setOrganization] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [roles, setRoles] = useState<ParticipantRole[]>([]);
  const [fund, setFund] = useState(true);
  const [coords, setCoordsLocal] = useState<
    { lat: number; lng: number; source: "GPS" | "MANUAL" } | undefined
  >(undefined);
  const [geoStatus, setGeoStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [walletMode, setWalletMode] = useState<"generate" | "link">("generate");
  const [existingPublicKey, setExistingPublicKey] = useState("");
  const [existingSecretKey, setExistingSecretKey] = useState("");
  const [showExistingSecret, setShowExistingSecret] = useState(false);
  const [energyType, setEnergyType] = useState<
    "SOLAR" | "HYDRO" | "SMALL_HYDRO" | "WIND" | "BIOMASS" | "NATURAL_GAS" | "NUCLEAR" | "THERMAL" | "COGENERATION"
  >("SOLAR");

  // If a session already exists when landing on /register fresh (no in-flight
  // provisioning), send the operator to the dashboard. Never redirect once we
  // are mid-flow or showing the success screen — that would clobber the
  // provisioned identity view.
  // Disabled for demo stability.
// Do not auto-redirect after session hydration or registration.
useEffect(() => {
  // Intentionally empty.
}, []);

  const toggleRole = (r: ParticipantRole) =>
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const selectAll = () => setRoles(["GENERATOR", "SELLER", "INVESTOR", "USER"]);

  // Basic phone validation: must have country code + at least 8 digits
  const phoneValid = useMemo(() => {
    const digits = phone.replace(/[^\d]/g, "");
    return phone.trim().startsWith("+") && digits.length >= 8;
  }, [phone]);

  const linkValid = useMemo(() => {
    if (walletMode !== "link") return true;
    const pubOk =
      existingPublicKey.trim().startsWith("G") && existingPublicKey.trim().length === 56;
    const secOk =
      existingSecretKey.trim().startsWith("S") && existingSecretKey.trim().length === 56;
    return pubOk && secOk;
  }, [walletMode, existingPublicKey, existingSecretKey]);

  const formValid = useMemo(
    () =>
      fullName.trim() &&
      email.trim() &&
      password.length >= 6 &&
      organization.trim() &&
      country.trim() &&
      city.trim() &&
      roles.length > 0 &&
      phoneValid &&
      linkValid,
    [fullName, email, password, organization, country, city, roles, phoneValid, linkValid],
  );

  const provisioningSteps = useMemo(
    () =>
      PROVISIONING_STEPS.map((s) =>
        s === "Generating ed25519 keypair" && walletMode === "link"
          ? "Importing existing ed25519 keypair"
          : s,
      ),
    [walletMode],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid) {
      toast.error("Operational credentials incomplete.");
      return;
    }
    setProvisionError(null);
    setStep("provisioning");
    setProgress(0);
    for (let i = 0; i < provisioningSteps.length; i++) {
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 350));
      setProgress(i + 1);
    }
    try {
      await register({
        email,
        password,
        fullName,
        phone: phone.trim() || undefined,
        organization,
        country,
        city,
        roles,
        fund,
        coords,
        energyType: roles.includes("GENERATOR") ? energyType : undefined,
        walletMode,
        existingPublicKey: walletMode === "link" ? existingPublicKey : undefined,
        existingSecretKey: walletMode === "link" ? existingSecretKey : undefined,
      });
      setProvisionError(null);
      setStep("verify-email");
    } catch (err) {
      const reason = safeErrorMessage(err, "Settlement Network unreachable.");
      setProvisionError(reason);
      // Do NOT clear session, do NOT redirect to /login — keep operator on
      // the form with an inline institutional error banner.
      setStep("form");
    }
  };

  const requestGeo = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("denied");
      toast.error("Geolocation unavailable on this device.");
      return;
    }
    setGeoStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoordsLocal({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: "GPS" });
        setGeoStatus("granted");
        toast.success("Operational coordinates bound to identity.");
      },
      () => {
        setGeoStatus("denied");
        toast.error("GPS denied — provide a region manually.");
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const applyManual = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setCoordsLocal({ lat, lng, source: "MANUAL" });
      toast.success("Manual region recorded.");
    } else {
      toast.error("Enter valid latitude/longitude.");
    }
  };

  return (
    <div className="grid min-h-screen w-full place-items-center px-4 py-8">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_1.15fr] lg:items-stretch">
        {/* Left: institutional context */}
        <Card className="hidden flex-col justify-between overflow-hidden border-border bg-card/60 p-6 lg:flex">
          <div>
            <div className="flex items-center gap-2">
              <BrandBadge size="md" />
              <div className="leading-tight" style={{ gap: 3, display: "flex", flexDirection: "column" }}>
                <BrandName size="md" />
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Clearing &amp; Settlement Infrastructure
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Network Provisioning · Pilot Environment
              </div>
              <h1 className="font-display text-2xl font-semibold leading-tight">
                Provision a settlement
                <br />
                participant identity.
              </h1>
              <p className="mt-2 max-w-sm text-xs text-muted-foreground">
                Onboarding mints an operational identity, binds an ed25519 settlement keypair, and
                registers your market participant roles on the Stellar settlement rails.
              </p>
            </div>

            <Separator className="my-6 bg-border/60" />

            <ul className="space-y-2.5 text-xs">
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-success" />
                <span>
                  <span className="font-mono text-foreground">Operational identity</span> · scoped
                  to clearing &amp; reconciliation
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Terminal className="mt-0.5 h-3.5 w-3.5 text-accent" />
                <span>
                  <span className="font-mono text-foreground">Settlement keypair</span> · ed25519 ·
                  {IS_MAINNET ? "mainnet custody" : "funded via Friendbot"}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Activity className="mt-0.5 h-3.5 w-3.5 text-success" />
                <span>
                  <span className="font-mono text-foreground">Role provisioning</span> · Generator ·
                  Seller · Investor · Consumer
                </span>
              </li>
            </ul>

            <div className="mt-6 rounded-md border border-border bg-background/40 p-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Network</span>
                <span className="flex items-center gap-1.5 text-success">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> {STELLAR_NETWORK_LABEL} · Nominal
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span>Horizon</span>
                <span className="text-foreground">{HORIZON_URL.replace("https://", "")}</span>
              </div>
              {!IS_MAINNET && (
              <div className="mt-1.5 flex items-center justify-between">
                <span>Friendbot</span>
                <span className="text-foreground">friendbot.stellar.org</span>
              </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <span>EnergyPay Clearing · v0.4.2</span>
            <Link to="/login" className="text-foreground hover:text-primary">
              Operator Access →
            </Link>
          </div>
        </Card>

        {/* Right: provisioning terminal */}
        <Card className="overflow-hidden border-border bg-card/70">
          <div className="flex items-center justify-between border-b border-border bg-background/40 px-4 py-2.5">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Settlement Network ·
              Provisioning Terminal
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              SECURE · TLS · ed25519
            </div>
          </div>

          {step === "form" && (
            <form onSubmit={submit} className="space-y-5 p-5">
              {provisionError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-destructive">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
                      Provisioning Failed · Settlement Rail
                    </span>
                    <button
                      type="button"
                      onClick={() => setProvisionError(null)}
                      className="text-destructive/80 hover:text-destructive"
                    >
                      DISMISS
                    </button>
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] text-foreground break-words">
                    {provisionError}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                    Session preserved. Re-submit when the backend is reachable — no operator state
                    was cleared.
                  </div>
                </div>
              )}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  § 01 · Operator Credentials
                </div>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <Field label="Full Name" icon={<User className="h-3.5 w-3.5" />}>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Maria L. Andrade"
                      className="h-9 pl-8 font-mono text-xs"
                    />
                  </Field>
                  <Field label="Operator Email" icon={<Mail className="h-3.5 w-3.5" />}>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="operator@clearing-desk.com"
                      className="h-9 pl-8 font-mono text-xs"
                    />
                  </Field>
                  <Field
                    label="Phone Number *"
                    icon={<Phone className="h-3.5 w-3.5" />}
                    hint="Required for 2FA. Include country code, e.g. +55 11 99999-9999"
                  >
                    <Input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+55 11 9 0000-0000"
                      className={cn(
                        "h-9 pl-8 font-mono text-xs",
                        phone && !phoneValid && "border-destructive/60",
                      )}
                    />
                  </Field>
                  {phone && !phoneValid && (
                    <p className="-mt-1 font-mono text-[10px] text-destructive">
                      Include country code — e.g. +55 11 99999-9999
                    </p>
                  )}
                  <Field
                    label="Password"
                    icon={<Lock className="h-3.5 w-3.5" />}
                    className="md:col-span-2"
                  >
                    <Input
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
                      {showPw ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </Field>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  § 02 · Organization &amp; Jurisdiction
                </div>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  <Field
                    label="Organization"
                    icon={<Building2 className="h-3.5 w-3.5" />}
                    className="md:col-span-3"
                  >
                    <Input
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="Treasury · Energy Trading Desk"
                      className="h-9 pl-8 font-mono text-xs"
                    />
                  </Field>
                  <Field label="Country" icon={<Globe2 className="h-3.5 w-3.5" />}>
                    <Input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Brazil"
                      className="h-9 pl-8 font-mono text-xs"
                    />
                  </Field>
                  <Field
                    label="City"
                    icon={<MapPin className="h-3.5 w-3.5" />}
                    className="md:col-span-2"
                  >
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="São Paulo"
                      className="h-9 pl-8 font-mono text-xs"
                    />
                  </Field>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    § 02b · Operational Geolocation · Optional
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {coords
                      ? `${coords.source} · BOUND`
                      : geoStatus === "denied"
                        ? "GPS DENIED"
                        : "UNBOUND"}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
                  <div className="rounded-md border border-border bg-background/40 p-3">
                    <div className="font-mono text-[11px] text-foreground">
                      Bind operational coordinates to your settlement identity
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      Used for grid map placement &amp; regional liquidity attribution. Coordinates
                      remain session-scoped and are never shared with counterparties.
                    </div>
                    {coords && (
                      <div className="mt-2 font-mono text-[10px] text-success">
                        LAT {coords.lat.toFixed(4)} · LNG {coords.lng.toFixed(4)}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={requestGeo}
                    className="h-9 self-stretch font-mono text-[10px] uppercase tracking-widest md:w-44"
                  >
                    {geoStatus === "requesting" ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" /> Requesting…
                      </>
                    ) : coords?.source === "GPS" ? (
                      <>
                        <Check className="h-3 w-3" /> GPS Bound
                      </>
                    ) : (
                      <>
                        <MapPin className="h-3 w-3" /> Capture GPS
                      </>
                    )}
                  </Button>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <Input
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    placeholder="Manual Latitude (e.g. -23.55)"
                    className="h-9 font-mono text-xs"
                  />
                  <Input
                    value={manualLng}
                    onChange={(e) => setManualLng(e.target.value)}
                    placeholder="Manual Longitude (e.g. -46.63)"
                    className="h-9 font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyManual}
                    className="h-9 font-mono text-[10px] uppercase tracking-widest"
                  >
                    Apply Region
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    § 03 · Market Participant Roles
                  </div>
                  <button
                    type="button"
                    onClick={selectAll}
                    className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-primary"
                  >
                    Enable all capabilities →
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(Object.keys(ROLE_META) as ParticipantRole[]).map((r) => {
                    const Icon = ROLE_ICON[r];
                    const active = roles.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleRole(r)}
                        className={`group relative overflow-hidden rounded-md border p-3 text-left transition-all duration-200 ${
                          active
                            ? `${ROLE_COLORS[r].border} ${ROLE_COLORS[r].bg}`
                            : "border-border bg-background/40 hover:border-border/80 hover:bg-background/60"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                              active
                                ? `${ROLE_COLORS[r].border} ${ROLE_COLORS[r].bg} ${ROLE_COLORS[r].text}`
                                : "border-border bg-background/60 text-muted-foreground"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className={`font-mono text-[11px] uppercase tracking-widest ${active ? ROLE_COLORS[r].text : "text-foreground"}`}>
                                {ROLE_META[r].label}
                              </div>
                              <div
                                className={`flex h-4 w-4 items-center justify-center rounded-sm border transition ${
                                  active
                                    ? `${ROLE_COLORS[r].border} ${ROLE_COLORS[r].bg} ${ROLE_COLORS[r].text}`
                                    : "border-border bg-background/60"
                                }`}
                              >
                                {active && <Check className="h-3 w-3" />}
                              </div>
                            </div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {ROLE_META[r].tagline}
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {ROLE_META[r].capabilities.map((c) => (
                                <span
                                  key={c}
                                  className="rounded-sm border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                  {roles.length === 0 && "Select one or more institutional capabilities."}
                  {roles.length === 1 && `${roles.length} capability scoped to identity.`}
                  {roles.length > 1 && `${roles.length} capabilities scoped to identity.`}
                </div>
              </div>

              {/* § 03b · Generation Source — only visible when GENERATOR role is active */}
              {roles.includes("GENERATOR") && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    § 03b · Generation Source
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(
                      [
                        { type: "SOLAR",       label: "Solar PV",      Icon: Sun      },
                        { type: "HYDRO",       label: "Hydroelectric", Icon: Droplets },
                        { type: "SMALL_HYDRO", label: "Small Hydro",   Icon: Waves    },
                        { type: "WIND",        label: "Wind",          Icon: Wind     },
                        { type: "BIOMASS",     label: "Biomass",       Icon: Leaf     },
                        { type: "NATURAL_GAS", label: "Natural Gas",   Icon: Flame    },
                        { type: "NUCLEAR",     label: "Nuclear",       Icon: Atom     },
                        { type: "THERMAL",     label: "Thermal",       Icon: Factory  },
                        { type: "COGENERATION",label: "Cogeneration",  Icon: Recycle  },
                      ] as const
                    ).map(({ type, label, Icon }) => {
                      const active = energyType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setEnergyType(type)}
                          className={`group flex flex-col items-center gap-1.5 rounded-md border p-3 text-center transition-all duration-200 ${
                            active
                              ? "border-success/50 bg-success/10 text-success"
                              : "border-border bg-background/40 text-muted-foreground hover:border-border/80 hover:bg-background/60"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="font-mono text-[10px] uppercase tracking-widest leading-tight">
                            {label}
                          </span>
                          {active && <Check className="h-3 w-3" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                    Primary energy source used for generation and settlement.
                  </div>
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-background/40 p-3 text-xs">
                <input
                  type="checkbox"
                  checked={fund}
                  onChange={(e) => setFund(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-[var(--primary)]"
                />
                <span>
                  <span className="block font-mono uppercase tracking-widest text-foreground">
                    Fund settlement account on {STELLAR_NETWORK_LABEL}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {IS_MAINNET
                      ? "Provisions a Stellar Mainnet account for settlement operations."
                      : "Provisions a Stellar Testnet account funded via Friendbot for settlement operations."}
                  </span>
                </span>
              </label>

              <ThemeSelector />

              {/* § 04b · Settlement Wallet */}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  § 04b · Settlement Wallet
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(
                    [
                      {
                        id: "generate" as const,
                        icon: Zap,
                        label: "Generate New Account",
                        desc: "Platform generates and manages your ed25519 keypair",
                      },
                      {
                        id: "link" as const,
                        icon: KeyRound,
                        label: "Link Existing Account",
                        desc: "Connect your existing Stellar wallet to this identity",
                      },
                    ] as const
                  ).map((opt) => {
                    const active = walletMode === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setWalletMode(opt.id)}
                        className={`group relative overflow-hidden rounded-md border p-3 text-left transition-all duration-200 ${
                          active
                            ? "border-primary/60 bg-primary/5 shadow-[var(--shadow-glow)]"
                            : "border-border bg-background/40 hover:border-border/80 hover:bg-background/60"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                              active
                                ? "border-primary/50 bg-primary/10 text-primary"
                                : "border-border bg-background/60 text-muted-foreground"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className="font-mono text-[11px] uppercase tracking-widest text-foreground">
                                {opt.label}
                              </div>
                              <div
                                className={`flex h-4 w-4 items-center justify-center rounded-full border transition ${
                                  active
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-background/60"
                                }`}
                              >
                                {active && <Check className="h-3 w-3" />}
                              </div>
                            </div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {opt.desc}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {walletMode === "generate" && (
                  <div className="mt-2 rounded-md border border-border bg-background/40 p-2.5">
                    <p className="font-mono text-[10px] text-muted-foreground">
                      A new ed25519 keypair will be generated and held by the EnergyPay backend.
                      Your public key is always accessible from your profile. The frontend never
                      receives the secret key.
                    </p>
                  </div>
                )}

                {walletMode === "link" && (
                  <div className="mt-3 space-y-3 rounded-md border border-border bg-background/40 p-3">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Existing Wallet Credentials
                    </div>
                    <Field
                      label="Stellar Public Key (G…)"
                      icon={<KeyRound className="h-3.5 w-3.5" />}
                    >
                      <Input
                        value={existingPublicKey}
                        onChange={(e) => setExistingPublicKey(e.target.value.trim())}
                        placeholder="GABC… · 56 characters"
                        className="h-9 pl-8 font-mono text-xs"
                        maxLength={58}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </Field>
                    {existingPublicKey &&
                      (existingPublicKey.length !== 56 || !existingPublicKey.startsWith("G")) && (
                        <p className="-mt-1 font-mono text-[10px] text-destructive">
                          Must be a 56-character Stellar public key starting with G
                        </p>
                      )}
                    <Field label="Secret Key (S…)" icon={<Lock className="h-3.5 w-3.5" />}>
                      <Input
                        type={showExistingSecret ? "text" : "password"}
                        value={existingSecretKey}
                        onChange={(e) => setExistingSecretKey(e.target.value.trim())}
                        placeholder="SABC… · 56 characters"
                        className="h-9 pl-8 pr-9 font-mono text-xs tracking-widest"
                        maxLength={58}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        onClick={() => setShowExistingSecret((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showExistingSecret ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </Field>
                    {existingSecretKey &&
                      (existingSecretKey.length !== 56 || !existingSecretKey.startsWith("S")) && (
                        <p className="-mt-1 font-mono text-[10px] text-destructive">
                          Must be a 56-character Stellar secret key starting with S
                        </p>
                      )}
                    <div className="rounded-md border border-warning/40 bg-warning/5 p-2.5">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-warning">
                        ⚠ Key Custody Notice
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Your secret key will be stored by the EnergyPay backend to enable managed
                        operations such as trustline creation and settlement execution. Only link a
                        wallet you control and trust the platform to operate on your behalf.
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                  {walletMode === "generate"
                    ? "Backend-managed keypair · ed25519 · funded on Stellar Network"
                    : "Self-custody import · provide public and secret keys to link"}
                </div>
              </div>

              <Button
                type="submit"
                disabled={!formValid}
                className="h-10 w-full font-mono text-xs uppercase tracking-widest"
              >
                Provision Settlement Identity
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>

              <div className="flex items-center justify-between border-t border-border pt-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <span>Already provisioned?</span>
                <Link to="/login" className="text-foreground hover:text-primary">
                  Operator Access →
                </Link>
              </div>
            </form>
          )}

          {step === "provisioning" && (
            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[11px] uppercase tracking-widest text-foreground">
                  Provisioning Settlement Identity
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {progress}/{provisioningSteps.length}
                </div>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-border/60">
                <div
                  className="h-full bg-[image:var(--gradient-primary)] transition-all duration-300"
                  style={{ width: `${(progress / provisioningSteps.length) * 100}%` }}
                />
              </div>
              <div className="space-y-1.5 rounded-md border border-border bg-background/60 p-3 font-mono text-[11px]">
                {provisioningSteps.map((s, i) => {
                  const done = i < progress;
                  const active = i === progress;
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <span className="w-7 text-muted-foreground">
                        [{String(i + 1).padStart(2, "0")}]
                      </span>
                      {done ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : active ? (
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      ) : (
                        <span className="h-3 w-3 rounded-full border border-border" />
                      )}
                      <span
                        className={
                          done
                            ? "text-foreground"
                            : active
                              ? "text-foreground"
                              : "text-muted-foreground"
                        }
                      >
                        {s}
                      </span>
                      {done && <span className="ml-auto text-[10px] text-success">OK</span>}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <span>Network: {STELLAR_NETWORK_LABEL}</span>
                <span className="flex items-center gap-1.5 text-success">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />{" "}
                  Provisioning
                </span>
              </div>
            </div>
          )}

          {step === "verify-email" && (
            <VerifyEmailStep onVerified={() => setStep("verify-phone")} />
          )}

          {step === "verify-phone" && (
            <VerifyPhoneStep
              hasPhone={!!phone.trim()}
              onVerified={() => setStep("success")}
            />
          )}

          {step === "success" && operator && (
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-success/40 bg-success/10 text-success">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-widest text-success">
                    Settlement Identity Active
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {operator.operatorId} · {operator.organization}
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border bg-background/60 p-3">
                <KeyRow
                  label="Public Key"
                  value={operator.wallet.publicKey}
                  icon={<ShieldCheck className="h-3 w-3" />}
                />
                <Separator className="my-2 bg-border/60" />
                <div className="rounded-md border border-border bg-background/40 px-2 py-1.5">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Signer custody
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-foreground">
                    {walletMode === "link" ? "Linked wallet" : "Backend custody"} · ed25519 ·{" "}
                    {operator.wallet.status}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {walletMode === "link"
                      ? "Existing Stellar wallet linked to this identity. Secret key held by EnergyPay backend for managed operations."
                      : "Secret seed is held by the EnergyPay backend. The frontend never receives the secret key."}
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border bg-background/60 p-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Network Settlement Receipt
                </div>
                <div className="mt-2 grid gap-2">
                  <KeyRow
                    label="Provisioning Tx Hash"
                    value={operator.provisioningTxHash || "PENDING · awaiting backend confirmation"}
                    icon={<Terminal className="h-3 w-3" />}
                  />
                  <div className="grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-widest">
                    <Mini
                      label="Ledger Sequence"
                      value={
                        operator.provisioningLedger != null
                          ? `#${operator.provisioningLedger}`
                          : "PENDING"
                      }
                      tone={operator.provisioningLedger != null ? "success" : undefined}
                    />
                    <Mini
                      label="Settlement Status"
                      value={(
                        operator.settlementStatus ||
                        operator.wallet.status ||
                        "PROVISIONED"
                      ).toUpperCase()}
                      tone={operator.wallet.funded ? "success" : undefined}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-widest">
                <Mini
                  label="Network"
                  value={operator.network || STELLAR_NETWORK_LABEL}
                  tone="success"
                />
                <Mini
                  label="Funded"
                  value={operator.wallet.funded ? (IS_MAINNET ? "Yes" : "Yes · Friendbot") : (IS_MAINNET ? "No · Pending" : "No · Friendbot failed")}
                  tone={operator.wallet.funded ? "success" : undefined}
                />
                <Mini label="Roles" value={operator.roles.length.toString()} />
                <Mini label="Address" value={maskAddress(operator.wallet.publicKey)} />
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Provisioned Capabilities
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {operator.roles.map((r) => (
                    <span
                      key={r}
                      className="rounded-sm border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary"
                    >
                      {ROLE_META[r].label}
                    </span>
                  ))}
                </div>
              </div>

              <a
                href={stellarExpertAccount(operator.wallet.publicKey)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-foreground transition hover:border-primary/50 hover:text-primary"
              >
                <span>Audit account on Stellar Expert</span>
                <ArrowRight className="h-3 w-3" />
              </a>

              <Button
                onClick={() => navigate({ to: "/ops" })}
                className="h-10 w-full font-mono text-xs uppercase tracking-widest"
              >
                Enter Settlement Control Room
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ─── Verify Email Step ─── */
function VerifyEmailStep({ onVerified }: { onVerified: () => void }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);

  const resend = async () => {
    setSending(true);
    try {
      const result = await apiResendVerification();
      setSent(true);
      if (result.dev_verify_url) {
        setDevVerifyUrl(result.dev_verify_url);
      } else {
        toast.success("Verification email sent — check your inbox.");
      }
    } catch (e) {
      toast.error(safeErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
          <Mail className="h-4 w-4" />
        </div>
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-foreground">
            Verify Your Email
          </div>
          <div className="text-[10px] text-muted-foreground">
            We sent a verification link to your email address.
          </div>
        </div>
      </div>

      {devVerifyUrl && (
        <div className="rounded-md border border-warning/40 bg-warning/5 p-3">
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-warning">
            ⚠ Dev mode — email not configured
          </p>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Resend blocked the email. Open this link directly to verify:
          </p>
          <a
            href={devVerifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 break-all font-mono text-[11px] text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            {devVerifyUrl}
          </a>
        </div>
      )}

      <div className="rounded-md border border-border bg-background/40 p-4 text-center space-y-3">
        <p className="text-xs text-muted-foreground">
          Click the link in your email to verify your account. After verifying, click the button below to continue.
        </p>
        <div className="flex flex-col gap-2">
          <Button size="sm" onClick={onVerified}>
            <Check className="mr-1.5 h-3.5 w-3.5" />
            I've Verified My Email
          </Button>
          <Button variant="ghost" size="sm" onClick={resend} disabled={sending || sent}>
            {sending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Mail className="mr-1.5 h-3.5 w-3.5" />}
            {sent ? "Email Sent" : "Resend Verification Email"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Verify Phone Step ─── */
function VerifyPhoneStep({
  hasPhone,
  onVerified,
}: {
  hasPhone: boolean;
  onVerified: () => void;
}) {
  const [phoneInput, setPhoneInput] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(hasPhone);

  const savePhone = async () => {
    if (!phoneInput.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/auth/update-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getSession()?.token ?? ""}`,
        },
        body: JSON.stringify({ phone: phoneInput.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save phone");
      setPhoneSaved(true);
      toast.success("Phone number saved.");
    } catch (e) {
      toast.error(safeErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const sendCode = async () => {
    setSending(true);
    try {
      const result = await apiSendPhoneCode();
      setCodeSent(true);
      // Dev fallback: Twilio not configured — code returned in response
      if (result.dev_code) {
        setDevCode(result.dev_code);
      } else {
        toast.success("Verification code sent via WhatsApp.");
      }
    } catch (e) {
      toast.error(safeErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6) return;
    setVerifying(true);
    try {
      await apiVerifyPhoneCode(code);
      toast.success("Phone verified!");
      onVerified();
    } catch (e) {
      toast.error(safeErrorMessage(e));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
          <Phone className="h-4 w-4" />
        </div>
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-foreground">
            Verify Your Phone
          </div>
          <div className="text-[10px] text-muted-foreground">
            We'll send a 6-digit code via WhatsApp.
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-background/40 p-4 space-y-3">
        {!phoneSaved ? (
          <div className="space-y-2">
            <Label className="text-xs">Phone Number (with country code)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="+55 11 99999-9999"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="flex-1 font-mono text-xs"
              />
              <Button size="sm" onClick={savePhone} disabled={sending || !phoneInput.trim()}>
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        ) : !codeSent ? (
          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Click below to receive a verification code on your WhatsApp.
            </p>
            <Button size="sm" onClick={sendCode} disabled={sending}>
              {sending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Phone className="mr-1.5 h-3.5 w-3.5" />}
              Send WhatsApp Code
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {devCode && (
              <div className="rounded-md border border-warning/40 bg-warning/5 p-2.5">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-warning">
                  ⚠ Dev mode — Twilio not configured
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Your code is:{" "}
                  <span className="font-mono font-bold text-foreground">{devCode}</span>
                </p>
              </div>
            )}
            <Label className="text-xs">Enter 6-digit code</Label>
            <div className="flex gap-2">
              <Input
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="flex-1 font-mono text-center text-lg tracking-[0.3em]"
                autoFocus
              />
              <Button size="sm" onClick={verify} disabled={verifying || code.length !== 6}>
                {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={sendCode} disabled={sending}>
              {sending ? "Sending…" : "Resend Code"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
  className = "",
  hint,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      {hint && (
        <p className="font-mono text-[9px] text-muted-foreground/70">{hint}</p>
      )}
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}

function KeyRow({
  label,
  value,
  icon,
  trailing,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <code className="flex-1 truncate rounded-md border border-border bg-background/60 px-2 py-1 font-mono text-[11px] text-foreground">
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copy}
          className="h-6 px-2 font-mono text-[10px] uppercase tracking-widest"
        >
          <Copy className="h-3 w-3" />
        </Button>
        {trailing}
      </div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-2 py-1.5">
      <div className="text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 text-[11px] ${tone === "success" ? "text-success" : "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

function ThemeSelector() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        § 04 · Interface Theme
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(
          [
            { id: "dark" as Theme, icon: Moon, label: "Dark", desc: "Institutional dark mode — reduced eye strain for control room environments" },
            { id: "light" as Theme, icon: Sun, label: "Light", desc: "Clean light interface — high contrast for daylight and presentation use" },
          ] as const
        ).map((opt) => {
          const active = theme === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              className={`group relative overflow-hidden rounded-md border p-3 text-left transition-all duration-200 ${
                active
                  ? "border-primary/60 bg-primary/5 shadow-[var(--shadow-glow)]"
                  : "border-border bg-background/40 hover:border-border/80 hover:bg-background/60"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                    active
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-background/60 text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-foreground">
                      {opt.label}
                    </div>
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded-full border transition ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background/60"
                      }`}
                    >
                      {active && <Check className="h-3 w-3" />}
                    </div>
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {opt.desc}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 font-mono text-[10px] text-muted-foreground">
        You can change the theme anytime from the Operator Profile menu.
      </div>
    </div>
  );
}
