import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Calculator, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useOps } from "@/store/operations";
import { ExecutionConsole } from "@/components/ExecutionConsole";
import { StateMachine } from "@/components/StateMachine";

export const Route = createFileRoute("/settlement")({
  head: () => ({
    meta: [
      { title: "Settlement Engine — EnergyPay" },
      { name: "description", content: "Operational settlement console for programmable electricity contracts on Stellar." },
    ],
  }),
  component: SettlementPage,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

function SettlementPage() {
  const contracts = useOps((s) => s.contracts);
  const [contractId, setContractId] = useState(contracts[0]?.id ?? "");
  const contract = contracts.find((c) => c.id === contractId) ?? contracts[0];
  const [pld, setPld] = useState<number>(278);

  const settlement = useMemo(() => (pld - contract.priceBRL) * contract.volumeMWh, [pld, contract]);
  const direction = settlement >= 0 ? "Buyer receives" : "Seller receives";

  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Settlement Engine / Simulation & Execution
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Settlement Console</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Simulate exposure under PLD scenarios then execute atomic settlement on the Stellar settlement rail.
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
                  {contracts.map((c) => (
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
              <ReadOnly label="Settlement window" value={contract.window} />
              <ReadOnly label="Current state" value={contract.state} />
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

            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Settlement state machine
              </p>
              <StateMachine current={contract.state} failed={contract.state === "FAILED"} />
            </div>
          </div>
        </Card>

        <Card className="relative overflow-hidden border-border bg-card p-6">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Net Financial Exposure</p>
          <p className={`mt-2 font-display text-3xl font-semibold tracking-tight ${settlement >= 0 ? "text-success" : "text-destructive"}`}>
            {settlement >= 0 ? "+" : ""}{fmtBRL(settlement)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{direction}</p>

          <div className="my-5 rounded-md border border-dashed border-border bg-background/40 p-3 font-mono text-[11px] text-muted-foreground">
            settlement = (PLD − Price) × Volume
            <br />
            = ({pld.toFixed(2)} − {contract.priceBRL.toFixed(2)}) × {contract.volumeMWh}
            <br />
            = <span className="text-foreground">{fmtBRL(settlement)}</span>
          </div>

          <Button className="w-full" size="lg" onClick={() => setOpen(true)}>
            <Zap className="mr-2 h-4 w-4" /> Run Settlement
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> Atomic settlement · counterparty net exposure
          </p>
        </Card>
      </div>

      <ExecutionConsole
        open={open}
        onOpenChange={setOpen}
        contract={contract}
        pld={pld}
        amount={settlement}
      />
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
