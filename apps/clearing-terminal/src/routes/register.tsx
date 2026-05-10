import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Zap, Building2, Mail, MapPin, Globe2, User, Lock, ShieldCheck,
  Activity, Terminal, Loader2, Check, ArrowRight, Factory, Coins, LineChart, Plug,
  Copy, KeyRound, Eye, EyeOff,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  useOperator, maskAddress, ROLE_META, type ParticipantRole,
} from "@/store/operator";
import { toast } from "sonner";
import { safeErrorMessage } from "@/lib/safe-error";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

type Step = "form" | "provisioning" | "success";

const ROLE_ICON: Record<ParticipantRole, React.ComponentType<{ className?: string }>> = {
  GENERATOR: Factory,
  SELLER: Coins,
  INVESTOR: LineChart,
  USER: Plug,
};

const PROVISIONING_STEPS = [
  "Validating institutional credentials",
  "Allocating operator identity",
  "Generating ed25519 keypair",
  "Binding settlement address to operator",
  "Funding settlement account · Friendbot",
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
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [organization, setOrganization] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [roles, setRoles] = useState<ParticipantRole[]>([]);
  const [fund, setFund] = useState(true);
  const [coords, setCoordsLocal] = useState<{ lat: number; lng: number; source: "GPS" | "MANUAL" } | undefined>(undefined);
  const [geoStatus, setGeoStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");

  // If a session already exists when landing on /register fresh (no in-flight
  // provisioning), send the operator to the dashboard. Never redirect once we
  // are mid-flow or showing the success screen — that would clobber the
  // provisioned identity view.
  useEffect(() => {
    if (isAuthenticated && step === "form" && !provisionError) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, step, provisionError, navigate]);

  const toggleRole = (r: ParticipantRole) =>
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const selectAll = () =>
    setRoles(["GENERATOR", "SELLER", "INVESTOR", "USER"]);

  const formValid = useMemo(
    () =>
      fullName.trim() &&
      email.trim() &&
      password.length >= 6 &&
      organization.trim() &&
      country.trim() &&
      city.trim() &&
      roles.length > 0,
    [fullName, email, password, organization, country, city, roles],
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
    for (let i = 0; i < PROVISIONING_STEPS.length; i++) {
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 350));
      setProgress(i + 1);
    }
    try {
      await register({ email, password, fullName, organization, country, city, roles, fund, coords });
      setProvisionError(null);
      setStep("success");
    } catch (err) {
  const reason = safeErrorMessage(err);      setProvisionError(reason);
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
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
                <Zap className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">EnergyPay</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Clearing & Settlement Infrastructure
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Network Provisioning · Pilot Environment
              </div>
              <h1 className="font-display text-2xl font-semibold leading-tight">
                Provision a settlement<br />participant identity.
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
                <span><span className="font-mono text-foreground">Operational identity</span> · scoped to clearing &amp; reconciliation</span>
              </li>
              <li className="flex items-start gap-2">
                <Terminal className="mt-0.5 h-3.5 w-3.5 text-accent" />
                <span><span className="font-mono text-foreground">Settlement keypair</span> · ed25519 · funded via Friendbot</span>
              </li>
              <li className="flex items-start gap-2">
                <Activity className="mt-0.5 h-3.5 w-3.5 text-success" />
                <span><span className="font-mono text-foreground">Role provisioning</span> · Generator · Seller · Investor · User</span>
              </li>
            </ul>

            <div className="mt-6 rounded-md border border-border bg-background/40 p-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Network</span>
                <span className="flex items-center gap-1.5 text-success">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Stellar Testnet · Nominal
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span>Horizon</span><span className="text-foreground">horizon-testnet.stellar.org</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span>Friendbot</span><span className="text-foreground">friendbot.stellar.org</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <span>EnergyPay Clearing · v0.4.2</span>
            <Link to="/login" className="text-foreground hover:text-primary">Operator Access →</Link>
          </div>
        </Card>

        {/* Right: provisioning terminal */}
        <Card className="overflow-hidden border-border bg-card/70">
          <div className="flex items-center justify-between border-b border-border bg-background/40 px-4 py-2.5">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Settlement Network · Provisioning Terminal
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">SECURE · TLS · ed25519</div>
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
                    <button type="button" onClick={() => setProvisionError(null)} className="text-destructive/80 hover:text-destructive">DISMISS</button>
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] text-foreground break-words">{provisionError}</div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground">Session preserved. Re-submit when the backend is reachable — no operator state was cleared.</div>
                </div>
              )}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  § 01 · Operator Credentials
                </div>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <Field label="Full Name" icon={<User className="h-3.5 w-3.5" />}>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)}
                      placeholder="Maria L. Andrade" className="h-9 pl-8 font-mono text-xs" />
                  </Field>
                  <Field label="Operator Email" icon={<Mail className="h-3.5 w-3.5" />}>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="operator@clearing-desk.com" className="h-9 pl-8 font-mono text-xs" />
                  </Field>
                  <Field label="Password" icon={<Lock className="h-3.5 w-3.5" />} className="md:col-span-2">
                    <Input type={showPw ? "text" : "password"} value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••" className="h-9 pl-8 pr-9 font-mono text-xs tracking-widest" />
                    <button type="button" onClick={() => setShowPw((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </Field>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  § 02 · Organization &amp; Jurisdiction
                </div>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  <Field label="Organization" icon={<Building2 className="h-3.5 w-3.5" />} className="md:col-span-3">
                    <Input value={organization} onChange={(e) => setOrganization(e.target.value)}
                      placeholder="Treasury · Energy Trading Desk" className="h-9 pl-8 font-mono text-xs" />
                  </Field>
                  <Field label="Country" icon={<Globe2 className="h-3.5 w-3.5" />}>
                    <Input value={country} onChange={(e) => setCountry(e.target.value)}
                      placeholder="Brazil" className="h-9 pl-8 font-mono text-xs" />
                  </Field>
                  <Field label="City" icon={<MapPin className="h-3.5 w-3.5" />} className="md:col-span-2">
                    <Input value={city} onChange={(e) => setCity(e.target.value)}
                      placeholder="São Paulo" className="h-9 pl-8 font-mono text-xs" />
                  </Field>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    § 02b · Operational Geolocation · Optional
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {coords ? `${coords.source} · BOUND` : geoStatus === "denied" ? "GPS DENIED" : "UNBOUND"}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
                  <div className="rounded-md border border-border bg-background/40 p-3">
                    <div className="font-mono text-[11px] text-foreground">
                      Bind operational coordinates to your settlement identity
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      Used for grid map placement &amp; regional liquidity attribution. Coordinates remain
                      session-scoped and are never shared with counterparties.
                    </div>
                    {coords && (
                      <div className="mt-2 font-mono text-[10px] text-success">
                        LAT {coords.lat.toFixed(4)} · LNG {coords.lng.toFixed(4)}
                      </div>
                    )}
                  </div>
                  <Button type="button" variant="outline" onClick={requestGeo}
                    className="h-9 self-stretch font-mono text-[10px] uppercase tracking-widest md:w-44">
                    {geoStatus === "requesting" ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> Requesting…</>
                    ) : coords?.source === "GPS" ? (
                      <><Check className="h-3 w-3" /> GPS Bound</>
                    ) : (
                      <><MapPin className="h-3 w-3" /> Capture GPS</>
                    )}
                  </Button>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <Input value={manualLat} onChange={(e) => setManualLat(e.target.value)}
                    placeholder="Manual Latitude (e.g. -23.55)" className="h-9 font-mono text-xs" />
                  <Input value={manualLng} onChange={(e) => setManualLng(e.target.value)}
                    placeholder="Manual Longitude (e.g. -46.63)" className="h-9 font-mono text-xs" />
                  <Button type="button" variant="outline" onClick={applyManual}
                    className="h-9 font-mono text-[10px] uppercase tracking-widest">
                    Apply Region
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    § 03 · Market Participant Roles
                  </div>
                  <button type="button" onClick={selectAll}
                    className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-primary">
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
                            ? "border-primary/60 bg-primary/5 shadow-[var(--shadow-glow)]"
                            : "border-border bg-background/40 hover:border-border/80 hover:bg-background/60"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                            active ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-background/60 text-muted-foreground"
                          }`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className="font-mono text-[11px] uppercase tracking-widest text-foreground">
                                {ROLE_META[r].label}
                              </div>
                              <div className={`flex h-4 w-4 items-center justify-center rounded-sm border transition ${
                                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/60"
                              }`}>
                                {active && <Check className="h-3 w-3" />}
                              </div>
                            </div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {ROLE_META[r].tagline}
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {ROLE_META[r].capabilities.map((c) => (
                                <span key={c} className="rounded-sm border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
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

              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-background/40 p-3 text-xs">
                <input type="checkbox" checked={fund} onChange={(e) => setFund(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-[var(--primary)]" />
                <span>
                  <span className="block font-mono uppercase tracking-widest text-foreground">
                    Fund settlement account on Stellar Testnet
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Provisions a Stellar Testnet account funded via Friendbot for settlement operations.
                  </span>
                </span>
              </label>

              <Button type="submit" disabled={!formValid}
                className="h-10 w-full font-mono text-xs uppercase tracking-widest">
                Provision Settlement Identity
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>

              <div className="flex items-center justify-between border-t border-border pt-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <span>Already provisioned?</span>
                <Link to="/login" className="text-foreground hover:text-primary">Operator Access →</Link>
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
                  {progress}/{PROVISIONING_STEPS.length}
                </div>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-border/60">
                <div
                  className="h-full bg-[image:var(--gradient-primary)] transition-all duration-300"
                  style={{ width: `${(progress / PROVISIONING_STEPS.length) * 100}%` }}
                />
              </div>
              <div className="space-y-1.5 rounded-md border border-border bg-background/60 p-3 font-mono text-[11px]">
                {PROVISIONING_STEPS.map((s, i) => {
                  const done = i < progress;
                  const active = i === progress;
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <span className="w-7 text-muted-foreground">[{String(i + 1).padStart(2, "0")}]</span>
                      {done ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : active ? (
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      ) : (
                        <span className="h-3 w-3 rounded-full border border-border" />
                      )}
                      <span className={done ? "text-foreground" : active ? "text-foreground" : "text-muted-foreground"}>
                        {s}
                      </span>
                      {done && <span className="ml-auto text-[10px] text-success">OK</span>}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <span>Network: Stellar Testnet</span>
                <span className="flex items-center gap-1.5 text-success">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Provisioning
                </span>
              </div>
            </div>
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
                <KeyRow label="Public Key" value={operator.wallet.publicKey} icon={<ShieldCheck className="h-3 w-3" />} />
                <Separator className="my-2 bg-border/60" />
                <div className="rounded-md border border-border bg-background/40 px-2 py-1.5">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Signer custody
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-foreground">
                    Backend custody · ed25519 · {operator.wallet.status}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                    Secret seed is held by the EnergyPay backend. The frontend never receives the secret key.
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
                      value={operator.provisioningLedger != null ? `#${operator.provisioningLedger}` : "PENDING"}
                      tone={operator.provisioningLedger != null ? "success" : undefined}
                    />
                    <Mini
                      label="Settlement Status"
                      value={(operator.settlementStatus || operator.wallet.status || "PROVISIONED").toUpperCase()}
                      tone={operator.wallet.funded ? "success" : undefined}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-widest">
                <Mini label="Network" value={operator.network || "Stellar Testnet"} tone="success" />
                <Mini label="Funded" value={operator.wallet.funded ? "Yes · Friendbot" : "No · Friendbot failed"} tone={operator.wallet.funded ? "success" : undefined} />
                <Mini label="Roles" value={operator.roles.length.toString()} />
                <Mini label="Address" value={maskAddress(operator.wallet.publicKey)} />
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Provisioned Capabilities
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {operator.roles.map((r) => (
                    <span key={r} className="rounded-sm border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                      {ROLE_META[r].label}
                    </span>
                  ))}
                </div>
              </div>

              <a
                href={`https://stellar.expert/explorer/testnet/account/${operator.wallet.publicKey}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-foreground transition hover:border-primary/50 hover:text-primary"
              >
                <span>Audit account on Stellar Expert</span>
                <ArrowRight className="h-3 w-3" />
              </a>

              <Button onClick={() => navigate({ to: "/" })}
                className="h-10 w-full font-mono text-xs uppercase tracking-widest">
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

function Field({
  label, icon, children, className = "",
}: { label: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
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
  label, value, icon, trailing,
}: { label: string; value: string; icon: React.ReactNode; trailing?: React.ReactNode }) {
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
        {icon}{label}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <code className="flex-1 truncate rounded-md border border-border bg-background/60 px-2 py-1 font-mono text-[11px] text-foreground">
          {value}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={copy}
          className="h-6 px-2 font-mono text-[10px] uppercase tracking-widest">
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
      <div className={`mt-0.5 text-[11px] ${tone === "success" ? "text-success" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}
