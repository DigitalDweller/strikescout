import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertEventSchema, insertTeamSchema, insertScoutingEntrySchema } from "@shared/schema";
import { z } from "zod";

async function seedDatabase() {
  const events = await storage.getEvents();
  if (events.length > 0) return;

  await storage.createEvent({
    name: "2026 Houston Regional",
    location: "Houston, TX",
    startDate: "2026-03-15",
    isActive: true,
    currentMatchNumber: 1,
  });

  console.log("Database seeded with initial data");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/events", async (_req, res) => {
    const allEvents = await storage.getEvents();
    res.json(allEvents);
  });

  app.post("/api/events", async (req, res) => {
    const parsed = insertEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const event = await storage.createEvent(parsed.data);
    res.status(201).json(event);
  });

  app.get("/api/events/:id", async (req, res) => {
    const event = await storage.getEvent(parseInt(req.params.id));
    if (!event) return res.sendStatus(404);
    res.json(event);
  });

  app.patch("/api/events/:id", async (req, res) => {
    const event = await storage.updateEvent(parseInt(req.params.id), req.body);
    res.json(event);
  });

  app.delete("/api/events/:id", async (req, res) => {
    await storage.deleteEvent(parseInt(req.params.id));
    res.sendStatus(204);
  });

  app.post("/api/events/:id/set-active", async (req, res) => {
    await storage.setActiveEvent(parseInt(req.params.id));
    const event = await storage.getEvent(parseInt(req.params.id));
    res.json(event);
  });

  app.get("/api/active-event", async (_req, res) => {
    const event = await storage.getActiveEvent();
    res.json(event || null);
  });

  app.get("/api/teams", async (_req, res) => {
    const allTeams = await storage.getTeams();
    res.json(allTeams);
  });

  app.post("/api/teams", async (req, res) => {
    const parsed = insertTeamSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const existing = await storage.getTeamByNumber(parsed.data.teamNumber);
    if (existing) return res.status(400).send("Team number already exists");
    const team = await storage.createTeam(parsed.data);
    res.status(201).json(team);
  });

  app.post("/api/teams/import", async (req, res) => {
    const { teams: teamList, eventId } = req.body;
    if (!Array.isArray(teamList)) return res.status(400).send("teams must be an array");

    const results = [];
    for (const t of teamList) {
      const team = await storage.upsertTeam({
        teamNumber: t.teamNumber,
        teamName: t.teamName,
        city: t.city || null,
        stateProv: t.stateProv || null,
        country: t.country || null,
      });
      if (eventId) {
        const existing = await storage.getEventTeams(eventId);
        if (!existing.find(et => et.teamId === team.id)) {
          await storage.addTeamToEvent({ eventId, teamId: team.id });
        }
      }
      results.push(team);
    }
    res.status(201).json(results);
  });

  app.delete("/api/teams/:id", async (req, res) => {
    await storage.deleteTeam(parseInt(req.params.id));
    res.sendStatus(204);
  });

  app.get("/api/events/:eventId/teams", async (req, res) => {
    const result = await storage.getEventTeams(parseInt(req.params.eventId));
    res.json(result);
  });

  app.post("/api/events/:eventId/teams", async (req, res) => {
    const eventTeam = await storage.addTeamToEvent({
      eventId: parseInt(req.params.eventId),
      teamId: req.body.teamId,
    });
    res.status(201).json(eventTeam);
  });

  app.delete("/api/events/:eventId/teams/:teamId", async (req, res) => {
    await storage.removeTeamFromEvent(
      parseInt(req.params.eventId),
      parseInt(req.params.teamId)
    );
    res.sendStatus(204);
  });

  app.post("/api/entries", async (req, res) => {
    const parsed = insertScoutingEntrySchema.safeParse({
      ...req.body,
      scouterId: 0,
    });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const entry = await storage.createScoutingEntry(parsed.data);
    res.status(201).json(entry);
  });

  app.patch("/api/entries/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const updated = await storage.updateScoutingEntry(id, req.body);
    res.json(updated);
  });

  app.delete("/api/entries/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteScoutingEntry(id);
    res.sendStatus(204);
  });

  app.get("/api/events/:eventId/entries", async (req, res) => {
    const entries = await storage.getEntriesByEvent(parseInt(req.params.eventId));
    res.json(entries);
  });

  app.get("/api/events/:eventId/teams/:teamId/entries", async (req, res) => {
    const entries = await storage.getEntriesByEventAndTeam(
      parseInt(req.params.eventId),
      parseInt(req.params.teamId)
    );
    res.json(entries);
  });

  app.get("/api/events/:eventId/match/:matchNumber/entries", async (req, res) => {
    const entries = await storage.getEntriesByMatch(
      parseInt(req.params.eventId),
      parseInt(req.params.matchNumber)
    );
    res.json(entries);
  });

  app.get("/api/events/:eventId/schedule", async (req, res) => {
    const schedule = await storage.getScheduleByEvent(parseInt(req.params.eventId));
    res.json(schedule);
  });

  app.post("/api/events/:eventId/schedule", async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    const { matches } = req.body;
    if (!Array.isArray(matches)) return res.status(400).send("matches must be an array");

    await storage.deleteScheduleByEvent(eventId);

    const results = [];
    for (const m of matches) {
      const match = await storage.createScheduleMatch({
        eventId,
        matchNumber: m.matchNumber,
        red1: m.red1 || null,
        red2: m.red2 || null,
        red3: m.red3 || null,
        blue1: m.blue1 || null,
        blue2: m.blue2 || null,
        blue3: m.blue3 || null,
        time: m.time || null,
      });
      results.push(match);
    }
    res.status(201).json(results);
  });

  await seedDatabase();

  return httpServer;
}
