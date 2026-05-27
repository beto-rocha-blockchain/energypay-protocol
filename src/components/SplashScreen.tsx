/**
 * SplashScreen — EnergyPay institutional entry animation.
 *
 * Displays once per browser session (keyed via sessionStorage).
 * Children are rendered immediately so routing and auth work normally;
 * the overlay sits on top (z-9999) and fades out after the animation.
 *
 * Timing (normal motion):
 *   0 → 1 800 ms  logo glow pulse
 *   1 800 → 2 300 ms  overlay fades out
 *   2 300 ms  overlay removed from DOM
 *
 * prefers-reduced-motion: glow animation disabled, overlay removed in 500 ms.
 */

import { useEffect, useState } from "react";
import { BrandWordmark } from "@/components/BrandLogo";

const SESSION_KEY = "ep.splash.v1";
const GLOW_MS = 1800; // how long logo glows before fade begins
const FADE_MS = 500; // overlay opacity transition

type Phase = "done" | "showing" | "fading";

// ─────────────────────────────────────────────────────────────────────────────

export function SplashScreen({ children }: { children: React.ReactNode }) {
  // Start "done" to be SSR-safe — effect upgrades to "showing" on the client.
  const [phase, setPhase] = useState<Phase>("done");

  useEffect(() => {
    // Already shown this session → skip immediately.
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const glowTime = reduced ? 400 : GLOW_MS;
    const fadeTime = reduced ? 100 : FADE_MS;

    setPhase("showing");
    const t1 = setTimeout(() => setPhase("fading"), glowTime);
    const t2 = setTimeout(() => setPhase("done"), glowTime + fadeTime);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <>
      {/* App content renders immediately — auth, routing, hydration proceed normally. */}
      {children}

      {/* Fixed overlay — sits on top, removed from DOM once done. */}
      {phase !== "done" && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0",
            backgroundColor: "oklch(0.10 0.018 252)",
            opacity: phase === "fading" ? 0 : 1,
            transition:
              phase === "fading" ? `opacity ${FADE_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1)` : "none",
            pointerEvents: phase === "fading" ? "none" : "all",
          }}
        >
          <SplashLogoContent />
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SplashLogoContent() {
  const [imgFailed, setImgFailed] = useState(false);

  if (!imgFailed) {
    return (
      <img
        src="/brand/energypay-logo-splash.png"
        alt="EnergyPay"
        className="ep-splash-logo"
        style={{
          width: "min(300px, 58vw)",
          height: "auto",
          userSelect: "none",
          WebkitUserDrag: "none",
        } as React.CSSProperties}
        draggable={false}
        onError={() => setImgFailed(true)}
      />
    );
  }

  // ── CSS fallback — rendered when the PNG asset is not yet present ─────────
  return <BrandWordmark size="lg" badgeClassName="ep-splash-logo" />;
}
