import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, User as UserIcon, ClipboardList, Calendar, Award, Trophy, History } from "lucide-react";
import { getHeatColor } from "@/lib/team-colors";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RepHistoryItem {
  type: "event" | "entry" | "award";
  amount: number;
  label: string;
  createdAt: string;
  awardedBy?: string;
}

interface ScouterProfileData {
  id: number;
  displayName: string;
  role: string;
  totalEntries: number;
  rep: number;
  repHistory: RepHistoryItem[];
  events: { eventId: number; eventName: string; entryCount: number }[];
}

export default function ScouterProfile() {
  const { id: eventIdParam, scouterId: scouterIdParam } = useParams<{ id: string; scouterId: string }>();
  const eventId = parseInt(eventIdParam || "0");
  const scouterId = parseInt(scouterIdParam || "0");
  const { user } = useAuth();
  const { toast } = useToast();
  const isOwnProfile = user?.id === scouterId;
  const isAdmin = user?.role === "admin";
  const [awardOpen, setAwardOpen] = useState(false);
  const [awardAmount, setAwardAmount] = useState("10");
  const [awardReason, setAwardReason] = useState("");

  const { data: profile, isLoading } = useQuery<ScouterProfileData>({
    queryKey: ["/api/users", scouterId, "profile"],
    enabled: !!scouterId,
  });

  const awardMutation = useMutation({
    mutationFn: async ({ amount, reason }: { amount: number; reason: string }) => {
      await apiRequest("POST", `/api/users/${scouterId}/rep-awards`, { amount, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", scouterId, "profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "scouters"] });
      setAwardOpen(false);
      setAwardAmount("10");
      setAwardReason("");
      toast({ title: "Rep awarded" });
    },
    onError: (e: Error) => toast({ title: "Failed to award rep", description: e.message, variant: "destructive" }),
  });

  const handleAward = () => {
    const amount = parseInt(awardAmount, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Enter a valid positive amount", variant: "destructive" });
      return;
    }
    awardMutation.mutate({ amount, reason: awardReason.trim() });
  };

  const repMax = profile?.rep ? Math.max(profile.rep, 50) : 50;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <Link href={`/events/${eventId}/scouters`}>
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Scouters
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !profile ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-base text-muted-foreground">Profile not found.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <UserIcon className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                {profile.displayName}
                {isOwnProfile && (
                  <Badge variant="secondary" className="text-xs">
                    You
                  </Badge>
                )}
              </h1>
              <Badge variant="outline" className="mt-2">
                {profile.role === "admin" ? "Admin" : "Scouter"}
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  Rep
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-3xl font-bold inline-block rounded-lg px-2 py-1 ${getHeatColor(profile.rep, 0, repMax)}`}
                  data-testid="text-total-rep"
                >
                  {profile.rep}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  10 per event + 1 per entry + admin awards
                </p>
                {isAdmin && profile.role === "scouter" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setAwardOpen(true)}
                    data-testid="button-award-rep"
                  >
                    <Award className="h-3.5 w-3.5 mr-1" />
                    Award rep
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Total Entries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold" data-testid="text-total-entries">
                  {profile.totalEntries}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  scouting entries across all events
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Events Scouted
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold" data-testid="text-events-count">
                  {profile.events.length}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  events participated
                </p>
              </CardContent>
            </Card>
          </div>

          {profile.repHistory && profile.repHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Rep History
                </CardTitle>
                <p className="text-sm text-muted-foreground font-normal">
                  How you earned your rep
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {profile.repHistory.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-green-600 dark:text-green-400">+{item.amount}</span>
                        {item.createdAt && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        )}
                        {item.awardedBy && (
                          <span className="text-xs text-muted-foreground">by {item.awardedBy}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {profile.events.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Per-Event Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {profile.events.map(e => (
                    <li
                      key={e.eventId}
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                    >
                      <span className="font-medium">{e.eventName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">
                          {e.entryCount} entries
                        </span>
                        <Link href={`/events/${e.eventId}/scout`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            {e.eventId === eventId ? "This event" : "View event"}
                          </Button>
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {isOwnProfile && (
            <Link href={`/events/${eventId}/scout/history`}>
              <Button variant="outline" data-testid="button-my-form-history">
                View My Form History
              </Button>
            </Link>
          )}
        </>
      )}

      <Dialog open={awardOpen} onOpenChange={setAwardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Award Rep</DialogTitle>
            <DialogDescription>
              Give rep to {profile?.displayName}. Rep is added to their total.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                min={1}
                value={awardAmount}
                onChange={(e) => setAwardAmount(e.target.value)}
                placeholder="10"
                data-testid="input-award-amount"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Reason (optional)</label>
              <Input
                value={awardReason}
                onChange={(e) => setAwardReason(e.target.value)}
                placeholder="e.g. Great scouting at Houston"
                data-testid="input-award-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAwardOpen(false)}>Cancel</Button>
            <Button onClick={handleAward} disabled={awardMutation.isPending} data-testid="button-award-submit">
              Award
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
