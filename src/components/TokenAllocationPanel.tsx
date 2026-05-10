import {
  Coins,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  Copy,
  CheckCircle2,
  Activity,
  AlertTriangle,
  Layers,
  Banknote,
} from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWalletBalances, type WalletAssetEntry } from "@/hooks/useWalletBalances";
import { stellarExpertAccount } from "@/lib/stellar";
import { maskAddress } from "@/store/operator";
import { toast } from "sonner";

type Props = { publicKey: string };

const fmt = (raw: string, max = 4) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    maximumFractionDigits: max,
    minimumFractionDigits: 2,
  });
};

const stellarExpertAsset = (code: string, issuer: string) =>
  `https://stellar.expert/explorer/testnet/asset/${code}-${issuer}`;

export function TokenAllocationPanel({ publicKey }: Props) {
  const { data, error, loading, fetchedAt, refreshCount } = useWalletBalances(publicKey);

  const assets = data?.assets ?? [];
  const xlmEntry = assets.find((a) => a.asset_type === "native");
  const credits = assets.filter((a) => a.asset_type !== "native");

  return (
    <Card className="border-border bg-card p-4 md:p-5">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Settlement Custody / Token Allocation
          </p>
          <h3 className="mt-0.5 font-display text-lg font-semibold tracking-tight">
            Wallet Asset Allocation
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
          >
            <Activity className="mr-1.5 h-3 w-3 text-success" />
            Refresh · 10s
          </Badge>
          {data?.latency_ms != null && (
            <Badge
              variant="outline"
              className={`font-mono text-[10px] uppercase tracking-widest ${
                data.latency_ms < 800
                  ? "border-success/40 text-success"
                  : "border-amber-500/40 text-amber-500"
              }`}
            >
              Horizon {data.latency_ms}ms
            </Badge>
          )}
          {data && (
            <Badge
              variant="outline"
              className={`font-mono text-[10px] uppercase tracking-widest ${
                data.account_funded
                  ? "border-success/40 text-success"
                  : "border-amber-500/40 text-amber-500"
              }`}
            >
              {data.account_funded ? "ACCOUNT FUNDED" : "UNFUNDED"}
            </Badge>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
          <div className="flex-1">
            <p className="font-mono text-[11px] uppercase tracking-widest text-destructive">
              Allocation Feed Degraded
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {/* Asset grid */}
      {data && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {xlmEntry && <AssetCard asset={xlmEntry} />}
          {credits.length === 0 && data.account_funded && (
            <UntrustedCard />
          )}
          {credits.map((a) => (
            <AssetCard key={`${a.asset_code}-${a.asset_issuer}`} asset={a} />
          ))}
        </div>
      )}

      {/* Telemetry footer */}
      <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border pt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground md:grid-cols-4">
        <FooterStat label="Wallet" value={maskAddress(publicKey)} />
        <FooterStat label="Subentries" value={data ? String(data.subentry_count) : "—"} />
        <FooterStat label="Trustlines" value={data ? String(credits.length) : "—"} />
        <FooterStat
          label="Last sync"
          value={
            fetchedAt
              ? `${Math.max(0, Math.round((Date.now() - new Date(fetchedAt).getTime()) / 1000))}s ago`
              : "—"
          }
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>Polls · {refreshCount}</span>
        <a
          href={stellarExpertAccount(publicKey)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Account · Stellar Expert
          <ExternalLink className="ml-1 inline h-3 w-3" />
        </a>
      </div>
    </Card>
  );
}

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-2.5 py-1.5">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-[11px] normal-case text-foreground">{value}</p>
    </div>
  );
}

function AssetCard({ asset }: { asset: WalletAssetEntry }) {
  const [copied, setCopied] = useState(false);
  const isNative = asset.asset_type === "native";
  const balance = Number(asset.balance);
  const limit = asset.limit ? Number(asset.limit) : null;
  const used = limit && limit > 0 ? Math.min(100, (balance / limit) * 100) : null;

  const tone = !asset.is_authorized
    ? "warn"
    : balance > 0
    ? "ok"
    : isNative
    ? "warn"
    : "muted";

  const copyIssuer = async () => {
    if (!asset.asset_issuer) return;
    try {
      await navigator.clipboard.writeText(asset.asset_issuer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
      toast.success("Issuer copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="relative overflow-hidden rounded-md border border-border bg-background/40 p-4">
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--gradient-primary)" }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            {isNative ? (
              <Banknote className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
            ) : (
              <Coins className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
            )}
          </div>
          <div>
            <p className="font-display text-base font-semibold leading-tight">
              {asset.asset_code}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {isNative ? "Native · Stellar Lumens" : "Issued credit · trustline asset"}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isNative ? (
            <Badge
              variant="outline"
              className={`font-mono text-[9px] uppercase tracking-widest ${
                tone === "ok" ? "border-success/40 text-success" : "border-amber-500/40 text-amber-500"
              }`}
            >
              <ShieldCheck className="mr-1 h-3 w-3" /> Reserve
            </Badge>
          ) : asset.is_authorized ? (
            <Badge
              variant="outline"
              className="border-success/40 font-mono text-[9px] uppercase tracking-widest text-success"
            >
              <ShieldCheck className="mr-1 h-3 w-3" /> Trustline OK
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-destructive/40 font-mono text-[9px] uppercase tracking-widest text-destructive"
            >
              <ShieldAlert className="mr-1 h-3 w-3" /> Unauthorized
            </Badge>
          )}
          {balance > 0 ? (
            <Badge
              variant="outline"
              className="border-success/40 font-mono text-[9px] uppercase tracking-widest text-success"
            >
              FUNDED
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground"
            >
              EMPTY
            </Badge>
          )}
        </div>
      </div>

      <div className="relative mt-3 flex items-baseline gap-2">
        <span className="font-display text-2xl font-semibold tracking-tight">
          {fmt(asset.balance, isNative ? 4 : 2)}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {asset.asset_code}
        </span>
      </div>

      {/* Trustline limit bar */}
      {!isNative && limit && limit > 0 && (
        <div className="relative mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-[image:var(--gradient-primary)]"
              style={{ width: `${used ?? 0}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            <span>limit {fmt(asset.limit ?? "0", 0)}</span>
            <span>{used != null ? `${used.toFixed(1)}% used` : "—"}</span>
          </div>
        </div>
      )}

      {/* Issuer info */}
      {asset.asset_issuer && (
        <div className="relative mt-3 rounded border border-dashed border-border bg-background/40 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Issuer
              </p>
              <p className="mt-0.5 truncate font-mono text-[11px]">
                {maskAddress(asset.asset_issuer)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={copyIssuer}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Copy issuer"
              >
                {copied ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <a
                href={stellarExpertAsset(asset.asset_code, asset.asset_issuer)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Open asset on Stellar Expert"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Liabilities telemetry */}
      <div className="relative mt-2 grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>
          Buy ·{" "}
          <span className="text-foreground">{fmt(asset.buying_liabilities ?? "0", 2)}</span>
        </span>
        <span className="text-right">
          Sell ·{" "}
          <span className="text-foreground">{fmt(asset.selling_liabilities ?? "0", 2)}</span>
        </span>
      </div>
    </div>
  );
}

function UntrustedCard() {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border bg-background/40 p-4">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <p className="font-display text-sm font-semibold">No Issued Tokens</p>
      </div>
      <p className="text-xs text-muted-foreground">
        This account has no trustlines. Establish a trustline to receive issued
        settlement assets such as EPRW.
      </p>
      <Badge
        variant="outline"
        className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground"
      >
        <ShieldAlert className="mr-1 h-3 w-3" /> Trustline pending
      </Badge>
    </div>
  );
}
