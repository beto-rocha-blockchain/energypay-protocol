/**
 * BrandLogo — EnergyPay visual identity components.
 *
 * Circular deep-black badge, white ring, cyan→lime gradient lightning bolt.
 * Split wordmark: "ENERGY" white · "PAY" lime.
 *
 * Exports
 *   BrandBadge    — badge only (used in sidebar, auth pages)
 *   BrandName     — colored wordmark text only
 *   BrandWordmark — badge + name + tagline stacked (splash screen)
 */

/** Lime green — bolt top / "PAY" text / brand accent */
export const BRAND_LIME = "#66E619";
/** Cyan — bolt bottom / glow color */
export const BRAND_CYAN = "#00C8EE";

type Size = "sm" | "md" | "lg";

const DIM: Record<Size, { outer: number; ring: number; bolt: number }> = {
  sm: { outer: 28, ring: 2,   bolt: 13 },
  md: { outer: 36, ring: 2.5, bolt: 20 },
  lg: { outer: 140, ring: 5,  bolt: 78 },
};

const FONT_SIZE: Record<Size, number> = { sm: 12, md: 14, lg: 28 };

// ─── Badge ────────────────────────────────────────────────────────────────────

/**
 * Circular black badge with white ring + cyan→lime gradient lightning bolt.
 * `className` is forwarded to the outer div (e.g. for the splash `ep-splash-logo` glow).
 */
export function BrandBadge({
  size = "md",
  className,
}: {
  size?: Size;
  className?: string;
}) {
  const d = DIM[size];
  const gradId = `ep-bolt-${size}`;

  return (
    <div
      className={className}
      style={{
        width: d.outer,
        height: d.outer,
        borderRadius: "50%",
        background: "#050c09",
        border: `${d.ring}px solid rgba(255,255,255,0.88)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: `0 0 ${Math.round(d.outer * 0.45)}px rgba(0,200,238,0.14), inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={d.bolt}
        height={d.bolt}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={gradId}
            x1="12" y1="2"
            x2="12" y2="22"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%"   stopColor={BRAND_LIME} />
            <stop offset="100%" stopColor={BRAND_CYAN} />
          </linearGradient>
        </defs>
        <path
          d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
          fill={`url(#${gradId})`}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// ─── Name ─────────────────────────────────────────────────────────────────────

/**
 * "ENERGY" in white + "PAY" in lime. Inline — no wrapping layout.
 */
export function BrandName({ size = "md" }: { size?: Size }) {
  return (
    <span
      style={{
        fontFamily: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
        fontSize: FONT_SIZE[size],
        fontWeight: 700,
        letterSpacing: size === "lg" ? "0.04em" : "0.06em",
        lineHeight: 1,
      }}
    >
      <span style={{ color: "#F2F2F2" }}>ENERGY</span>
      <span style={{ color: BRAND_LIME }}>PAY</span>
    </span>
  );
}

// ─── Wordmark (badge + name + tagline stacked) ────────────────────────────────

/**
 * Full stacked identity for splash and large-format contexts.
 * Pass `badgeClassName` to attach the `ep-splash-logo` glow animation.
 */
export function BrandWordmark({
  size = "lg",
  badgeClassName,
}: {
  size?: Size;
  badgeClassName?: string;
}) {
  const isLg = size === "lg";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: isLg ? "1.25rem" : "0.5rem",
      }}
    >
      <BrandBadge size={size} className={badgeClassName} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: isLg ? "0.35rem" : "0.2rem",
        }}
      >
        <BrandName size={size} />
        <span
          style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: isLg ? "0.6rem" : "9px",
            fontWeight: 400,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: "oklch(0.50 0.018 240)",
            lineHeight: 1,
          }}
        >
          Clearing &amp; Settlement OS
        </span>
      </div>
    </div>
  );
}
