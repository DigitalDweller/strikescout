import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ClipboardList,
  Minus,
  Plus,
  Send,
  Calendar,
  Radio,
  Loader2,
  Check,
} from "lucide-react";
import type { Event, Team, EventTeam } from "@shared/schema";

const scoutFormSchema = z.object({
  teamId: z.number().min(1, "Please select a team"),
  autoScore: z.number().min(0),
  teleopScore: z.number().min(0),
  endgameScore: z.number().min(0),
  defenseRating: z.number().min(1).max(5),
  notes: z.string().optional(),
});

function CounterInput({
  value,
  onChange,
  label,
  color,
  testId,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  color: string;
  testId: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => onChange(Math.max(0, value - 1))}
          data-testid={`button-${testId}-minus`}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span
          className={`text-3xl font-bold w-16 text-center tabular-nums ${color}`}
          data-testid={`text-${testId}-value`}
        >
          {value}
        </span>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => onChange(value + 1)}
          data-testid={`button-${testId}-plus`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function ScoutForm() {
  const { toast } = useToast();

  const { data: activeEvent, isLoading: eventLoading } = useQuery<Event | null>({
    queryKey: ["/api/active-event"],
    refetchInterval: 10000,
  });

  const { data: eventTeams } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", activeEvent?.id, "teams"],
    enabled: !!activeEvent,
  });

  const form = useForm<z.infer<typeof scoutFormSchema>>({
    resolver: zodResolver(scoutFormSchema),
    defaultValues: {
      teamId: 0,
      autoScore: 0,
      teleopScore: 0,
      endgameScore: 0,
      defenseRating: 3,
      notes: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: z.infer<typeof scoutFormSchema>) => {
      const res = await apiRequest("POST", "/api/entries", {
        ...data,
        eventId: activeEvent!.id,
        matchNumber: activeEvent!.currentMatchNumber,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Entry submitted successfully" });
      form.reset({
        teamId: 0,
        autoScore: 0,
        teleopScore: 0,
        endgameScore: 0,
        defenseRating: 3,
        notes: "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scouters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit entry",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (eventLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!activeEvent) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight mb-6" data-testid="text-page-title">Scout</h1>
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No Active Event</p>
            <p className="text-sm text-muted-foreground mt-1">
              Wait for your admin to set an active event.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Scout</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Radio className="h-3 w-3 text-chart-2" />
            <span>{activeEvent.name}</span>
          </div>
        </div>
        <Badge variant="default" className="text-sm px-3 py-1">
          Match {activeEvent.currentMatchNumber}
        </Badge>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => submitMutation.mutate(data))}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="teamId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team</FormLabel>
                    <Select
                      value={field.value ? field.value.toString() : ""}
                      onValueChange={(v) => field.onChange(parseInt(v))}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-team">
                          <SelectValue placeholder="Select the team you're scouting" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {eventTeams?.map((et) => (
                          <SelectItem key={et.teamId} value={et.teamId.toString()}>
                            #{et.team.teamNumber} - {et.team.teamName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-6 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="autoScore"
                  render={({ field }) => (
                    <FormItem>
                      <CounterInput
                        value={field.value}
                        onChange={field.onChange}
                        label="Auto Score"
                        color="text-primary"
                        testId="auto-score"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="teleopScore"
                  render={({ field }) => (
                    <FormItem>
                      <CounterInput
                        value={field.value}
                        onChange={field.onChange}
                        label="Teleop Score"
                        color="text-chart-2"
                        testId="teleop-score"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endgameScore"
                  render={({ field }) => (
                    <FormItem>
                      <CounterInput
                        value={field.value}
                        onChange={field.onChange}
                        label="Endgame Score"
                        color="text-chart-3"
                        testId="endgame-score"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="defenseRating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Defense Rating</FormLabel>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Button
                          key={n}
                          type="button"
                          variant={field.value === n ? "default" : "outline"}
                          size="icon"
                          onClick={() => field.onChange(n)}
                          data-testid={`button-defense-${n}`}
                        >
                          {n}
                        </Button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Any observations about this robot..."
                        className="resize-none"
                        rows={3}
                        data-testid="textarea-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitMutation.isPending}
                data-testid="button-submit-entry"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Send className="h-5 w-5 mr-2" />
                )}
                Submit Entry
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
