import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { STELLAR_NETWORK_LABEL } from "@/lib/stellar";
import { useEffect, useRef, useState } from "react";
import { format, differenceInCalendarDays, addDays } from "date-fns";
import {
  ArrowRight,
  CalendarIcon,
  FileSignature,
  Hash,
  Zap,
  Loader2,
  CheckCircle2,
  Wallet,
  Search,
  UserPlus,
  X,
  ShieldCheck,
  Phone,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useOperator } from "@/store/operator";
import { apiCreateContract, API_BASE_URL } from "@/lib/api";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/contracts/new")({
  head: () => ({
    meta: [
      { title: "New Contract — EnergyPay" },
      {
        name: "description",
        content: "Register a bilateral energy contract for programmable settlement.",
      },
    ],
  }),
  component: NewContract,
});

const toIso = (d?: Date) => (d ? d.toISOString().slice(0, 10) : "");

// Stellar ops executed automatically when all parties approve
const ATOMIC_OPS = [
  {
    id: "token_issuance",
    step: 1,
    label: "Token Issuance",
    description: "Mint EPWR tokens representing the contracted energy volume (issuer → distribution).",
    stellarOp: "payment (Asset: EPWR)",
  },
  {
    id: "settlement_lock",
    step: 2,
    label: "Settlement Lock",
    description: "Transfer tokenized energy to buyer account. Contract reference anchored via transaction memo.",
    stellarOp: "payment (distribution → buyer)",
  },
];

import { ROLE_COLORS as _RC } from "@/store/operator";
const ROLE_COLORS: Record<string, string> = {
  GENERATOR: `${_RC.GENERATOR.border} ${_RC.GENERATOR.bg} ${_RC.GENERATOR.text}`,
  SELLER: `${_RC.SELLER.border} ${_RC.SELLER.bg} ${_RC.SELLER.text}`,
  INVESTOR: `${_RC.INVESTOR.border} ${_RC.INVESTOR.bg} ${_RC.INVESTOR.text}`,
  USER: `${_RC.USER.border} ${_RC.USER.bg} ${_RC.USER.text}`,
};

const CONTRACT_ROLES = ["SELLER", "GUARANTOR", "BROKER", "WITNESS"] as const;
type ContractRole = (typeof CONTRACT_ROLES)[number];

const CONTRACT_ROLE_LABELS: Record<ContractRole, string> = {
  SELLER: "Seller",
  GUARANTOR: "Guarantor",
  BROKER: "Broker",
  WITNESS: "Witness",
};

const CONTRACT_ROLE_COLORS: Record<ContractRole, string> = {
  SELLER: "border-primary/40 bg-primary/10 text-primary",
  GUARANTOR: "border-warning/40 bg-warning/10 text-warning",
  BROKER: "border-success/40 bg-success/10 text-success",
  WITNESS: "border-muted/40 bg-muted/10 text-muted-foreground",
};

type PlatformUser = {
  id: string;
  full_name: string;
  email: string;
  organization: string;
  roles: string[];
  stellar_public_key: string;
  country: string;
  city: string;
  email_verified: boolean;
  phone_verified: boolean;
  phone_masked: string | null;
};

type ContractParty = PlatformUser & {
  contractRole: ContractRole;
};


function NewContract() {
  const navigate = useNavigate();
  const operator = useOperator((s) => s.operator);
  const myPublicKey = operator?.wallet?.publicKey || "";

  // All verified platform users
  const [allUsers, setAllUsers] = useState<PlatformUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Contract parties (excludes buyer — buyer = current user)
  const [parties, setParties] = useState<ContractParty[]>([]);

  // Party picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRole, setPickerRole] = useState<ContractRole>("SELLER");
  const [pickerSearch, setPickerSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<{
    contractNumber: string;
    buyerKey: string;
    buyerLabel: string;
    volume: string;
    price: string;
    startDate?: Date;
    endDate?: Date;
  }>({
    contractNumber: "",
    buyerKey: "",
    buyerLabel: "",
    volume: "",
    price: "",
  });
  const [submitting, setSubmitting] = useState(false);
  // Shown after successful DRAFT submission — pending counterparty approval
  const [pendingContractId, setPendingContractId] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Load verified users on mount
  useEffect(() => {
    (async () => {
      try {
        const session = getSession();
        const res = await fetch(`${API_BASE_URL}/api/auth/counterparties`, {
          headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
        });
        const data = await res.json();
        if (data.success) setAllUsers(data.counterparties || []);
      } catch {
        // silent — manual entry still works
      } finally {
        setLoadingUsers(false);
      }
    })();
  }, []);

  // Auto-set buyer
  useEffect(() => {
    if (myPublicKey && !form.buyerKey) {
      setForm((f) => ({
        ...f,
        buyerKey: myPublicKey,
        buyerLabel: operator?.fullName || operator?.organization || "",
      }));
    }
  }, [myPublicKey]);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node))
        setPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  // Eligible users: verified, not current user, not already added
  const addedPublicKeys = new Set([myPublicKey, ...parties.map((p) => p.stellar_public_key)]);
  const eligible = allUsers
    .filter((u) => !addedPublicKeys.has(u.stellar_public_key))
    .filter((u) => {
      if (!pickerSearch) return true;
      const q = pickerSearch.toLowerCase();
      return (
        u.full_name.toLowerCase().includes(q) ||
        u.organization?.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.stellar_public_key.toLowerCase().includes(q)
      );
    });

  const addParty = (user: PlatformUser) => {
    setParties((prev) => [...prev, { ...user, contractRole: pickerRole }]);
    setPickerOpen(false);
    setPickerSearch("");
  };

  const removeParty = (publicKey: string) => {
    setParties((prev) => prev.filter((p) => p.stellar_public_key !== publicKey));
  };

  // Derive primary seller for Stellar tx
  const primarySeller = parties.find((p) => p.contractRole === "SELLER");
  const sellerKey = primarySeller?.stellar_public_key ?? "";
  const sellerLabel = primarySeller?.full_name ?? "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const datesValid = !!(form.startDate && form.endDate && form.endDate >= form.startDate);
  const periodStatus: "UPCOMING" | "ACTIVE" | "EXPIRED" | null =
    datesValid && form.startDate && form.endDate
      ? today < form.startDate ? "UPCOMING"
      : today > form.endDate ? "EXPIRED"
      : "ACTIVE"
      : null;
  const durationDays =
    datesValid && form.startDate && form.endDate
      ? differenceInCalendarDays(form.endDate, form.startDate) + 1
      : 0;
  const settlementDate = form.endDate ? addDays(form.endDate, 1) : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datesValid) {
      toast.error("Invalid contract period — end date must be on or after start date.");
      return;
    }
    if (!form.buyerKey) {
      toast.error("Buyer public key is required.");
      return;
    }
    if (parties.length === 0) {
      toast.error("Add at least one contract party (Seller, Guarantor, or Broker).");
      return;
    }
    if (!primarySeller) {
      toast.error("At least one party with the SELLER role is required.");
      return;
    }

    setSubmitting(true);
    setPendingContractId(null);

    try {
      const startDate = toIso(form.startDate);
      const endDate = toIso(form.endDate);

      // All contracts start as DRAFT and require counterparty approval.
      // The Stellar atomic transaction executes automatically once ALL parties approve.
      const partiesPayload = parties.map((p) => ({
        publicKey: p.stellar_public_key,
        userId: p.id,
        role: p.contractRole,
        label: p.full_name,
      }));

      const res = await apiCreateContract({
        contract_number: form.contractNumber || undefined,
        buyer_public_key: form.buyerKey,
        seller_public_key: sellerKey || undefined,
        buyer_label: form.buyerLabel || undefined,
        seller_label: sellerLabel || undefined,
        volume_mwh: Number(form.volume),
        price_brl: Number(form.price),
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        settlement_date: toIso(settlementDate) || undefined,
        memo: form.contractNumber ? `EP:${form.contractNumber.slice(0, 24)}` : undefined,
        parties: partiesPayload,
      });

      setPendingContractId(res.contract?.id ?? null);
      toast.success("Contract submitted — awaiting approvals", {
        description: `${parties.length} counterpart${parties.length > 1 ? "ies" : "y"} notified. Stellar execution is automatic upon approval.`,
      });
    } catch (err) {
      toast.error("Registration failed", { description: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const notional = (Number(form.volume) || 0) * (Number(form.price) || 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Contract Registry / New Entry
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Register Bilateral Contract
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tokenize a physical energy contract as a programmable settlement schedule on Stellar.
        </p>
      </div>

      <form onSubmit={submit}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="border-border bg-card p-6 lg:col-span-2">
            <div className="mb-5 flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-primary" />
              <p className="font-display text-base font-semibold">Contract Terms</p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Contract Number */}
              <Field label="Contract Number (Physical)" id="contractNumber" className="md:col-span-2">
                <div className="relative">
                  <Hash className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="contractNumber"
                    value={form.contractNumber}
                    onChange={(e) => set("contractNumber", e.target.value)}
                    placeholder="e.g. CCEE-2026-00412 · physical contract reference"
                    className="bg-input pl-8 font-mono"
                  />
                </div>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  Physical contract number from the real-world energy market (CCEE, ANEEL, bilateral
                  agreement). Anchored on-chain in the atomic transaction.
                </p>
              </Field>

              {/* Buyer — auto-filled */}
              <Field label="Buyer (Your Wallet)" id="buyerKey" className="md:col-span-2">
                <div className="relative">
                  <Wallet className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="buyerKey"
                    required
                    value={form.buyerKey}
                    onChange={(e) => set("buyerKey", e.target.value)}
                    placeholder="G… (56-char Stellar ed25519 public key)"
                    className="bg-input pl-8 font-mono text-xs"
                  />
                </div>
                {myPublicKey && form.buyerKey === myPublicKey && (
                  <div className="mt-1.5 flex items-center gap-3">
                    <p className="font-mono text-[10px] text-success">
                      Connected wallet · {operator?.fullName || operator?.organization}
                    </p>
                    <VerifiedBadges emailVerified phoneVerified />
                  </div>
                )}
              </Field>

              {/* ── Contract Parties ── */}
              <Field label="Contract Parties" id="parties" className="md:col-span-2">
                <div className="space-y-2">
                  {/* Added parties list */}
                  {parties.map((p) => (
                    <div
                      key={p.stellar_public_key}
                      className="flex items-start gap-3 rounded-md border border-border bg-background/40 px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[12px] font-medium text-foreground">{p.full_name}</span>
                          <span
                            className={cn(
                              "rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase",
                              CONTRACT_ROLE_COLORS[p.contractRole],
                            )}
                          >
                            {CONTRACT_ROLE_LABELS[p.contractRole]}
                          </span>
                          <VerifiedBadges emailVerified={p.email_verified} phoneVerified={p.phone_verified} />
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
                          <span>{p.organization || p.email}</span>
                          <span>·</span>
                          <span>{p.stellar_public_key.slice(0, 8)}…{p.stellar_public_key.slice(-4)}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {p.roles.map((r) => (
                            <span
                              key={r}
                              className={cn(
                                "rounded border px-1 py-0 font-mono text-[8px] uppercase",
                                ROLE_COLORS[r] || ROLE_COLORS.USER,
                              )}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeParty(p.stellar_public_key)}
                        className="mt-0.5 rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove party"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Add Party button + picker */}
                  <div className="relative" ref={pickerRef}>
                    <button
                      type="button"
                      onClick={() => setPickerOpen((o) => !o)}
                      className={cn(
                        "flex h-9 w-full items-center gap-2 rounded-md border border-dashed border-border bg-background/20 px-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary",
                        pickerOpen && "border-primary/40 text-primary",
                      )}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Add contract party
                    </button>

                    {pickerOpen && (
                      <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
                        {/* Role selector */}
                        <div className="flex gap-1 border-b border-border p-2">
                          {CONTRACT_ROLES.map((role) => (
                            <button
                              key={role}
                              type="button"
                              onClick={() => setPickerRole(role)}
                              className={cn(
                                "rounded px-2 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors",
                                pickerRole === role
                                  ? CONTRACT_ROLE_COLORS[role]
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {CONTRACT_ROLE_LABELS[role]}
                            </button>
                          ))}
                        </div>

                        {/* Search */}
                        <div className="border-b border-border p-2">
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <input
                              type="text"
                              value={pickerSearch}
                              onChange={(e) => setPickerSearch(e.target.value)}
                              placeholder="Search by name, org or address…"
                              className="h-8 w-full bg-transparent pl-7 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
                              autoFocus
                            />
                          </div>
                        </div>

                        {/* Results */}
                        <div className="max-h-60 overflow-y-auto">
                          {loadingUsers ? (
                            <div className="flex items-center justify-center p-4">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : eligible.length === 0 ? (
                            <div className="p-4 text-center font-mono text-[11px] text-muted-foreground">
                              {pickerSearch ? "No users match." : "No eligible users available."}
                            </div>
                          ) : (
                            eligible.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => addParty(u)}
                                className="flex w-full flex-col gap-1 border-b border-border/50 px-3 py-2.5 text-left transition-colors hover:bg-accent/40"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[12px] font-medium text-foreground">
                                    {u.full_name}
                                  </span>
                                  <VerifiedBadges emailVerified={u.email_verified} phoneVerified={u.phone_verified} />
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                  <span className="flex flex-wrap gap-1">
                                    {u.roles.map((r) => (
                                      <span
                                        key={r}
                                        className={cn(
                                          "rounded border px-1 py-0 font-mono text-[8px] uppercase",
                                          ROLE_COLORS[r] || ROLE_COLORS.USER,
                                        )}
                                      >
                                        {r}
                                      </span>
                                    ))}
                                    <span className="ml-1">{u.organization || u.email}</span>
                                  </span>
                                  <span className="font-mono text-[9px]">
                                    {u.stellar_public_key.slice(0, 8)}…{u.stellar_public_key.slice(-4)}
                                  </span>
                                </div>
                              </button>
                            ))
                          )}
                        </div>

                        {/* Verified-only notice */}
                        <div className="flex items-center gap-1.5 border-t border-border px-3 py-2">
                          <ShieldCheck className="h-3 w-3 text-success" />
                          <p className="font-mono text-[9px] text-muted-foreground">
                            Only users with verified e-mail and phone are shown
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {parties.length === 0 && (
                    <p className="font-mono text-[10px] text-muted-foreground">
                      Add at least one Seller. Guarantors and Brokers are optional.
                    </p>
                  )}
                </div>
              </Field>

              {/* Volume + Price */}
              <Field label="Energy Volume (MWh)" id="vol">
                <Input
                  id="vol"
                  type="number"
                  required
                  min="1"
                  value={form.volume}
                  onChange={(e) => set("volume", e.target.value)}
                  placeholder="2400"
                  className="bg-input font-mono"
                />
              </Field>
              <Field label="Contract Price (R$ / MWh)" id="price">
                <Input
                  id="price"
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                  placeholder="248.50"
                  className="bg-input font-mono"
                />
              </Field>

              {/* Dates */}
              <Field label="Start Date (Contract)" id="startDate">
                <DatePickerField
                  id="startDate"
                  value={form.startDate}
                  onChange={(d) => set("startDate", d)}
                  placeholder="Select start"
                />
              </Field>
              <Field label="End Date (Contract)" id="endDate">
                <DatePickerField
                  id="endDate"
                  value={form.endDate}
                  onChange={(d) => set("endDate", d)}
                  placeholder="Select end"
                  disabled={(d) => (form.startDate ? d < form.startDate : false)}
                  invalid={!!form.startDate && !!form.endDate && form.endDate < form.startDate}
                />
              </Field>

              <Field label="Contract Period" id="periodStatus">
                <div className="flex h-9 items-center rounded-md border border-border bg-input px-3">
                  {periodStatus ? (
                    <PeriodBadge status={periodStatus} />
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Awaiting dates
                    </span>
                  )}
                  {durationDays > 0 && (
                    <span className="ml-2 font-mono text-[10px] text-muted-foreground">({durationDays}d)</span>
                  )}
                </div>
              </Field>
              <Field label="Settlement Date (D+1)" id="settlementDate">
                <div className="flex h-9 items-center rounded-md border border-border bg-input px-3">
                  {settlementDate ? (
                    <span className="font-mono text-xs text-foreground">
                      {format(settlementDate, "yyyy-MM-dd")}
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Auto (end date + 1)
                    </span>
                  )}
                </div>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  D+1 17:00 BRT clearing window — auto-derived from contract end date
                </p>
              </Field>
            </div>

            {/* Bilateral Approval + Atomic Execution */}
            <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <p className="font-mono text-[11px] uppercase tracking-widest text-primary">
                  Bilateral Approval → Atomic Settlement
                </p>
              </div>
              <p className="mb-4 text-[12px] text-muted-foreground">
                Either the buyer or seller may register a contract. All counterparties receive an
                approval notification. Once every party confirms, the Stellar atomic transaction
                executes automatically — no manual step required.
              </p>

              {/* Stellar ops info */}
              <div className="space-y-2">
                {ATOMIC_OPS.map((op) => (
                  <div
                    key={op.id}
                    className="flex items-start gap-3 rounded border border-border bg-background/40 p-3"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-mono text-[9px] text-primary">
                      {op.step}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px] uppercase tracking-widest text-foreground">
                        {op.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{op.description}</p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                        Stellar op: <span className="text-foreground/60">{op.stellarOp}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pending approval success state */}
              {pendingContractId && (
                <div className="mt-4 rounded-md border border-warning/30 bg-warning/5 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-warning" />
                    <p className="font-mono text-[11px] uppercase tracking-widest text-warning">
                      Contract Submitted — Awaiting Approval
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {parties.length} counterpart{parties.length > 1 ? "ies have" : "y has"} received
                    an approval notification. The Stellar transaction will execute automatically
                    once all parties confirm.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ml-auto h-7 font-mono text-[10px] uppercase"
                      onClick={() => navigate({ to: "/contracts" })}
                    >
                      Go to Contracts
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Summary card */}
          <Card className="border-border bg-[image:var(--gradient-card)] p-6">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Summary</p>
            <p className="mt-1 font-display text-base font-semibold">Notional Exposure</p>
            <div className="mt-6 space-y-4 text-sm">
              {form.contractNumber && <Row k="Contract #" v={form.contractNumber} />}
              <Row
                k="Buyer"
                v={form.buyerLabel || (form.buyerKey ? `${form.buyerKey.slice(0, 8)}…` : "—")}
              />

              {/* Party summary */}
              {parties.length > 0 ? (
                <div className="space-y-1.5">
                  {parties.map((p) => (
                    <div key={p.stellar_public_key} className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground">{CONTRACT_ROLE_LABELS[p.contractRole]}</span>
                      <span className="font-mono text-right text-xs">
                        {p.full_name}
                        <span className="ml-1 text-muted-foreground">
                          · {p.stellar_public_key.slice(0, 6)}…
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <Row k="Parties" v="—" />
              )}

              <Row k="Volume" v={`${form.volume || "—"} MWh`} />
              <Row k="Price" v={`R$ ${form.price || "—"}`} />
              <Row k="Start" v={form.startDate ? format(form.startDate, "yyyy-MM-dd") : "—"} />
              <Row k="End" v={form.endDate ? format(form.endDate, "yyyy-MM-dd") : "—"} />
              <Row k="Settlement" v={settlementDate ? format(settlementDate, "yyyy-MM-dd") : "—"} />
              <Row k="Duration" v={durationDays ? `${durationDays} d` : "—"} />
              <Row k="Approval" v="REQUIRED" />
              <div className="border-t border-border pt-4">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Notional</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-primary">
                  {notional
                    ? notional.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "R$ 0,00"}
                </p>
              </div>
            </div>

            <Button
              type="submit"
              className="mt-6 w-full"
              size="lg"
              disabled={!datesValid || !form.buyerKey || !primarySeller || submitting || !!pendingContractId}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting to Stellar…
                </>
              ) : (
                <>
                  Register Contract <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Anchored to {STELLAR_NETWORK_LABEL} · Settlement Network
            </p>
          </Card>
        </div>
      </form>
    </div>
  );
}

/* ── Verified badges ── */
function VerifiedBadges({
  emailVerified,
  phoneVerified,
}: {
  emailVerified: boolean;
  phoneVerified: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <span
        className={cn(
          "flex items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[8px] uppercase",
          emailVerified
            ? "bg-success/10 text-success"
            : "bg-destructive/10 text-destructive",
        )}
      >
        <Mail className="h-2.5 w-2.5" />
        {emailVerified ? "✓" : "✗"}
      </span>
      <span
        className={cn(
          "flex items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[8px] uppercase",
          phoneVerified
            ? "bg-success/10 text-success"
            : "bg-destructive/10 text-destructive",
        )}
      >
        <Phone className="h-2.5 w-2.5" />
        {phoneVerified ? "✓" : "✗"}
      </span>
    </div>
  );
}

/* ── DatePicker ── */
function DatePickerField({
  id, value, onChange, placeholder, disabled, invalid,
}: {
  id: string;
  value?: Date;
  onChange: (d?: Date) => void;
  placeholder: string;
  disabled?: (date: Date) => boolean;
  invalid?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "h-9 w-full justify-start bg-input font-mono text-sm font-normal",
            !value && "text-muted-foreground",
            invalid && "border-destructive/60",
          )}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-70" />
          {value ? format(value, "yyyy-MM-dd") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          disabled={disabled}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

/* ── Period badge ── */
function PeriodBadge({ status }: { status: "UPCOMING" | "ACTIVE" | "EXPIRED" }) {
  const cls =
    status === "ACTIVE"
      ? "border-success/40 bg-success/10 text-success"
      : status === "UPCOMING"
        ? "border-warning/40 bg-warning/10 text-warning"
        : "border-muted/40 bg-muted/10 text-muted-foreground";
  return (
    <Badge variant="outline" className={`${cls} font-mono text-[10px]`}>
      ● {status}
    </Badge>
  );
}

/* ── Field wrapper ── */
function Field({
  label, id, children, className,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

/* ── Summary row ── */
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono">{v}</span>
    </div>
  );
}
