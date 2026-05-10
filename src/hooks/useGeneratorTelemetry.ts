import { useEffect, useMemo, useState } from "react";

/**
 * Live generator telemetry simulator.
 *
 * Produces SCADA-style time-series for the Generator Operations Terminal.
 * The numbers are deterministic seed + jitter so the visualization stays
 * lively without misrepresenting backend reality.
 */

export type Source = "SOLAR" | "WIND";

export type GenerationSample = {
  hour: string; // "HH:00" UTC
  solar: number; // kWh
  wind: number; // kWh
  total: number; // kWh
};

export type GeneratorTelemetry = {
  capacityKwh: number;
  currentOutputKwh: number;
  totalGeneratedMwh: number;
  inventoryMwh: number;
  efficiencyPct: number;
  solarPct: number;
  windPct: number;
  gridInjectionMw: number;
  activeContracts: number;
  eprwGenerated: number;
  eprwSold: number;
  eprwSettlementVolume: number;
  hourlySeries: GenerationSample[];
  forecastNext24Mwh: number;
  forecastEprw: number;
  marketDemandIndex: number; // 0-100
  liquidityIndex: number; // 0-100
  regions: { name: string; status: "ONLINE" | "DEGRADED" | "OFFLINE"; outputKwh: number }[];
  syncedAt: string;
};

const HOURS = 24;

const seedNoise = (i: number, base: number, span: number) =>
  base + Math.sin(i * 0.7) * span * 0.4 + (Math.cos(i * 1.3 + 1.2) * span) * 0.2;

const buildHourly = (now: Date, jitter: number): GenerationSample[] => {
  const out: GenerationSample[] = [];
  const baseHour = now.getUTCHours();
  for (let i = 0; i < HOURS; i++) {
    const h = (baseHour - (HOURS - 1 - i) + 24) % 24;
    // Solar curve peaks midday.
    const solarShape = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
    const solar = Math.max(0, solarShape * 480 + seedNoise(i, 30, 60) + jitter * 14);
    // Wind: bimodal, less day-coupled.
    const wind = Math.max(0, 220 + Math.cos(h / 3) * 90 + seedNoise(i + 7, 40, 70) + jitter * 22);
    const total = solar + wind;
    out.push({
      hour: `${String(h).padStart(2, "0")}:00`,
      solar: Math.round(solar),
      wind: Math.round(wind),
      total: Math.round(total),
    });
  }
  return out;
};

const REGIONS = [
  { name: "Plant Sertão · BR-NE", base: 320, source: "SOLAR" as const },
  { name: "Plant Costa do Vento · BR-NE", base: 280, source: "WIND" as const },
  { name: "Plant Cerrado · BR-CO", base: 190, source: "SOLAR" as const },
  { name: "Plant Pampa · BR-S", base: 240, source: "WIND" as const },
];

export function useGeneratorTelemetry(opts?: { eprwBalance?: number }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 5_000);
    return () => window.clearInterval(id);
  }, []);

  const telemetry = useMemo<GeneratorTelemetry>(() => {
    const now = new Date();
    const jitter = (Math.sin(tick * 1.7) + Math.cos(tick * 0.9)) * 0.5;
    const hourlySeries = buildHourly(now, jitter);

    const last = hourlySeries[hourlySeries.length - 1];
    const totalGeneratedMwh =
      hourlySeries.reduce((acc, s) => acc + s.total, 0) / 1000;
    const capacityKwh = 1_400; // nominal nameplate
    const currentOutputKwh = last.total;
    const efficiencyPct = Math.min(99, (currentOutputKwh / capacityKwh) * 100);
    const solarSum = hourlySeries.reduce((a, s) => a + s.solar, 0);
    const windSum = hourlySeries.reduce((a, s) => a + s.wind, 0);
    const totalSum = solarSum + windSum || 1;
    const solarPct = (solarSum / totalSum) * 100;
    const windPct = (windSum / totalSum) * 100;

    // EPWR: 1 EPWR ≈ 1 kWh tokenized.
    const eprwGenerated = Math.round(totalGeneratedMwh * 1000 * 0.92);
    const eprwSold = Math.round(eprwGenerated * 0.71);
    const eprwSettlementVolume = Math.round(eprwSold * 0.84);
    const inventoryMwh = Math.max(
      0,
      ((opts?.eprwBalance ?? eprwGenerated - eprwSold) / 1000),
    );

    const regions = REGIONS.map((r, i) => {
      const out = Math.max(
        0,
        r.base + Math.sin(tick * 0.6 + i) * 40 + Math.cos(i * 1.1) * 20,
      );
      const status: "ONLINE" | "DEGRADED" | "OFFLINE" =
        i === 2 && Math.sin(tick * 0.4) > 0.85
          ? "DEGRADED"
          : "ONLINE";
      return { name: r.name, status, outputKwh: Math.round(out) };
    });

    const forecastNext24Mwh = Math.round(totalGeneratedMwh * 1.04 * 100) / 100;
    const forecastEprw = Math.round(forecastNext24Mwh * 1000 * 0.9);
    const marketDemandIndex = Math.round(
      62 + Math.sin(tick * 0.5) * 12 + Math.cos(tick * 0.21) * 6,
    );
    const liquidityIndex = Math.round(
      71 + Math.cos(tick * 0.33) * 9 + Math.sin(tick * 0.17) * 5,
    );

    return {
      capacityKwh,
      currentOutputKwh,
      totalGeneratedMwh: Math.round(totalGeneratedMwh * 100) / 100,
      inventoryMwh: Math.round(inventoryMwh * 100) / 100,
      efficiencyPct: Math.round(efficiencyPct * 10) / 10,
      solarPct: Math.round(solarPct),
      windPct: Math.round(windPct),
      gridInjectionMw: Math.round((currentOutputKwh / 1000) * 100) / 100,
      activeContracts: 7 + (tick % 3),
      eprwGenerated,
      eprwSold,
      eprwSettlementVolume,
      hourlySeries,
      forecastNext24Mwh,
      forecastEprw,
      marketDemandIndex,
      liquidityIndex,
      regions,
      syncedAt: now.toISOString(),
    };
  }, [tick, opts?.eprwBalance]);

  return telemetry;
}
