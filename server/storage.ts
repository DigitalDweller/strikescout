import {
  events, teams, eventTeams, scoutingEntries, scheduleMatches,
  type Event, type InsertEvent,
  type Team, type InsertTeam, type EventTeam, type InsertEventTeam,
  type ScoutingEntry, type InsertScoutingEntry,
  type ScheduleMatch, type InsertScheduleMatch,
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getEvents(): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, data: Partial<Event>): Promise<Event>;
  deleteEvent(id: number): Promise<void>;
  getActiveEvent(): Promise<Event | undefined>;
  setActiveEvent(id: number): Promise<void>;

  getTeams(): Promise<Team[]>;
  getTeam(id: number): Promise<Team | undefined>;
  getTeamByNumber(teamNumber: number): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  upsertTeam(team: InsertTeam): Promise<Team>;
  deleteTeam(id: number): Promise<void>;

  getEventTeams(eventId: number): Promise<(EventTeam & { team: Team })[]>;
  addTeamToEvent(data: InsertEventTeam): Promise<EventTeam>;
  removeTeamFromEvent(eventId: number, teamId: number): Promise<void>;

  createScoutingEntry(entry: InsertScoutingEntry): Promise<ScoutingEntry>;
  updateScoutingEntry(id: number, data: Partial<ScoutingEntry>): Promise<ScoutingEntry>;
  deleteScoutingEntry(id: number): Promise<void>;
  getEntriesByEvent(eventId: number): Promise<ScoutingEntry[]>;
  getEntriesByEventAndTeam(eventId: number, teamId: number): Promise<ScoutingEntry[]>;
  getEntriesByMatch(eventId: number, matchNumber: number): Promise<ScoutingEntry[]>;

  getScheduleByEvent(eventId: number): Promise<ScheduleMatch[]>;
  createScheduleMatch(match: InsertScheduleMatch): Promise<ScheduleMatch>;
  deleteScheduleByEvent(eventId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getEvents(): Promise<Event[]> {
    return db.select().from(events);
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event || undefined;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [created] = await db.insert(events).values(event).returning();
    return created;
  }

  async updateEvent(id: number, data: Partial<Event>): Promise<Event> {
    const [updated] = await db.update(events).set(data).where(eq(events.id, id)).returning();
    return updated;
  }

  async deleteEvent(id: number): Promise<void> {
    await db.delete(scheduleMatches).where(eq(scheduleMatches.eventId, id));
    await db.delete(scoutingEntries).where(eq(scoutingEntries.eventId, id));
    await db.delete(eventTeams).where(eq(eventTeams.eventId, id));
    await db.delete(events).where(eq(events.id, id));
  }

  async getActiveEvent(): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.isActive, true));
    return event || undefined;
  }

  async setActiveEvent(id: number): Promise<void> {
    await db.update(events).set({ isActive: false });
    await db.update(events).set({ isActive: true }).where(eq(events.id, id));
  }

  async getTeams(): Promise<Team[]> {
    return db.select().from(teams);
  }

  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team || undefined;
  }

  async getTeamByNumber(teamNumber: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.teamNumber, teamNumber));
    return team || undefined;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [created] = await db.insert(teams).values(team).returning();
    return created;
  }

  async upsertTeam(team: InsertTeam): Promise<Team> {
    const existing = await this.getTeamByNumber(team.teamNumber);
    if (existing) {
      const [updated] = await db.update(teams).set(team).where(eq(teams.id, existing.id)).returning();
      return updated;
    }
    return this.createTeam(team);
  }

  async deleteTeam(id: number): Promise<void> {
    await db.delete(eventTeams).where(eq(eventTeams.teamId, id));
    await db.delete(scoutingEntries).where(eq(scoutingEntries.teamId, id));
    await db.delete(teams).where(eq(teams.id, id));
  }

  async getEventTeams(eventId: number): Promise<(EventTeam & { team: Team })[]> {
    const results = await db
      .select()
      .from(eventTeams)
      .innerJoin(teams, eq(eventTeams.teamId, teams.id))
      .where(eq(eventTeams.eventId, eventId));

    return results.map(r => ({
      ...r.event_teams,
      team: r.teams,
    }));
  }

  async addTeamToEvent(data: InsertEventTeam): Promise<EventTeam> {
    const [created] = await db.insert(eventTeams).values(data).returning();
    return created;
  }

  async removeTeamFromEvent(eventId: number, teamId: number): Promise<void> {
    await db.delete(eventTeams).where(
      and(eq(eventTeams.eventId, eventId), eq(eventTeams.teamId, teamId))
    );
  }

  async createScoutingEntry(entry: InsertScoutingEntry): Promise<ScoutingEntry> {
    const [created] = await db.insert(scoutingEntries).values(entry).returning();
    return created;
  }

  async updateScoutingEntry(id: number, data: Partial<ScoutingEntry>): Promise<ScoutingEntry> {
    const [updated] = await db.update(scoutingEntries).set(data).where(eq(scoutingEntries.id, id)).returning();
    return updated;
  }

  async deleteScoutingEntry(id: number): Promise<void> {
    await db.delete(scoutingEntries).where(eq(scoutingEntries.id, id));
  }

  async getEntriesByEvent(eventId: number): Promise<ScoutingEntry[]> {
    return db.select().from(scoutingEntries).where(eq(scoutingEntries.eventId, eventId));
  }

  async getEntriesByEventAndTeam(eventId: number, teamId: number): Promise<ScoutingEntry[]> {
    return db.select().from(scoutingEntries).where(
      and(eq(scoutingEntries.eventId, eventId), eq(scoutingEntries.teamId, teamId))
    );
  }

  async getEntriesByMatch(eventId: number, matchNumber: number): Promise<ScoutingEntry[]> {
    return db.select().from(scoutingEntries).where(
      and(eq(scoutingEntries.eventId, eventId), eq(scoutingEntries.matchNumber, matchNumber))
    );
  }

  async getScheduleByEvent(eventId: number): Promise<ScheduleMatch[]> {
    return db.select().from(scheduleMatches).where(eq(scheduleMatches.eventId, eventId));
  }

  async createScheduleMatch(match: InsertScheduleMatch): Promise<ScheduleMatch> {
    const [created] = await db.insert(scheduleMatches).values(match).returning();
    return created;
  }

  async deleteScheduleByEvent(eventId: number): Promise<void> {
    await db.delete(scheduleMatches).where(eq(scheduleMatches.eventId, eventId));
  }
}

export const storage = new DatabaseStorage();
