type LandingBackgroundTone = "landing" | "dashboard";

/**
 * Ambient background: soft blue radial glows (+ optional faint grid on dashboard only).
 * Home / login use no grid so the hero art and top of the page stay clean.
 * `dashboard` uses a slightly deeper base (#0a0a0a) to match the authenticated app shell.
 */
export function LandingBackground({ tone = "landing" }: { tone?: LandingBackgroundTone }) {
  const baseClass = tone === "dashboard" ? "bg-[#0a0a0a]" : "bg-[#121212]";
  const vignetteRgb = tone === "dashboard" ? "rgb(10 10 10 / 0.45)" : "rgb(18 18 18 / 0.4)";

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Base wash */}
      <div className={`absolute inset-0 ${baseClass}`} />

      {/* Soft blue radial glows */}
      <div
        className="absolute -left-[20%] top-0 h-[min(70vh,520px)] w-[min(70vw,600px)] rounded-full opacity-[0.35] blur-[100px]"
        style={{
          background: "radial-gradient(closest-side, rgb(37 99 235 / 0.45), transparent 70%)",
        }}
      />
      <div
        className="absolute -right-[15%] top-[35%] h-[min(60vh,480px)] w-[min(65vw,560px)] rounded-full opacity-[0.22] blur-[110px]"
        style={{
          background: "radial-gradient(closest-side, rgb(59 130 246 / 0.35), transparent 72%)",
        }}
      />
      <div
        className="absolute bottom-0 left-1/2 h-[min(45vh,400px)] w-[min(90vw,900px)] -translate-x-1/2 rounded-full opacity-[0.18] blur-[90px]"
        style={{
          background: "radial-gradient(closest-side, rgb(29 78 216 / 0.3), transparent 75%)",
        }}
      />

      {/* Faint grid — dashboard / app shell only (not marketing hero) */}
      {tone === "dashboard" && (
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `
            linear-gradient(to right, rgb(148 163 184 / 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(148 163 184 / 0.15) 1px, transparent 1px)
          `,
            backgroundSize: "56px 56px",
            maskImage: "linear-gradient(to bottom, black 0%, black 60%, transparent 100%)",
          }}
        />
      )}

      {/* Subtle vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 0%, transparent 0%, ${vignetteRgb} 100%)`,
        }}
      />
    </div>
  );
}
