import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Calculator, CheckCircle2, ExternalLink, Loader2, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { mockContracts } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/settlement")({
  head: () => ({
    meta: [
      { title: "Settlement Simulation — EnergyPay" },
      { name: "description", content: "Simulate and execute programmable settlements via EPWR token." },
    ],
  }),
  component: SettlementPage,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

function SettlementPage() {
  const [contractId, setContractId] = useState(mockContracts[0].id);
  const contract = mockContracts.find((c) => c.id === contractId)!;
  const [pld, setPld] = useState<number>(278);

  const settlement = useMemo(() => (pld - contract.priceBRL) * contract.volumeMWh, [pld, contract]);
  const exposure = Math.abs(settlement);
  const direction = settlement >= 0 ? "Buyer receives" : "Seller receives";

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "signing" | "broadcasting" | "done">("idle");
  const [tx, setTx] = useState<string | null>(null);

  const execute = () => {
    setPhase("signing");
    setTimeout(() => {
      setPhase("broadcasting");
      setTimeout(() => {
        const hash =
          Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
        setTx(hash);
        setPhase("done");
        toast.success("Settlement executed", { description: `Tx ${hash.slice(0, 10)}…` });
      }, 1400);
    }, 900);
  };

  const reset = () => {
    setOpen(false);
    setTimeout(() => { setPhase("idle"); setTx(null); }, 200);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Settlement Engine / Simulation & Execution
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Settlement Simulation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Simulate financial exposure under PLD scenarios, then execute settlement on-chain via EPWR.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card p-6 lg:col-span-2">
          <div className="mb-5 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <p className="font-display text-base font-semibold">Scenario Inputs</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Contract</Label>
              <Select value={contractId} onValueChange={setContractId}>
                <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {mockContracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-mono">{c.id}</span> — {c.buyer} ↔ {c.seller}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ReadOnly label="Contracted Volume" value={`${contract.volumeMWh.toLocaleString("pt-BR")} MWh`} />
              <ReadOnly label="Contract Price" value={`R$ ${contract.priceBRL.toFixed(2)}`} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Simulated PLD</Label>
                <span className="font-mono text-sm">R$ {pld.toFixed(2)} / MWh</span>
              </div>
              <Slider value={[pld]} min={150} max={400} step={0.5} onValueChange={(v) => setPld(v[0])} />
              <div className="flex items-center gap-2 pt-1">
                <Input type="number" step="0.01" value={pld} onChange={(e) => setPld(Number(e.target.value))}
                  className="w-32 bg-input font-mono" />
                <span className="text-xs text-muted-foreground">Fine-tune PLD scenario</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="relative overflow-hidden border-border bg-[image:var(--gradient-card)] p-6">
          <div className="absolute inset-x-0 top-0 h-px bg-[image:var(--gradient-primary)] opacity-60" />
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Financial Exposure</p>
          <p className={`mt-2 font-display text-3xl font-semibold tracking-tight ${settlement >= 0 ? "text-success" : "text-destructive"}`}>
            {settlement >= 0 ? "+" : ""}{fmtBRL(settlement)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{direction} · |exposure| {fmtBRL(exposure)}</p>

          <div className="my-5 rounded-md border border-dashed border-border bg-background/40 p-3 font-mono text-[11px] text-muted-foreground">
            settlement = (PLD − Price) × Volume
            <br />
            = ({pld.toFixed(2)} − {contract.priceBRL.toFixed(2)}) × {contract.volumeMWh}
            <br />
            = <span className="text-foreground">{fmtBRL(settlement)}</span>
          </div>

          <Button className="w-full" size="lg" onClick={() => setOpen(true)}>
            <Zap className="mr-2 h-4 w-4" /> Execute Settlement
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> Atomic settlement · counterparty net exposure
          </p>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : reset())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {phase === "done" ? "Settlement Confirmed" : "Confirm Settlement"}
            </DialogTitle>
            <DialogDescription>
              {phase === "done"
                ? "Atomic transfer broadcast to Stellar network."
                : "Review the operation before signing."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-md border border-border bg-card p-4 text-sm">
            <Row k="Contract" v={contract.id} mono />
            <Row k="Counterparty" v={contract.seller} />
            <Row k="Volume" v={`${contract.volumeMWh} MWh`} mono />
            <Row k="PLD" v={`R$ ${pld.toFixed(2)}`} mono />
            <div className="border-t border-border pt-3">
              <Row k="Settlement amount" v={fmtBRL(settlement)} mono highlight />
            </div>

            {phase !== "idle" && (
              <div className="border-t border-border pt-3">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Status</p>
                <div className="mt-1 flex items-center gap-2 font-mono text-xs">
                  {phase === "signing" && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Signing with EPWR keypair…</>}
                  {phase === "broadcasting" && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Broadcasting to Stellar Horizon…</>}
                  {phase === "done" && tx && (
                    <div className="w-full space-y-2">
                      <div className="flex items-center gap-1.5 text-success">
                        <CheckCircle2 className="h-4 w-4" /> CONFIRMED · ledger #58 921 432
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Tx hash</p>
                        <p className="break-all rounded bg-background/60 p-2 text-[11px]">{tx}</p>
                      </div>
                      <a href={`https://stellar.expert/explorer/testnet/tx/${tx}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                        View on Stellar Explorer (Testnet) <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {phase === "idle" && (
              <>
                <Button variant="ghost" onClick={reset}>Cancel</Button>
                <Button onClick={execute}><Zap className="mr-2 h-4 w-4" /> Sign & Broadcast</Button>
              </>
            )}
            {phase === "done" && <Button onClick={reset}>Close</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</Label>
      <div className="flex h-9 items-center rounded-md border border-border bg-input px-3 font-mono text-sm">{value}</div>
    </div>
  );
}

function Row({ k, v, mono, highlight }: { k: string; v: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className={`${mono ? "font-mono" : ""} ${highlight ? "text-base font-semibold text-primary" : "text-sm"}`}>{v}</span>
    </div>
  );
}
