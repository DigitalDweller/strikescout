import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LandingBackground } from "@/components/landing/LandingBackground";
import { Loader2, ArrowLeft } from "lucide-react";
import { AppLogoMark } from "@/components/app-logo-mark";

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      setLocation("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark relative min-h-screen bg-[#121212] font-[Inter,system-ui,sans-serif] antialiased">
      <LandingBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Match landing header: brand + subtle nav */}
        <header className="flex shrink-0 items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <AppLogoMark />
            <span className="text-lg font-bold tracking-tight text-zinc-50 sm:text-xl">Strikescout</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-4 pb-12 pt-4 sm:px-6">
          <div className="w-full max-w-[400px] space-y-8">
            <div className="space-y-2 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
                Secure sign-in
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">Welcome back</h1>
              <p className="text-sm text-zinc-400 sm:text-base">
                Sign in with your team credentials to open your events and scouting data.
              </p>
            </div>

            {/* Glass panel — same language as landing waitlist / hero mockup */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
              <form onSubmit={handleSubmit} className="relative space-y-5 pt-1">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-zinc-200">
                    Username
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    autoComplete="username"
                    autoFocus
                    required
                    className="border-zinc-700 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-zinc-200">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="border-zinc-700 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500"
                  />
                  <p className="text-xs text-zinc-500">All passwords are encrypted.</p>
                </div>
                {error ? <p className="text-sm font-medium text-red-400">{error}</p> : null}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white shadow-lg shadow-black/25 hover:bg-blue-500"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </div>

            <p className="text-center text-xs text-zinc-500">
              Contact your team admin for a username and password.
            </p>
          </div>
        </main>

        <footer className="border-t border-zinc-800/90 bg-[#0c0c0c] px-5 py-6 text-center sm:px-8">
          <p className="inline-flex items-center gap-2 text-xs text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden />
            Powered by team Strikezone
          </p>
        </footer>
      </div>
    </div>
  );
}
