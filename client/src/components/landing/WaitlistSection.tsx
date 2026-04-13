import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

/**
 * Closed-beta waitlist form.
 * Wire `onSubmit` to your API when ready; currently acknowledges client-side.
 */
export function WaitlistSection() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [teamNumber, setTeamNumber] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      // Replace with POST /api/waitlist when backend is available
      await new Promise((r) => setTimeout(r, 650));
      toast({
        title: "Request received",
        description: "Thanks—we’ll notify you when beta access opens up.",
      });
      setName("");
      setEmail("");
      setTeamNumber("");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      id="waitlist"
      className="relative z-10 scroll-mt-24 border-t border-blue-500/30 bg-zinc-900/80 px-5 py-20 sm:px-8 lg:px-12"
    >
      <div className="mx-auto max-w-lg">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
            Want Strikescout for your team?
          </h2>
          <p className="mt-3 text-pretty text-zinc-400">
            We are currently in closed beta. Join the waitlist to get notified when we open up to
            the public.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-zinc-700/80 bg-zinc-950/60 p-6 shadow-xl shadow-black/20 backdrop-blur-sm sm:p-8"
        >
          <div className="space-y-2">
            <Label htmlFor="waitlist-name" className="text-zinc-200">
              Name
            </Label>
            <Input
              id="waitlist-name"
              name="name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jeffery"
              className="border-zinc-700 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="waitlist-email" className="text-zinc-200">
              Email address
            </Label>
            <Input
              id="waitlist-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@team.org"
              className="border-zinc-700 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="waitlist-team" className="text-zinc-200">
              FRC team number
            </Label>
            <Input
              id="waitlist-team"
              name="teamNumber"
              inputMode="numeric"
              required
              value={teamNumber}
              onChange={(e) => setTeamNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="5460"
              className="border-zinc-700 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="w-full bg-blue-600 text-white shadow-lg shadow-black/25 hover:bg-blue-500"
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              "Request Beta Access"
            )}
          </Button>
        </form>
      </div>
    </section>
  );
}
