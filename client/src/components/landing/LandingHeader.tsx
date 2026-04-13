import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AppLogoMark } from "@/components/app-logo-mark";

/** Top bar: brand + sign-in entry point */
export function LandingHeader() {
  return (
    <header className="relative z-10 flex shrink-0 items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
      <div className="flex items-center gap-2.5">
        <AppLogoMark />
        <span className="text-lg font-bold tracking-tight text-zinc-50 sm:text-xl">Strikescout</span>
      </div>
      <Link href="/login">
        <Button
          variant="ghost"
          size="sm"
          className="text-zinc-300 hover:bg-white/5 hover:text-white"
        >
          Sign In
        </Button>
      </Link>
    </header>
  );
}
