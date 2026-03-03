import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
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
  MapPin,
  Loader2,
  Settings,
  AlertTriangle,
  Crosshair,
  Moon,
  Sun,
  ChevronDown,
  Tag,
  Wrench,
  Bug,
  Sparkles,
  Rocket,
  GitCommit,
  Clock,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import type { Event } from "@shared/schema";

const VERSION_HISTORY = [
  {
    version: "0.4.0",
    date: "Mar 2, 2026",
    tag: "latest",
    changes: [
      { type: "feature" as const, text: "Added version history and dev logs to home page" },
      { type: "feature" as const, text: "Playoff predictor with bracket visualization" },
      { type: "improvement" as const, text: "Improved team profile stat breakdowns" },
    ],
  },
  {
    version: "0.3.0",
    date: "Feb 20, 2026",
    changes: [
      { type: "feature" as const, text: "Picklist ranking system with drag-and-drop" },
      { type: "feature" as const, text: "Match schedule import from TBA" },
      { type: "fix" as const, text: "Fixed scouting form data not saving on slow connections" },
      { type: "improvement" as const, text: "Better mobile responsiveness across all pages" },
    ],
  },
  {
    version: "0.2.0",
    date: "Feb 8, 2026",
    changes: [
      { type: "feature" as const, text: "Team notes and collaborative scouting" },
      { type: "feature" as const, text: "Data export to CSV" },
      { type: "improvement" as const, text: "Dark mode theme with smoother transitions" },
      { type: "fix" as const, text: "Event deletion now properly cascades to all related data" },
    ],
  },
  {
    version: "0.1.0",
    date: "Jan 25, 2026",
    changes: [
      { type: "feature" as const, text: "Initial release with event management" },
      { type: "feature" as const, text: "Scouting form with customizable fields" },
      { type: "feature" as const, text: "Team list and basic profiles" },
    ],
  },
];

const DEV_LOGS = [
  {
    date: "Mar 2, 2026",
    title: "Home page polish",
    content:
      "Added version history and dev logs so the team can track what's changed. Also cleaned up some animation jank on the hero section.",
  },
  {
    date: "Feb 25, 2026",
    title: "Playoff predictor shipped",
    content:
      "The bracket visualization is live. It pulls alliance data and simulates outcomes based on OPR. Still need to fine-tune the prediction model but it's usable for strategy meetings.",
  },
  {
    date: "Feb 15, 2026",
    title: "TBA integration work",
    content:
      "Spent the weekend wiring up The Blue Alliance API for schedule imports. Saves a ton of manual entry. Next up: auto-pulling team lists per event.",
  },
  {
    date: "Feb 5, 2026",
    title: "Data layer refactor",
    content:
      "Migrated from raw SQL to Drizzle ORM. Much cleaner queries and type safety across the stack. Also fixed the cascading delete bug that was leaving orphaned scouting records.",
  },
  {
    date: "Jan 25, 2026",
    title: "We're live!",
    content:
      "First working version of StrikeScout deployed. Basic event CRUD, scouting forms, and team lists. Lots more to build but the foundation is solid.",
  },
];

const changeTypeConfig = {
  feature: { icon: Sparkles, label: "New", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  improvement: { icon: Wrench, label: "Improved", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  fix: { icon: Bug, label: "Fix", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
};

const createEventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  location: z.string().optional(),
  startDate: z.string().optional(),
});

const editEventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  location: z.string().optional(),
});

function DeleteConfirmDialog({
  event,
  open,
  onOpenChange,
  onDeleted,
}: {
  event: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const totalSteps = 5;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/events/${event.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event deleted" });
      onDeleted();
    },
  });

  useEffect(() => {
    if (!open) setStep(0);
  }, [open]);

  const messages = [
    `Are you sure you want to delete "${event.name}"?`,
    "This will permanently delete ALL scouting data for this event.",
    "All match schedule data will also be deleted.",
    "All team associations with this event will be removed.",
    "This action cannot be undone. Final confirmation required.",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Event ({step + 1}/{totalSteps})
          </DialogTitle>
          <DialogDescription>{messages[step]}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 w-full mt-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-destructive" : "bg-muted"}`}
            />
          ))}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-delete-cancel">
            Cancel
          </Button>
          {step < totalSteps - 1 ? (
            <Button
              variant="destructive"
              onClick={() => setStep(step + 1)}
              data-testid={`button-delete-confirm-${step + 1}`}
            >
              Yes, Continue ({step + 1}/{totalSteps})
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-final"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete Permanently
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventSettingsDialog({
  event,
  open,
  onOpenChange,
}: {
  event: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const form = useForm<z.infer<typeof editEventSchema>>({
    resolver: zodResolver(editEventSchema),
    defaultValues: { name: event.name, location: event.location || "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: event.name, location: event.location || "" });
    }
  }, [open, event]);

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editEventSchema>) => {
      const res = await apiRequest("PATCH", `/api/events/${event.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event updated" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update event", description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Dialog open={open && !deleteOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Event Settings</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. 2026 Houston Regional" data-testid="input-edit-event-name" />
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
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Houston, TX" data-testid="input-edit-event-location" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={updateMutation.isPending}
                  data-testid="button-save-event"
                >
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Changes
                </Button>
              </div>
              <div className="border-t pt-4">
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  onClick={() => setDeleteOpen(true)}
                  data-testid="button-open-delete"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Delete Event
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <DeleteConfirmDialog
        event={event}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => {
          setDeleteOpen(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}

export default function AdminEvents() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsEvent, setSettingsEvent] = useState<Event | null>(null);
  const { theme, toggleTheme } = useTheme();

  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
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

  const containerRef = useRef<HTMLDivElement>(null);
  const isAnimatingRef = useRef(false);
  const currentSectionRef = useRef(0);

  const smoothScrollTo = useCallback((target: number) => {
    const container = containerRef.current;
    if (!container) return;

    isAnimatingRef.current = true;
    const start = container.scrollTop;
    const distance = target - start;
    const duration = 800;
    let startTime: number | null = null;

    function easeInOutCubic(t: number) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function step(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);

      container!.scrollTop = start + distance * eased;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        isAnimatingRef.current = false;
      }
    }

    requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (isAnimatingRef.current) return;

      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const viewH = container.clientHeight;
        if (e.deltaY > 0 && currentSectionRef.current === 0) {
          currentSectionRef.current = 1;
          smoothScrollTo(viewH);
        } else if (e.deltaY < 0 && currentSectionRef.current === 1) {
          currentSectionRef.current = 0;
          smoothScrollTo(0);
        }
      }, 50);
    };

    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (isAnimatingRef.current) return;
      const delta = touchStartY - e.changedTouches[0].clientY;
      const viewH = container.clientHeight;
      if (delta > 50 && currentSectionRef.current === 0) {
        currentSectionRef.current = 1;
        smoothScrollTo(viewH);
      } else if (delta < -50 && currentSectionRef.current === 1) {
        currentSectionRef.current = 0;
        smoothScrollTo(0);
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchend", handleTouchEnd);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [smoothScrollTo]);

  const scrollToEvents = () => {
    if (isAnimatingRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    currentSectionRef.current = 1;
    smoothScrollTo(container.clientHeight);
  };

  return (
    <div ref={containerRef} className="h-screen overflow-hidden bg-background">
      <div className="fixed top-4 right-4 z-50">
        <Button
          size="icon"
          variant="ghost"
          onClick={toggleTheme}
          className="bg-background/50 backdrop-blur-sm"
          data-testid="button-toggle-theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      <div className="relative h-screen flex flex-col items-center justify-center overflow-hidden bg-zinc-200 dark:bg-zinc-900">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

        <div className="relative z-10 text-center space-y-4 px-4">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
            StrikeScout
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            FRC scouting for the 2026 Rebuilt season
          </p>
        </div>

        <button
          onClick={scrollToEvents}
          className="absolute bottom-8 z-10 flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors animate-bounce cursor-pointer bg-transparent border-none"
          data-testid="button-scroll-down"
        >
          <span className="text-sm font-medium">Your Events</span>
          <ChevronDown className="h-6 w-6" />
        </button>
      </div>

      <div id="events-section" className="h-screen overflow-y-auto p-4 sm:p-6 space-y-6 max-w-3xl mx-auto py-12">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold" data-testid="text-events-heading">Your Events</h2>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-event">
                <Plus className="h-4 w-4 mr-1" />
                New Event
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Event</DialogTitle>
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
                      <FormLabel>Event Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. 2026 Houston Regional" data-testid="input-event-name" />
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
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Houston, TX" data-testid="input-event-location" />
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
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-event-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-event"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create Event
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

        {isLoading ? (
          <motion.div
            className="space-y-3"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
              hidden: {},
            }}
          >
            {[1, 2, 3].map((i) => (
              <motion.div key={i} variants={{ visible: { opacity: 1, y: 0 }, hidden: { opacity: 0, y: 8 } }} transition={{ duration: 0.2 }}>
                <Card>
                  <CardContent className="p-4">
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : events?.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="font-semibold text-lg">No events yet</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Create your first event to start scouting robots.
              </p>
              <Button onClick={() => setCreateOpen(true)} data-testid="button-create-event-empty">
                <Plus className="h-4 w-4 mr-1" />
                Create Event
              </Button>
            </CardContent>
          </Card>
        ) : (
          <motion.div
            className="space-y-3"
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
                className="transition-transform duration-150 hover:translate-y-[-1px]"
              >
              <Card
                className="cursor-pointer hover-elevate transition-colors"
                data-testid={`card-event-${event.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className="flex-1 min-w-0"
                      onClick={() => setLocation(`/events/${event.id}`)}
                    >
                      <span className="font-semibold text-lg" data-testid={`text-event-name-${event.id}`}>
                        {event.name}
                      </span>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </span>
                        )}
                        {event.startDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {event.startDate}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSettingsEvent(event);
                      }}
                      data-testid={`button-settings-${event.id}`}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              </motion.div>
            ))}
          </motion.div>
        )}

        {settingsEvent && (
          <EventSettingsDialog
            event={settingsEvent}
            open={!!settingsEvent}
            onOpenChange={(open) => {
              if (!open) setSettingsEvent(null);
            }}
          />
        )}

        <div className="border-t mt-10 pt-10 space-y-10">
          {/* Version History */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center gap-2 mb-5">
              <Tag className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-bold">Version History</h2>
            </div>

            <div className="relative space-y-0">
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

              {VERSION_HISTORY.map((release, idx) => (
                <motion.div
                  key={release.version}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-20px" }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="relative pl-10 pb-6 last:pb-0"
                >
                  <div className="absolute left-[10px] top-1.5 h-[11px] w-[11px] rounded-full border-2 border-primary bg-background" />

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-base">v{release.version}</span>
                    <span className="text-xs text-muted-foreground">{release.date}</span>
                    {release.tag && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {release.tag}
                      </Badge>
                    )}
                  </div>

                  <ul className="mt-2 space-y-1.5">
                    {release.changes.map((change, cIdx) => {
                      const config = changeTypeConfig[change.type];
                      const Icon = config.icon;
                      return (
                        <li key={cIdx} className="flex items-start gap-2 text-sm">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 shrink-0 mt-0.5 font-medium ${config.className}`}
                          >
                            <Icon className="h-2.5 w-2.5 mr-0.5" />
                            {config.label}
                          </Badge>
                          <span className="text-muted-foreground">{change.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Dev Logs */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="pb-12"
          >
            <div className="flex items-center gap-2 mb-5">
              <GitCommit className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-bold">Dev Logs</h2>
            </div>

            <div className="space-y-3">
              {DEV_LOGS.map((log, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-20px" }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-semibold text-sm">{log.title}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto shrink-0">
                          <Clock className="h-3 w-3" />
                          {log.date}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {log.content}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
