import {
  users,
  pendingSignups,
  events, teams, eventTeams, scoutingEntries, scheduleMatches, picklists, picklistEntries, repAwards,
  type User, type InsertUser,
  type Event, type InsertEvent,
  type Team, type InsertTeam, type EventTeam, type InsertEventTeam,
  type ScoutingEntry, type InsertScoutingEntry,
  type ScheduleMatch, type InsertScheduleMatch,
  type Picklist, type InsertPicklist,
  type PicklistEntry,
  type InsertRepAward,
  type InsertPendingSignup,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, asc, desc, inArray, sql } from "drizzle-orm";

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
  getScoutersForEvent(eventId: number): Promise<{ id: number; displayName: string; entryCount: number; rep: number; eventsScouted: number }[]>;
  createRepAward(award: InsertRepAward): Promise<void>;
  getRepAwardsSumForScouters(scouterIds: number[]): Promise<Map<number, number>>;
  getRepHistoryForScouter(scouterId: number): Promise<{ type: "event" | "entry" | "award"; amount: number; label: string; createdAt: string; awardedBy?: string }[]>;

  getScheduleByEvent(eventId: number): Promise<ScheduleMatch[]>;
  createScheduleMatch(match: InsertScheduleMatch): Promise<ScheduleMatch>;
  deleteScheduleByEvent(eventId: number): Promise<void>;
  updateScheduleMatchVideo(eventId: number, matchNumber: number, videoUrl: string): Promise<void>;

  updateEventTeamOPR(eventId: number, teamId: number, opr: number): Promise<void>;
  updateEventTeamRanking(eventId: number, teamId: number, rankingPoints: number, rank: number, wins: number, losses: number, ties: number): Promise<void>;
  updateMatchResults(eventId: number, matchNumber: number, redScore: number | null, blueScore: number | null, winningAlliance: string | null): Promise<void>;

  getPicklists(eventId: number): Promise<(Picklist & { createdBy?: { id: number; displayName: string; role: string } })[]>;
  getPicklistEntryCounts(eventId: number): Promise<Map<number, number>>;
  createPicklist(eventId: number, name: string, adminOnly?: boolean, createdById?: number): Promise<Picklist>;
  updatePicklist(id: number, data: { name?: string; adminOnly?: boolean }): Promise<Picklist | undefined>;
  deletePicklist(id: number): Promise<void>;
  getPicklistEntries(picklistId: number): Promise<(PicklistEntry & { team: Team })[]>;
  setPicklistEntries(picklistId: number, teamIds: number[]): Promise<void>;
  removeFromPicklistEntries(picklistId: number, teamId: number): Promise<void>;

  createPendingSignup(data: InsertPendingSignup): Promise<void>;
  getPendingSignupByToken(token: string): Promise<{ id: number; email: string; username: string; password: string } | undefined>;
  getPendingSignupByEmail(email: string): Promise<{ id: number } | undefined>;
  getPendingSignupByEmailFull(email: string): Promise<{ email: string; username: string; password: string } | undefined>;
  getPendingSignupByUsername(username: string): Promise<{ id: number } | undefined>;
  deletePendingSignup(id: number): Promise<void>;
  upsertPendingSignup(data: InsertPendingSignup): Promise<void>;
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

  async createPendingSignup(data: InsertPendingSignup): Promise<void> {
    await db.insert(pendingSignups).values(data);
  }

  async getPendingSignupByToken(token: string): Promise<{ id: number; email: string; username: string; password: string } | undefined> {
    const [row] = await db.select().from(pendingSignups).where(eq(pendingSignups.confirmationToken, token));
    if (!row || new Date(row.expiresAt) < new Date()) return undefined;
    return { id: row.id, email: row.email, username: row.username, password: row.password };
  }

  async getPendingSignupByEmail(email: string): Promise<{ id: number } | undefined> {
    const [row] = await db.select({ id: pendingSignups.id }).from(pendingSignups).where(eq(pendingSignups.email, email.toLowerCase()));
    return row ? { id: row.id } : undefined;
  }

  async getPendingSignupByEmailFull(email: string): Promise<{ email: string; username: string; password: string } | undefined> {
    const [row] = await db.select().from(pendingSignups).where(eq(pendingSignups.email, email.toLowerCase()));
    return row ? { email: row.email, username: row.username, password: row.password } : undefined;
  }

  async getPendingSignupByUsername(username: string): Promise<{ id: number } | undefined> {
    const [row] = await db.select({ id: pendingSignups.id }).from(pendingSignups).where(eq(pendingSignups.username, username));
    return row ? { id: row.id } : undefined;
  }

  async deletePendingSignup(id: number): Promise<void> {
    await db.delete(pendingSignups).where(eq(pendingSignups.id, id));
  }

  async upsertPendingSignup(data: InsertPendingSignup): Promise<void> {
    const existing = await this.getPendingSignupByEmail(data.email);
    if (existing) {
      await db.update(pendingSignups).set({
        username: data.username,
        password: data.password,
        confirmationToken: data.confirmationToken,
        expiresAt: data.expiresAt,
      }).where(eq(pendingSignups.id, existing.id));
    } else {
      await this.createPendingSignup(data);
    }
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

  async getScouterStats(userId: number): Promise<{ eventId: number; eventName: string; entryCount: number; firstEntryAt?: Date }[]> {
    const rows = await db
      .select({
        eventId: scoutingEntries.eventId,
        eventName: events.name,
        entryCount: sql<number>`count(*)::int`,
        firstEntryAt: sql<Date>`min(${scoutingEntries.createdAt})`,
      })
      .from(scoutingEntries)
      .innerJoin(events, eq(scoutingEntries.eventId, events.id))
      .where(eq(scoutingEntries.scouterId, userId))
      .groupBy(scoutingEntries.eventId, events.name);
    return rows;
  }

  async getScoutersForEvent(eventId: number): Promise<{ id: number; displayName: string; entryCount: number; rep: number; eventsScouted: number }[]> {
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

    const allScouterIds = scouters.map(s => s.id);
    const repDataMap = allScouterIds.length > 0
      ? await this.getRepForScouters(allScouterIds)
      : new Map<number, { rep: number; eventsScouted: number }>();

    return scouters.map(s => {
      const data = repDataMap.get(s.id) ?? { rep: 0, eventsScouted: 0 };
      return {
        id: s.id,
        displayName: s.displayName,
        entryCount: countMap.get(s.id) ?? 0,
        rep: data.rep,
        eventsScouted: data.eventsScouted,
      };
    });
  }

  async getRepForScouters(scouterIds: number[]): Promise<Map<number, { rep: number; eventsScouted: number }>> {
    if (scouterIds.length === 0) return new Map();

    const eventStats = await db
      .select({
        scouterId: scoutingEntries.scouterId,
        eventCount: sql<number>`count(distinct ${scoutingEntries.eventId})::int`,
        totalEntries: sql<number>`count(*)::int`,
      })
      .from(scoutingEntries)
      .where(inArray(scoutingEntries.scouterId, scouterIds))
      .groupBy(scoutingEntries.scouterId);

    const awardsRows = await db
      .select({
        scouterId: repAwards.scouterId,
        sumAmount: sql<number>`coalesce(sum(${repAwards.amount}), 0)::int`,
      })
      .from(repAwards)
      .where(inArray(repAwards.scouterId, scouterIds))
      .groupBy(repAwards.scouterId);

    const eventStatsMap = new Map(eventStats.map(r => [r.scouterId, { eventCount: r.eventCount, totalEntries: r.totalEntries }]));
    const awardsMap = new Map(awardsRows.map(r => [r.scouterId, r.sumAmount]));

    const result = new Map<number, { rep: number; eventsScouted: number }>();
    for (const id of scouterIds) {
      const stats = eventStatsMap.get(id);
      const eventsScouted = stats?.eventCount ?? 0;
      const totalEntries = stats?.totalEntries ?? 0;
      const awardsSum = awardsMap.get(id) ?? 0;
      const rep = eventsScouted * 10 + totalEntries + awardsSum;
      result.set(id, { rep, eventsScouted });
    }
    return result;
  }

  async createRepAward(award: InsertRepAward): Promise<void> {
    await db.insert(repAwards).values(award);
  }

  async getRepAwardsSumForScouters(scouterIds: number[]): Promise<Map<number, number>> {
    if (scouterIds.length === 0) return new Map();
    const rows = await db
      .select({
        scouterId: repAwards.scouterId,
        sumAmount: sql<number>`coalesce(sum(${repAwards.amount}), 0)::int`,
      })
      .from(repAwards)
      .where(inArray(repAwards.scouterId, scouterIds))
      .groupBy(repAwards.scouterId);
    return new Map(rows.map(r => [r.scouterId, r.sumAmount]));
  }

  async getRepHistoryForScouter(scouterId: number): Promise<{ type: "event" | "entry" | "award"; amount: number; label: string; createdAt: string; awardedBy?: string }[]> {
    const stats = await this.getScouterStats(scouterId);
    const awards = await db
      .select({
        amount: repAwards.amount,
        reason: repAwards.reason,
        createdAt: repAwards.createdAt,
        awardedByDisplayName: users.displayName,
      })
      .from(repAwards)
      .innerJoin(users, eq(repAwards.awardedById, users.id))
      .where(eq(repAwards.scouterId, scouterId))
      .orderBy(desc(repAwards.createdAt));

    const history: { type: "event" | "entry" | "award"; amount: number; label: string; createdAt: string; awardedBy?: string }[] = [];

    for (const s of stats) {
      const eventRep = 10;
      const entryRep = s.entryCount;
      const totalRep = eventRep + entryRep;
      const createdAt = (s as { firstEntryAt?: Date }).firstEntryAt
        ? new Date((s as { firstEntryAt?: Date }).firstEntryAt!).toISOString()
        : "";
      history.push({
        type: "event",
        amount: totalRep,
        label: `Scouted ${s.eventName}: +10 event +${s.entryCount} entries`,
        createdAt,
      });
    }

    for (const a of awards) {
      history.push({
        type: "award",
        amount: a.amount,
        label: a.reason ? `Admin award: ${a.reason}` : `Admin award`,
        createdAt: a.createdAt.toISOString(),
        awardedBy: a.awardedByDisplayName,
      });
    }

    history.sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return history;
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

  async getPicklistEntryCounts(eventId: number): Promise<Map<number, number>> {
    const picklistIds = (await db.select({ id: picklists.id }).from(picklists).where(eq(picklists.eventId, eventId))).map((p) => p.id);
    if (picklistIds.length === 0) return new Map();
    const rows = await db
      .select({
        picklistId: picklistEntries.picklistId,
        entryCount: sql<number>`count(*)::int`,
      })
      .from(picklistEntries)
      .where(inArray(picklistEntries.picklistId, picklistIds))
      .groupBy(picklistEntries.picklistId);
    return new Map(rows.map((r) => [r.picklistId, r.entryCount]));
  }

  async getPicklists(eventId: number): Promise<(Picklist & { createdBy?: { id: number; displayName: string; role: string } })[]> {
    const rows = await db
      .select({
        id: picklists.id,
        eventId: picklists.eventId,
        name: picklists.name,
        adminOnly: picklists.adminOnly,
        createdById: picklists.createdById,
        createdAt: picklists.createdAt,
        createdByDisplayName: users.displayName,
        createdByUserId: users.id,
        createdByRole: users.role,
      })
      .from(picklists)
      .leftJoin(users, eq(picklists.createdById, users.id))
      .where(eq(picklists.eventId, eventId))
      .orderBy(desc(picklists.adminOnly), asc(picklists.createdAt));

    return rows.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      name: r.name,
      adminOnly: r.adminOnly,
      createdById: r.createdById,
      createdAt: r.createdAt,
      ...(r.createdByDisplayName != null && r.createdByUserId != null
        ? { createdBy: { id: r.createdByUserId, displayName: r.createdByDisplayName, role: r.createdByRole ?? "scouter" } }
        : {}),
    }));
  }

  async createPicklist(eventId: number, name: string, adminOnly = false, createdById?: number): Promise<Picklist> {
    const [created] = await db.insert(picklists).values({ eventId, name, adminOnly, createdById: createdById ?? null }).returning();
    return created;
  }

  async updatePicklist(id: number, data: { name?: string; adminOnly?: boolean }): Promise<Picklist | undefined> {
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.adminOnly !== undefined) updates.adminOnly = data.adminOnly;
    if (Object.keys(updates).length === 0) return (await db.select().from(picklists).where(eq(picklists.id, id)))[0] ?? undefined;
    const [updated] = await db.update(picklists).set(updates).where(eq(picklists.id, id)).returning();
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
