import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Crosshair, ClipboardList, BarChart3, Users, Target } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-200 dark:bg-zinc-900">
      {/* Subtle grid background */}
      <div
        className="fixed inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      <header className="relative flex items-center justify-between px-6 py-4 shrink-0">
        <div className="flex items-center gap-2">
          <Crosshair className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold tracking-tight">Strikescout</span>
        </div>
        <Link href="/login">
          <Button variant="outline" size="sm">
            Sign In
          </Button>
        </Link>
      </header>

      <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="max-w-2xl space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
              FRC scouting made simple
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Scout matches, build picklists, and analyze team performance—all in one place. 
              Built for FIRST Robotics Competition teams who want to focus on the game, not the paperwork.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login">
              <Button size="lg" className="w-full sm:w-auto">
                Sign In
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-12 text-left">
            <div className="flex gap-3 p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
              <ClipboardList className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">Match Scouting</h3>
                <p className="text-sm text-muted-foreground">Capture data quickly during matches with streamlined forms.</p>
              </div>
            </div>
            <div className="flex gap-3 p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
              <BarChart3 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">Team Analytics</h3>
                <p className="text-sm text-muted-foreground">Compare teams, view rankings, and make data-driven picks.</p>
              </div>
            </div>
            <div className="flex gap-3 p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
              <Target className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">Picklists</h3>
                <p className="text-sm text-muted-foreground">Build and share alliance selection lists with your drive team.</p>
              </div>
            </div>
            <div className="flex gap-3 p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
              <Users className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">Scouter Leaderboard</h3>
                <p className="text-sm text-muted-foreground">Track scout contributions and keep your team engaged.</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-800/60 px-4 py-3 text-center">
            <p className="text-sm text-muted-foreground">
              Strikescout is <strong className="text-foreground">100% Strike Zone exclusive</strong>. Accounts are created by your team admin—contact them for your username and password.
            </p>
          </div>
        </div>
      </main>

      <footer className="relative py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Sign in with your admin-assigned credentials to get started.
        </p>
      </footer>
    </div>
  );
}
