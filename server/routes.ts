import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword } from "./auth";
import { insertEventSchema, insertTeamSchema, insertScoutingEntrySchema } from "@shared/schema";
import { z } from "zod";

async function seedDatabase() {
  const existingAdmin = await storage.getUserByUsername("admin");
  if (existingAdmin) return;

  await storage.createUser({
    username: "admin",
    password: await hashPassword("admin123"),
    displayName: "Team Admin",
    role: "admin",
  });

  await storage.createUser({
    username: "scout1",
    password: await hashPassword("scout123"),
    displayName: "Alex Johnson",
    role: "scouter",
  });

  await storage.createUser({
    username: "scout2",
    password: await hashPassword("scout123"),
    displayName: "Jordan Smith",
    role: "scouter",
  });

  await storage.createTeam({ teamNumber: 254, teamName: "The Cheesy Poofs" });
  await storage.createTeam({ teamNumber: 1114, teamName: "Simbotics" });
  await storage.createTeam({ teamNumber: 2056, teamName: "OP Robotics" });
  await storage.createTeam({ teamNumber: 118, teamName: "Robonauts" });
  await storage.createTeam({ teamNumber: 1678, teamName: "Citrus Circuits" });

  const event = await storage.createEvent({
    name: "2026 Houston Regional",
    location: "Houston, TX",
    startDate: "2026-03-15",
    isActive: true,
    currentMatchNumber: 1,
  });

  const allTeams = await storage.getTeams();
  for (const team of allTeams) {
    await storage.addTeamToEvent({ eventId: event.id, teamId: team.id });
  }

  console.log("Database seeded with initial data");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  app.get("/api/events", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const allEvents = await storage.getEvents();
    res.json(allEvents);
  });

  app.post("/api/events", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") return res.sendStatus(403);
    const parsed = insertEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const event = await storage.createEvent(parsed.data);
    res.status(201).json(event);
  });

  app.get("/api/events/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const event = await storage.getEvent(parseInt(req.params.id));
    if (!event) return res.sendStatus(404);
    res.json(event);
  });

  app.patch("/api/events/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") return res.sendStatus(403);
    const event = await storage.updateEvent(parseInt(req.params.id), req.body);
    res.json(event);
  });

  app.delete("/api/events/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") return res.sendStatus(403);
    await storage.deleteEvent(parseInt(req.params.id));
    res.sendStatus(204);
  });

  app.post("/api/events/:id/set-active", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") return res.sendStatus(403);
    await storage.setActiveEvent(parseInt(req.params.id));
    const event = await storage.getEvent(parseInt(req.params.id));
    res.json(event);
  });

  app.post("/api/events/:id/advance-match", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") return res.sendStatus(403);
    const event = await storage.getEvent(parseInt(req.params.id));
    if (!event) return res.sendStatus(404);
    const updated = await storage.updateEvent(event.id, {
      currentMatchNumber: event.currentMatchNumber + 1,
    });
    res.json(updated);
  });

  app.post("/api/events/:id/reset-match", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") return res.sendStatus(403);
    const updated = await storage.updateEvent(parseInt(req.params.id), {
      currentMatchNumber: 1,
    });
    res.json(updated);
  });

  app.get("/api/active-event", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const event = await storage.getActiveEvent();
    res.json(event || null);
  });

  app.get("/api/teams", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const allTeams = await storage.getTeams();
    res.json(allTeams);
  });

  app.post("/api/teams", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") return res.sendStatus(403);
    const parsed = insertTeamSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const existing = await storage.getTeamByNumber(parsed.data.teamNumber);
    if (existing) return res.status(400).send("Team number already exists");
    const team = await storage.createTeam(parsed.data);
    res.status(201).json(team);
  });

  app.delete("/api/teams/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") return res.sendStatus(403);
    await storage.deleteTeam(parseInt(req.params.id));
    res.sendStatus(204);
  });

  app.get("/api/events/:eventId/teams", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const result = await storage.getEventTeams(parseInt(req.params.eventId));
    res.json(result);
  });

  app.post("/api/events/:eventId/teams", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") return res.sendStatus(403);
    const eventTeam = await storage.addTeamToEvent({
      eventId: parseInt(req.params.eventId),
      teamId: req.body.teamId,
    });
    res.status(201).json(eventTeam);
  });

  app.delete("/api/events/:eventId/teams/:teamId", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") return res.sendStatus(403);
    await storage.removeTeamFromEvent(
      parseInt(req.params.eventId),
      parseInt(req.params.teamId)
    );
    res.sendStatus(204);
  });

  app.get("/api/scouters", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") return res.sendStatus(403);
    const scouters = await storage.getUsersByRole("scouter");
    res.json(scouters);
  });

  app.post("/api/scouters", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") return res.sendStatus(403);
    const existing = await storage.getUserByUsername(req.body.username);
    if (existing) return res.status(400).send("Username already exists");
    const scouter = await storage.createUser({
      username: req.body.username,
      password: await hashPassword(req.body.password),
      displayName: req.body.displayName,
      role: "scouter",
    });
    res.status(201).json(scouter);
  });

  app.delete("/api/scouters/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") return res.sendStatus(403);
    await storage.deleteUser(parseInt(req.params.id));
    res.sendStatus(204);
  });

  app.get("/api/scouters/:id/entries", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const entries = await storage.getEntriesByScouter(parseInt(req.params.id));
    res.json(entries);
  });

  app.post("/api/entries", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const parsed = insertScoutingEntrySchema.safeParse({
      ...req.body,
      scouterId: req.user!.id,
    });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const entry = await storage.createScoutingEntry(parsed.data);
    res.status(201).json(entry);
  });

  app.get("/api/events/:eventId/entries", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const entries = await storage.getEntriesByEvent(parseInt(req.params.eventId));
    res.json(entries);
  });

  app.get("/api/events/:eventId/teams/:teamId/entries", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const entries = await storage.getEntriesByEventAndTeam(
      parseInt(req.params.eventId),
      parseInt(req.params.teamId)
    );
    res.json(entries);
  });

  app.get("/api/events/:eventId/match/:matchNumber/entries", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const entries = await storage.getEntriesByMatch(
      parseInt(req.params.eventId),
      parseInt(req.params.matchNumber)
    );
    res.json(entries);
  });

  await seedDatabase();

  return httpServer;
}
