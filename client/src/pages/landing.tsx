import {
  LandingBackground,
  LandingFooter,
  LandingFeatures,
  LandingHeader,
  LandingHero,
  WaitlistSection,
} from "@/components/landing";

/**
 * Public marketing page for Strikescout (closed beta).
 * Uses local `.dark` scope so the landing always reads as premium dark UI regardless of global theme.
 */
export default function Landing() {
  return (
    <div className="dark relative min-h-screen bg-[#121212] font-sans antialiased">
      <LandingBackground />

      <div className="relative z-[1] flex min-h-screen flex-col">
        <LandingHeader />

        <main className="flex-1">
          <LandingHero />
          <LandingFeatures />
          <WaitlistSection />
        </main>

        <LandingFooter />
      </div>
    </div>
  );
}
