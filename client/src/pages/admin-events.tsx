import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { AppLogoMark } from "@/components/app-logo-mark";
import { DatePicker } from "@/components/DatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LandingBackground } from "@/components/landing/LandingBackground";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Plus,
  Calendar,
  Clock,
  Loader2,
  Moon,
  Sun,
  LogOut,
  Shield,
  Cog,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import type { Event, Season } from "@shared/schema";

/** Re-export API event model for consumers of dashboard-related types. */
export type { Event };

function getEventDateAndTime(startDate?: string | null): { date: string; time: string } {
  if (!startDate) return { date: "TBD", time: "TBD" };
  const raw = startDate.trim();
  if (!raw) return { date: "TBD", time: "TBD" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { date: raw, time: "TBD" };
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      date: parsed.toLocaleDateString(),
      time: parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  }
  return { date: raw, time: "TBD" };
}

const createEventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  location: z.string().optional(),
  startDate: z.string().optional(),
});

export default function AdminEvents() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: seasons } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
  });

  const { data: selectedSeasonPayload } = useQuery<{ selectedYear: number }>({
    queryKey: ["/api/selected-season"],
  });
  const selectedYear = selectedSeasonPayload?.selectedYear;

  const selectSeasonMutation = useMutation({
    mutationFn: async (year: number) => {
      const res = await apiRequest("PATCH", "/api/selected-season", { year });
      return (await res.json()) as { selectedYear: number };
    },
    onError: (error: Error) => {
      toast({ title: "Could not change season", description: error.message, variant: "destructive" });
    },
  });

  const form = useForm<z.infer<typeof createEventSchema>>({
    resolver: zodResolver(createEventSchema),
    defaultValues: { name: "", location: "", startDate: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createEventSchema>) => {
      const res = await apiRequest("POST", "/api/events", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      form.reset();
      setCreateOpen(false);
      toast({ title: "Event created" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create event", description: error.message, variant: "destructive" });
    },
  });

  const glassNavBtn =
    "h-10 w-10 rounded-xl border border-zinc-700/60 bg-zinc-900/50 text-zinc-400 shadow-sm backdrop-blur-md transition-all hover:border-blue-500/30 hover:bg-zinc-800/60 hover:text-zinc-100 hover:shadow-md hover:shadow-black/30";

  return (
    <div className="dark relative min-h-screen overflow-x-hidden bg-[#0a0a0a] font-[Inter,system-ui,sans-serif] antialiased text-zinc-100">
      <LandingBackground tone="dashboard" />

      <div className="fixed right-4 top-4 z-50 flex items-center gap-1.5 rounded-2xl border border-white/10 bg-zinc-950/70 p-1.5 shadow-lg shadow-black/40 backdrop-blur-xl sm:right-6 sm:gap-2">
        {user?.role === "admin" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className={glassNavBtn} asChild data-testid="button-admin-users">
                <Link href="/admin/users">
                  <Shield className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="border-zinc-700 bg-zinc-900 text-zinc-200">
              Admin — manage users
            </TooltipContent>
          </Tooltip>
        )}
        {user?.role === "admin" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className={glassNavBtn} asChild data-testid="button-global-settings">
                <Link href="/admin/global-settings">
                  <Cog className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="border-zinc-700 bg-zinc-900 text-zinc-200">
              Global settings
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className={glassNavBtn}
              onClick={toggleTheme}
              data-testid="button-toggle-theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="border-zinc-700 bg-zinc-900 text-zinc-200">
            Theme
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className={glassNavBtn} onClick={logout} data-testid="button-logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="border-zinc-700 bg-zinc-900 text-zinc-200">
            Log out{user?.username ? ` (${user.username})` : ""}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="relative z-10 w-full px-4 pb-14 pt-20 sm:px-6 lg:px-10 lg:pt-24 xl:px-14 2xl:px-16">
        <div className="mx-auto max-w-[1680px] space-y-8">
          <header className="border-b border-zinc-800/80 pb-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <AppLogoMark boxClassName="h-12 w-12 sm:h-14 sm:w-14" imgClassName="h-10 w-10 sm:h-12 sm:w-12" />
                  <div>
                    <h1
                      className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl"
                      data-testid="text-page-title"
                    >
                      Season dashboard
                    </h1>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2 lg:max-w-sm lg:items-end">
                {user?.role === "admin" && seasons && seasons.length > 0 && selectedYear != null ? (
                  <>
                    <Label htmlFor="season-select" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      Season
                    </Label>
                    <Select
                      value={String(selectedYear)}
                      disabled={selectSeasonMutation.isPending}
                      onValueChange={(v) => selectSeasonMutation.mutate(Number(v))}
                    >
                      <SelectTrigger
                        id="season-select"
                        className="h-11 w-full min-w-[200px] border-zinc-700 bg-zinc-900 text-sm font-medium text-zinc-100 focus:ring-blue-500/30 lg:w-[220px]"
                        data-testid="select-season"
                      >
                        <SelectValue placeholder="Season" />
                      </SelectTrigger>
                      <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
                        {seasons.map((s) => (
                          <SelectItem
                            key={s.year}
                            value={String(s.year)}
                            className="focus:bg-zinc-800 focus:text-zinc-100"
                          >
                            {s.year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : null}

              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-8">
            <section className="min-w-0 space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-zinc-100 sm:text-2xl" data-testid="text-events-heading">
                    Events
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">Manage your season events.</p>
                </div>
                {user?.role === "admin" && (
                  <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                      <Button
                        data-testid="button-create-event"
                        className="w-full border border-blue-500/30 bg-blue-600/90 text-sm font-semibold tracking-tight text-white transition-colors hover:bg-blue-500 sm:w-auto"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        New Event
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
                      <DialogHeader>
                        <DialogTitle className="text-lg font-semibold tracking-tight text-zinc-100">Create Event</DialogTitle>
                      </DialogHeader>
                      <Form {...form}>
                        <form
                          onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
                          className="space-y-4"
                        >
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-zinc-300">Event Name</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="e.g. 2026 Houston Regional"
                                    data-testid="input-event-name"
                                    className="border-zinc-700 bg-zinc-950/50 text-zinc-100"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="location"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-zinc-300">Location</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="e.g. Houston, TX"
                                    data-testid="input-event-location"
                                    className="border-zinc-700 bg-zinc-950/50 text-zinc-100"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="startDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-zinc-300">Start Date</FormLabel>
                                <FormControl>
                                  <DatePicker
                                    ref={field.ref}
                                    value={field.value ?? ""}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    placeholder="Pick start date"
                                    data-testid="input-event-date"
                                    triggerClassName="border-zinc-700 bg-zinc-950/50 text-zinc-100 hover:bg-zinc-950/50 hover:text-zinc-100"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            type="submit"
                            className="w-full bg-blue-600 text-sm font-semibold tracking-tight text-white shadow-lg shadow-black/25 hover:bg-blue-500"
                            disabled={createMutation.isPending}
                            data-testid="button-submit-event"
                          >
                            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Event
                          </Button>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {isLoading ? (
                <motion.div
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
                    hidden: {},
                  }}
                >
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <motion.div
                      key={i}
                      variants={{ visible: { opacity: 1, y: 0 }, hidden: { opacity: 0, y: 8 } }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="h-full overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 backdrop-blur-md">
                        <Skeleton className="h-24 w-full bg-zinc-800/80" />
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : events?.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-700/60 bg-zinc-900/30 px-6 py-14 text-center backdrop-blur-sm sm:px-10">
                  <Calendar className="mx-auto mb-4 h-12 w-12 text-zinc-500" />
                  <p className="text-xl font-semibold tracking-tight text-zinc-200">No events yet</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {user?.role === "admin"
                      ? "Create your first event to start scouting robots."
                      : "No events have been created. Ask an admin to set one up."}
                  </p>
                  {user?.role === "admin" && (
                    <Button
                      className="mt-6 bg-blue-600 text-white shadow-lg shadow-black/25 hover:bg-blue-500"
                      onClick={() => setCreateOpen(true)}
                      data-testid="button-create-event-empty"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Event
                    </Button>
                  )}
                </div>
              ) : (
                <motion.div
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: { transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
                    hidden: {},
                  }}
                >
                  {events?.map((event) => (
                    <motion.div
                      key={event.id}
                      variants={{ visible: { opacity: 1, y: 0 }, hidden: { opacity: 0, y: 10 } }}
                      transition={{ duration: 0.25, ease: [0.33, 1, 0.68, 1] }}
                      className="h-full"
                    >
                      <Card
                        variant="glassHover"
                        className="group relative flex h-full flex-col overflow-hidden border-zinc-800 bg-zinc-950/60 p-5"
                        data-testid={`card-event-${event.id}`}
                      >
                        {(() => {
                          const { date, time } = getEventDateAndTime(event.startDate);
                          return (
                        <div className="flex flex-1 items-center gap-4">
                          <Button
                            type="button"
                            variant="ghost"
                            className="min-h-0 w-full p-0 text-left font-normal transition-transform hover:bg-transparent active:scale-[0.99]"
                            onClick={() =>
                              setLocation(
                                user?.role === "admin"
                                  ? `/events/${event.id}`
                                  : `/events/${event.id}/scouting-schedule`
                              )
                            }
                          >
                            <div className="flex w-full items-center justify-between gap-4">
                              <span
                                className="line-clamp-2 flex-1 self-center text-left text-xl font-semibold tracking-tight leading-snug text-zinc-100"
                                data-testid={`text-event-name-${event.id}`}
                              >
                                {event.name}
                              </span>
                              <div className="ml-auto flex min-h-[3.25rem] min-w-[10rem] flex-col items-end justify-between text-right text-sm leading-relaxed text-zinc-400">
                                <span className="flex items-center gap-2">
                                  <Clock className="h-3.5 w-3.5 shrink-0 text-blue-400/80" />
                                  <span className="tabular-nums">{time}</span>
                                </span>
                                <span className="flex items-center gap-2">
                                  <Calendar className="h-3.5 w-3.5 shrink-0 text-blue-400/80" />
                                  <span className="tabular-nums">{date}</span>
                                </span>
                              </div>
                            </div>
                          </Button>
                        </div>
                          );
                        })()}
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
