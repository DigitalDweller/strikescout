import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "framer-motion";

/** Hero: headline, CTAs, and dashboard art as ambient background */
export function LandingHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative z-10 overflow-x-hidden px-5 pb-16 pt-6 sm:px-8 lg:px-12 lg:pb-24 lg:pt-10">
      {/* Full viewport width so art bleeds past section padding; image anchored flush right. */}
      <div
        className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2"
        aria-hidden
      >
        <div
          className="absolute inset-0 opacity-[0.42] sm:opacity-50 lg:opacity-[0.55]"
          style={{
            backgroundImage: "url(/hero-dashboard-bg.png)",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right center",
            backgroundSize: "auto 108%",
          }}
        />
        {/* Stronger wash on the left so headline/body stay readable over the table art */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, #121212 0%, #121212 10%, rgba(18,18,18,0.98) 26%, rgba(18,18,18,0.92) 40%, rgba(18,18,18,0.62) 54%, rgba(18,18,18,0.22) 70%, transparent 90%)",
          }}
        />
        {/* Edge fades: top / right / left feather into shell */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(to bottom, rgb(18 18 18 / 0.42) 0%, rgb(18 18 18 / 0.12) 18%, transparent 32%),
              linear-gradient(to left, rgb(18 18 18 / 0.36) 0%, rgb(18 18 18 / 0.08) 40%, transparent min(36vw, 340px))
            `,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#121212]/25 via-transparent to-[#121212]/80" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <motion.div
          className="max-w-3xl space-y-8"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            Closed beta · FRC scouting
          </div>

          <div className="space-y-5">
            <h1 className="text-balance text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl xl:text-[3.5rem] xl:leading-[1.08]">
              FRC scouting{" "}
              <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                made simple.
              </span>
            </h1>
            <p className="max-w-xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">
              Scout matches, build picklists, and analyze team performance—all in one place. Built for
              FRC teams who want to focus on the game, not the paperwork.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/login" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full bg-blue-600 text-white shadow-lg shadow-black/25 hover:bg-blue-500 sm:min-w-[9.5rem]"
              >
                Sign In
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="w-full border-zinc-600 bg-transparent text-zinc-100 hover:bg-white/5 hover:text-white sm:w-auto"
              asChild
            >
              <a href="#waitlist">Join the Waitlist</a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
