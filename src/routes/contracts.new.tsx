import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import { ArrowRight, CalendarIcon, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useOps } from "@/store/operations";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/contracts/new")({
  head: () => ({
    meta: [
      { title: "New Contract — EnergyPay" },
      { name: "description", content: "Register a bilateral energy contract for programmable settlement." },
    ],
  }),
  component: NewContract,
});

const toIso = (d?: Date) => (d ? d.toISOString().slice(0, 10) : "");

function NewContract() {
  const navigate = useNavigate();
  const registerContract = useOps((s) => s.registerContract);
  const [form, setForm] = useState<{ buyer: string; seller: string; volume: string; price: string; startDate?: Date; endDate?: Date }>({
    buyer: "", seller: "", volume: "", price: "",
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const datesValid = !!(form.startDate && form.endDate && form.endDate >= form.startDate);

  const periodStatus: "UPCOMING" | "ACTIVE" | "EXPIRED" | null =
    datesValid && form.startDate && form.endDate
      ? today < form.startDate ? "UPCOMING" : today > form.endDate ? "EXPIRED" : "ACTIVE"
      : null;

  const durationDays =
    datesValid && form.startDate && form.endDate
      ? differenceInCalendarDays(form.endDate, form.startDate) + 1
      : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!datesValid) {
      toast.error("Invalid contract period", { description: "End date must be on or after start date." });
      return;
    }
    const startDate = toIso(form.startDate);
    const endDate = toIso(form.endDate);
    const c = registerContract({
      buyer: form.buyer,
      seller: form.seller,
      volumeMWh: Number(form.volume),
      priceBRL: Number(form.price),
      settlementDate: endDate,
      startDate,
      endDate,
    });
    toast.success(`Contract ${c.id} registered`, {
      description: `${c.buyer} ↔ ${c.seller} · ${c.volumeMWh} MWh @ R$ ${c.priceBRL.toFixed(2)} · ${startDate} → ${endDate}`,
    });
    setTimeout(() => navigate({ to: "/contracts" }), 600);
  };

  const notional = (Number(form.volume) || 0) * (Number(form.price) || 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Contract Registry / New Entry
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Register Bilateral Contract</h1>
        <p className="mt-1 text-sm text-muted-foreground">Issued contracts are deployed as programmable settlement schedules on Stellar.</p>
      </div>

      <form onSubmit={submit}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="border-border bg-card p-6 lg:col-span-2">
            <div className="mb-5 flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-primary" />
              <p className="font-display text-base font-semibold">Contract Terms</p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Buyer" id="buyer">
                <Input id="buyer" required value={form.buyer} onChange={(e) => set("buyer", e.target.value)}
                  placeholder="e.g. Metro Distribution Group" className="bg-input" />
              </Field>
              <Field label="Seller" id="seller">
                <Input id="seller" required value={form.seller} onChange={(e) => set("seller", e.target.value)}
                  placeholder="e.g. Meridian Trading Desk" className="bg-input" />
              </Field>
              <Field label="Energy Volume (MWh)" id="vol">
                <Input id="vol" type="number" required min="1" value={form.volume}
                  onChange={(e) => set("volume", e.target.value)} placeholder="2400" className="bg-input font-mono" />
              </Field>
              <Field label="Contract Price (R$ / MWh)" id="price">
                <Input id="price" type="number" required step="0.01" min="0" value={form.price}
                  onChange={(e) => set("price", e.target.value)} placeholder="248.50" className="bg-input font-mono" />
              </Field>

              <Field label="Start Date" id="startDate">
                <DatePickerField
                  id="startDate"
                  value={form.startDate}
                  onChange={(d) => set("startDate", d)}
                  placeholder="Select start"
                />
              </Field>
              <Field label="End Date" id="endDate">
                <DatePickerField
                  id="endDate"
                  value={form.endDate}
                  onChange={(d) => set("endDate", d)}
                  placeholder="Select end"
                  disabled={(d) => (form.startDate ? d < form.startDate : false)}
                  invalid={!!form.startDate && !!form.endDate && form.endDate < form.startDate}
                />
              </Field>

              <Field label="Status (period)" id="periodStatus">
                <div className="flex h-9 items-center rounded-md border border-border bg-input px-3">
                  {periodStatus ? (
                    <PeriodBadge status={periodStatus} />
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Awaiting dates</span>
                  )}
                </div>
              </Field>
              <Field label="Operational Status" id="status">
                <div className="flex h-9 items-center rounded-md border border-border bg-input px-3">
                  <Badge variant="outline" className="border-success/40 bg-success/10 font-mono text-[10px] text-success">
                    ● ACTIVE
                  </Badge>
                </div>
              </Field>
            </div>
          </Card>

          <Card className="border-border bg-[image:var(--gradient-card)] p-6">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Summary</p>
            <p className="mt-1 font-display text-base font-semibold">Notional Exposure</p>
            <div className="mt-6 space-y-4 text-sm">
              <Row k="Volume" v={`${form.volume || "—"} MWh`} />
              <Row k="Price" v={`R$ ${form.price || "—"}`} />
              <Row k="Start" v={form.startDate ? format(form.startDate, "yyyy-MM-dd") : "—"} />
              <Row k="End" v={form.endDate ? format(form.endDate, "yyyy-MM-dd") : "—"} />
              <Row k="Duration" v={durationDays ? `${durationDays} d` : "—"} />
              <div className="border-t border-border pt-4">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Notional</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-primary">
                  {notional ? notional.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00"}
                </p>
              </div>
            </div>

            <Button type="submit" className="mt-6 w-full" size="lg" disabled={!datesValid}>
              Register Contract <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Anchored to Stellar Testnet · Settlement Network
            </p>
          </Card>
        </div>
      </form>
    </div>
  );
}

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
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

function PeriodBadge({ status }: { status: "UPCOMING" | "ACTIVE" | "EXPIRED" }) {
  const cls =
    status === "ACTIVE" ? "border-success/40 bg-success/10 text-success" :
    status === "UPCOMING" ? "border-warning/40 bg-warning/10 text-warning" :
    "border-muted/40 bg-muted/10 text-muted-foreground";
  return (
    <Badge variant="outline" className={`${cls} font-mono text-[10px]`}>● {status}</Badge>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono">{v}</span>
    </div>
  );
}
