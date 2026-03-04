import {
  users,
  events, teams, eventTeams, scoutingEntries, scheduleMatches, picklists, picklistEntries,
  type User, type InsertUser,
  type Event, type InsertEvent,
  type Team, type InsertTeam, type EventTeam, type InsertEventTeam,
  type ScoutingEntry, type InsertScoutingEntry,
  type ScheduleMatch, type InsertScheduleMatch,
  type Picklist, type InsertPicklist,
  type PicklistEntry,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, asc, inArray, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;

  getEvents(): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, data: Partial<Event>): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<void>;
  getActiveEvent(): Promise<Event | undefined>;
  setActiveEvent(id: number): Promise<void>;

  getTeams(): Promise<Team[]>;
  getTeam(id: number): Promise<Team | undefined>;
  getTeamByNumber(teamNumber: number): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  upsertTeam(team: InsertTeam): Promise<Team>;
  deleteTeam(id: number): Promise<void>;
  updateTeamAvatar(teamNumber: number, avatar: string): Promise<void>;

  getEventTeams(eventId: number): Promise<(EventTeam & { team: Team })[]>;
  addTeamToEvent(data: InsertEventTeam): Promise<EventTeam>;
  removeTeamFromEvent(eventId: number, teamId: number): Promise<void>;

  createScoutingEntry(entry: InsertScoutingEntry): Promise<ScoutingEntry>;
  updateScoutingEntry(id: number, data: Partial<ScoutingEntry>): Promise<ScoutingEntry | undefined>;
  deleteScoutingEntry(id: number): Promise<void>;
  getScoutingEntry(id: number): Promise<ScoutingEntry | undefined>;
  getEntriesByEvent(eventId: number): Promise<ScoutingEntry[]>;
  getEntriesByEventAndTeam(eventId: number, teamId: number): Promise<ScoutingEntry[]>;
  getEntriesByEventAndScouter(eventId: number, scouterId: number): Promise<ScoutingEntry[]>;
  getEntriesByMatch(eventId: number, matchNumber: number): Promise<ScoutingEntry[]>;
  getScouterStats(userId: number): Promise<{ eventId: number; eventName: string; entryCount: number }[]>;
  getScoutersForEvent(eventId: number): Promise<{ id: number; displayName: string; entryCount: number }[]>;

  getScheduleByEvent(eventId: number): Promise<ScheduleMatch[]>;
  createScheduleMatch(match: InsertScheduleMatch): Promise<ScheduleMatch>;
  deleteScheduleByEvent(eventId: number): Promise<void>;
  updateScheduleMatchVideo(eventId: number, matchNumber: number, videoUrl: string): Promise<void>;

  updateEventTeamOPR(eventId: number, teamId: number, opr: number): Promise<void>;
  updateEventTeamRanking(eventId: number, teamId: number, rankingPoints: number, rank: number, wins: number, losses: number, ties: number): Promise<void>;
  updateMatchResults(eventId: number, matchNumber: number, redScore: number | null, blueScore: number | null, winningAlliance: string | null): Promise<void>;

  getPicklists(eventId: number): Promise<Picklist[]>;
  createPicklist(eventId: number, name: string): Promise<Picklist>;
  updatePicklist(id: number, data: { name: string }): Promise<Picklist | undefined>;
  deletePicklist(id: number): Promise<void>;
  getPicklistEntries(picklistId: number): Promise<(PicklistEntry & { team: Team })[]>;
  setPicklistEntries(picklistId: number, teamIds: number[]): Promise<void>;
  removeFromPicklistEntries(picklistId: number, teamId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated ?? undefined;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

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

  async updateEvent(id: number, data: Partial<Event>): Promise<Event | undefined> {
    const [updated] = await db.update(events).set(data).where(eq(events.id, id)).returning();
    return updated ?? undefined;
  }

  async deleteEvent(id: number): Promise<void> {
    const eventPicklists = await db.select({ id: picklists.id }).from(picklists).where(eq(picklists.eventId, id));
    const picklistIds = eventPicklists.map((p) => p.id);
    if (picklistIds.length > 0) {
      await db.delete(picklistEntries).where(inArray(picklistEntries.picklistId, picklistIds));
    }
    await db.delete(picklists).where(eq(picklists.eventId, id));
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

  async updateTeamAvatar(teamNumber: number, avatar: string): Promise<void> {
    await db.update(teams).set({ avatar }).where(eq(teams.teamNumber, teamNumber));
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

  async updateScoutingEntry(id: number, data: Partial<ScoutingEntry>): Promise<ScoutingEntry | undefined> {
    const [updated] = await db.update(scoutingEntries).set(data).where(eq(scoutingEntries.id, id)).returning();
    return updated ?? undefined;
  }

  async deleteScoutingEntry(id: number): Promise<void> {
    await db.delete(scoutingEntries).where(eq(scoutingEntries.id, id));
  }

  async getScoutingEntry(id: number): Promise<ScoutingEntry | undefined> {
    const [row] = await db.select().from(scoutingEntries).where(eq(scoutingEntries.id, id));
    return row;
  }

  async getEntriesByEvent(eventId: number): Promise<ScoutingEntry[]> {
    return db.select().from(scoutingEntries).where(eq(scoutingEntries.eventId, eventId));
  }

  async getEntriesByEventAndTeam(eventId: number, teamId: number): Promise<ScoutingEntry[]> {
    return db.select().from(scoutingEntries).where(
      and(eq(scoutingEntries.eventId, eventId), eq(scoutingEntries.teamId, teamId))
    );
  }

  async getEntriesByEventAndScouter(eventId: number, scouterId: number): Promise<ScoutingEntry[]> {
    return db.select().from(scoutingEntries).where(
      and(eq(scoutingEntries.eventId, eventId), eq(scoutingEntries.scouterId, scouterId))
    );
  }

  async getEntriesByMatch(eventId: number, matchNumber: number): Promise<ScoutingEntry[]> {
    return db.select().from(scoutingEntries).where(
      and(eq(scoutingEntries.eventId, eventId), eq(scoutingEntries.matchNumber, matchNumber))
    );
  }

  async getScouterStats(userId: number): Promise<{ eventId: number; eventName: string; entryCount: number }[]> {
    const rows = await db
      .select({
        eventId: scoutingEntries.eventId,
        eventName: events.name,
        entryCount: sql<number>`count(*)::int`,
      })
      .from(scoutingEntries)
      .innerJoin(events, eq(scoutingEntries.eventId, events.id))
      .where(eq(scoutingEntries.scouterId, userId))
      .groupBy(scoutingEntries.eventId, events.name);
    return rows;
  }

  async getScoutersForEvent(eventId: number): Promise<{ id: number; displayName: string; entryCount: number }[]> {
    const scouters = await db
      .select({
        id: users.id,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.role, "scouter"));

    const entryCounts = await db
      .select({
        scouterId: scoutingEntries.scouterId,
        entryCount: sql<number>`count(*)::int`,
      })
      .from(scoutingEntries)
      .where(eq(scoutingEntries.eventId, eventId))
      .groupBy(scoutingEntries.scouterId);

    const countMap = new Map(entryCounts.map(r => [r.scouterId, r.entryCount]));
    return scouters.map(s => ({
      id: s.id,
      displayName: s.displayName,
      entryCount: countMap.get(s.id) ?? 0,
    }));
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

  async updateScheduleMatchVideo(eventId: number, matchNumber: number, videoUrl: string): Promise<void> {
    await db.update(scheduleMatches)
      .set({ videoUrl })
      .where(and(eq(scheduleMatches.eventId, eventId), eq(scheduleMatches.matchNumber, matchNumber)));
  }

  async updateEventTeamOPR(eventId: number, teamId: number, opr: number): Promise<void> {
    await db.update(eventTeams)
      .set({ opr })
      .where(and(eq(eventTeams.eventId, eventId), eq(eventTeams.teamId, teamId)));
  }

  async updateEventTeamRanking(eventId: number, teamId: number, rankingPoints: number, rank: number, wins: number, losses: number, ties: number): Promise<void> {
    await db.update(eventTeams)
      .set({ rankingPoints, rank, wins, losses, ties })
      .where(and(eq(eventTeams.eventId, eventId), eq(eventTeams.teamId, teamId)));
  }

  async updateMatchResults(eventId: number, matchNumber: number, redScore: number | null, blueScore: number | null, winningAlliance: string | null): Promise<void> {
    await db.update(scheduleMatches)
      .set({ redScore, blueScore, winningAlliance })
      .where(and(eq(scheduleMatches.eventId, eventId), eq(scheduleMatches.matchNumber, matchNumber)));
  }

  async getPicklists(eventId: number): Promise<Picklist[]> {
    return db.select().from(picklists).where(eq(picklists.eventId, eventId)).orderBy(asc(picklists.createdAt));
  }

  async createPicklist(eventId: number, name: string): Promise<Picklist> {
    const [created] = await db.insert(picklists).values({ eventId, name }).returning();
    return created;
  }

  async updatePicklist(id: number, data: { name: string }): Promise<Picklist | undefined> {
    const [updated] = await db.update(picklists).set(data).where(eq(picklists.id, id)).returning();
    return updated ?? undefined;
  }

  async deletePicklist(id: number): Promise<void> {
    await db.delete(picklistEntries).where(eq(picklistEntries.picklistId, id));
    await db.delete(picklists).where(eq(picklists.id, id));
  }

  async getPicklistEntries(picklistId: number): Promise<(PicklistEntry & { team: Team })[]> {
    const results = await db
      .select()
      .from(picklistEntries)
      .innerJoin(teams, eq(picklistEntries.teamId, teams.id))
      .where(eq(picklistEntries.picklistId, picklistId))
      .orderBy(asc(picklistEntries.rank));

    return results.map((r) => ({
      ...r.picklist_entries,
      team: r.teams,
    }));
  }

  async setPicklistEntries(picklistId: number, teamIds: number[]): Promise<void> {
    await db.delete(picklistEntries).where(eq(picklistEntries.picklistId, picklistId));
    if (teamIds.length > 0) {
      const values = teamIds.map((teamId, i) => ({
        picklistId,
        teamId,
        rank: i + 1,
        tier: "pick" as const,
      }));
      await db.insert(picklistEntries).values(values);
    }
  }

  async removeFromPicklistEntries(picklistId: number, teamId: number): Promise<void> {
    await db.delete(picklistEntries).where(
      and(eq(picklistEntries.picklistId, picklistId), eq(picklistEntries.teamId, teamId))
    );
    const remaining = await this.getPicklistEntries(picklistId);
    if (remaining.length > 0) {
      await this.setPicklistEntries(picklistId, remaining.map((r) => r.teamId));
    }
  }
}

export const storage = new DatabaseStorage();
