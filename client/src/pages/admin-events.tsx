import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import type { Event } from "@shared/schema";
import heroBg from "@assets/image_1772067780700.png";

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

      <div className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
        <img
          src={heroBg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-background" />

        <div className="relative z-10 text-center space-y-4 px-4">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white drop-shadow-lg" data-testid="text-page-title">
            StrikeScout
          </h1>
          <p className="text-white/90 text-lg max-w-md mx-auto drop-shadow-md">
            FRC scouting for the 2026 Rebuilt season
          </p>
        </div>

        <button
          onClick={scrollToEvents}
          className="absolute bottom-8 z-10 flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors animate-bounce cursor-pointer bg-transparent border-none"
          data-testid="button-scroll-down"
        >
          <span className="text-sm font-medium drop-shadow-md">Your Events</span>
          <ChevronDown className="h-6 w-6 drop-shadow-md" />
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
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
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
          <div className="space-y-3">
            {events?.map((event) => (
              <Card
                key={event.id}
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
            ))}
          </div>
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
      </div>
    </div>
  );
}
