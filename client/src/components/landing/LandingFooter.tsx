import { Link } from "wouter";

/** Footer: Strikezone credit, copyright, admin login */
export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 border-t border-zinc-800/90 bg-[#0c0c0c] px-5 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="space-y-2">
          <p className="inline-flex items-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-900/50 px-3 py-1 text-xs font-medium text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden />
            Powered by team Strikezone
          </p>
          <p className="text-xs text-zinc-500">
            © {year} Strikescout. All rights reserved.
          </p>
        </div>
        <Link
          href="/login"
          className="text-xs text-zinc-500 underline-offset-4 transition-colors hover:text-blue-400 hover:underline"
        >
          Admin Login
        </Link>
      </div>
    </footer>
  );
}
