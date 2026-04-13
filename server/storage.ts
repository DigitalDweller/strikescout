import {
  users,
  pendingSignups,
  seasons,
  appSettings,
  events, teams, eventTeams, scoutingEntries, pitScoutingEntries, scheduleMatches, scoutAssignments, scoutAssignmentRequests, scouterBreakCredits, eventScouterPresence, picklists, picklistEntries, allianceSimSessions, repAwards,
  type User, type InsertUser,
  type Season,
  type Event, type InsertEvent,
  type Team, type InsertTeam, type EventTeam, type InsertEventTeam,
  type ScoutingEntry, type InsertScoutingEntry,
  type PitScoutingEntry, type InsertPitScoutingEntry,
  type ScheduleMatch, type InsertScheduleMatch,
  type ScoutAssignment, type InsertScoutAssignment,
  type ScoutAssignmentRequest, type InsertScoutAssignmentRequest,
  type Picklist, type InsertPicklist,
  type PicklistEntry,
  type AllianceSimSession,
  type InsertRepAward,
  type InsertPendingSignup,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, asc, desc, inArray, sql } from "drizzle-orm";
import type { AllianceSimPick, AllianceSimPartnerSlotCount } from "@shared/alliance-sim";
import {
  normalizePicks,
  normalizeCaptainRobots,
  partnerSlotCountFromEvent,
  sortPicksCanonical,
  validateAllianceSimPicks,
} from "@shared/alliance-sim";

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

  /** Season rows are developer-maintained; admins only select among existing years. */
  getSeasons(): Promise<Season[]>;
  getSelectedSeasonYear(): Promise<number>;
  setSelectedSeasonYear(year: number): Promise<void>;
  /** Idempotent: seed default seasons + app_settings row on deploy. */
  ensureSeasonsAndAppSettings(): Promise<void>;

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
  getEntriesWithScouters(eventId: number, scouterId?: number): Promise<(ScoutingEntry & { scouter: { id: number; displayName: string; username: string } })[]>;
  getEntriesByEventAndTeam(eventId: number, teamId: number): Promise<ScoutingEntry[]>;
  getEntriesByEventAndScouter(eventId: number, scouterId: number): Promise<ScoutingEntry[]>;
  getEntriesByMatch(eventId: number, matchNumber: number): Promise<ScoutingEntry[]>;
  upsertPitScoutingEntry(entry: InsertPitScoutingEntry): Promise<PitScoutingEntry>;
  getPitScoutingByEventAndTeam(eventId: number, teamId: number): Promise<PitScoutingEntry | undefined>;
  getPitScoutingEntriesWithScouters(eventId: number): Promise<
    (PitScoutingEntry & {
      scouter: { id: number; displayName: string; username: string };
      team: { id: number; teamNumber: number; teamName: string };
    })[]
  >;
  getScouterStats(userId: number): Promise<{ eventId: number; eventName: string; entryCount: number }[]>;
  getScoutersForEvent(eventId: number): Promise<{ id: number; displayName: string; entryCount: number; rep: number; eventsScouted: number; isPresent: boolean }[]>;
  setEventScouterPresence(eventId: number, updates: { scouterId: number; isPresent: boolean }[]): Promise<void>;
  recallScoutBreakRequest(eventId: number, requestId: number, adminId: number): Promise<void>;
  createRepAward(award: InsertRepAward): Promise<void>;
  getRepAwardsSumForScouters(scouterIds: number[]): Promise<Map<number, number>>;
  getRepHistoryForScouter(scouterId: number): Promise<{ type: "event" | "entry" | "award"; amount: number; label: string; createdAt: string; awardedBy?: string }[]>;

  getScheduleByEvent(eventId: number): Promise<ScheduleMatch[]>;
  createScheduleMatch(match: InsertScheduleMatch): Promise<ScheduleMatch>;
  deleteScheduleByEvent(eventId: number): Promise<void>;
  updateScheduleMatchVideo(eventId: number, matchNumber: number, videoUrl: string): Promise<void>;

  getScoutAssignments(eventId: number, scouterId?: number): Promise<(ScoutAssignment & { scouter?: User })[]>;
  setScoutAssignment(eventId: number, matchNumber: number, slot: string, scouterId: number | null): Promise<ScoutAssignment>;
  setScoutAssignmentsBulk(eventId: number, assignments: { matchNumber: number; slot: string; scouterId: number | null }[]): Promise<void>;

  createScoutAssignmentRequest(data: InsertScoutAssignmentRequest): Promise<ScoutAssignmentRequest>;
  getScoutAssignmentRequests(eventId: number, scouterId?: number): Promise<(ScoutAssignmentRequest & { requester?: User; targetScouter?: User })[]>;
  updateScoutAssignmentRequest(id: number, data: { status: string; reviewedById?: number }): Promise<ScoutAssignmentRequest | undefined>;
  getScouterBreakCredits(eventId: number, scouterId: number): Promise<number>;
  getEventScouterBreakCredits(eventId: number): Promise<{ scouterId: number; displayName: string; breaksUsed: number }[]>;
  incrementScouterBreakUsed(eventId: number, scouterId: number): Promise<void>;
  addScouterBreakCredits(eventId: number, scouterId: number, amount: number): Promise<void>;

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

  /** Event roster, else picklist teams, else global team catalog — used to validate alliance sim picks. */
  getAllianceSimAllowedTeamIds(eventId: number): Promise<Set<number>>;
  getAllianceSimSessions(eventId: number): Promise<AllianceSimSession[]>;
  getAllianceSimSession(id: number): Promise<AllianceSimSession | undefined>;
  createAllianceSimSession(eventId: number, data: { name: string; createdById?: number }): Promise<AllianceSimSession>;
  updateAllianceSimSession(
    id: number,
    data: { name?: string; picks?: AllianceSimPick[]; captainRobots?: string[] },
  ): Promise<AllianceSimSession | undefined>;
  deleteAllianceSimSession(id: number): Promise<void>;
  resetAllianceSimPicks(sessionId: number): Promise<AllianceSimSession | undefined>;
  /** Rewrite each session’s picks JSON to canonical form for the given partner slot count (drops invalid partner indices). */
  normalizeAllianceSimPicksForEvent(eventId: number, partnerSlots: AllianceSimPartnerSlotCount): Promise<void>;

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

  async ensureSeasonsAndAppSettings(): Promise<void> {
    for (const year of [2025, 2026]) {
      const existing = await db.select().from(seasons).where(eq(seasons.year, year)).limit(1);
      if (existing.length === 0) {
        await db.insert(seasons).values({ year });
      }
    }
    const settingsRows = await db.select().from(appSettings).where(eq(appSettings.id, 1));
    if (settingsRows.length === 0) {
      await db.insert(appSettings).values({ id: 1, selectedSeasonYear: 2026 });
    }
  }

  async getSeasons(): Promise<Season[]> {
    return db.select().from(seasons).orderBy(desc(seasons.year));
  }

  async getSelectedSeasonYear(): Promise<number> {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
    if (!row) return 2026;
    return row.selectedSeasonYear;
  }

  async setSelectedSeasonYear(year: number): Promise<void> {
    const exists = await db.select().from(seasons).where(eq(seasons.year, year)).limit(1);
    if (exists.length === 0) {
      throw new Error("Invalid season");
    }
    await db.update(appSettings).set({ selectedSeasonYear: year }).where(eq(appSettings.id, 1));
    await db.update(events).set({ isActive: false });
  }

  async getEvents(): Promise<Event[]> {
    const year = await this.getSelectedSeasonYear();
    return db.select().from(events).where(eq(events.seasonYear, year));
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
    await db.delete(allianceSimSessions).where(eq(allianceSimSessions.eventId, id));
    const eventPicklists = await db.select({ id: picklists.id }).from(picklists).where(eq(picklists.eventId, id));
    const picklistIds = eventPicklists.map((p) => p.id);
    if (picklistIds.length > 0) {
      await db.delete(picklistEntries).where(inArray(picklistEntries.picklistId, picklistIds));
    }
    await db.delete(picklists).where(eq(picklists.eventId, id));
    await db.delete(scoutAssignments).where(eq(scoutAssignments.eventId, id));
    await db.delete(scheduleMatches).where(eq(scheduleMatches.eventId, id));
    await db.delete(scoutingEntries).where(eq(scoutingEntries.eventId, id));
    await db.delete(pitScoutingEntries).where(eq(pitScoutingEntries.eventId, id));
    await db.delete(eventTeams).where(eq(eventTeams.eventId, id));
    await db.delete(events).where(eq(events.id, id));
  }

  async getActiveEvent(): Promise<Event | undefined> {
    const year = await this.getSelectedSeasonYear();
    const [event] = await db
      .select()
      .from(events)
      .where(and(eq(events.isActive, true), eq(events.seasonYear, year)));
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
    await db.delete(pitScoutingEntries).where(eq(pitScoutingEntries.teamId, id));
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
    await db.delete(pitScoutingEntries).where(
      and(eq(pitScoutingEntries.eventId, eventId), eq(pitScoutingEntries.teamId, teamId)),
    );
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

  async getEntriesWithScouters(eventId: number, scouterId?: number): Promise<(ScoutingEntry & { scouter: { id: number; displayName: string; username: string } })[]> {
    const conditions = scouterId != null
      ? and(eq(scoutingEntries.eventId, eventId), eq(scoutingEntries.scouterId, scouterId))
      : eq(scoutingEntries.eventId, eventId);
    const rows = await db
      .select({
        id: scoutingEntries.id,
        scouterId: scoutingEntries.scouterId,
        eventId: scoutingEntries.eventId,
        teamId: scoutingEntries.teamId,
        matchNumber: scoutingEntries.matchNumber,
        autoBallsShot: scoutingEntries.autoBallsShot,
        autoAccuracy: scoutingEntries.autoAccuracy,
        autoNotes: scoutingEntries.autoNotes,
        autoDrawing: scoutingEntries.autoDrawing,
        autoClimbSuccess: scoutingEntries.autoClimbSuccess,
        autoClimbPosition: scoutingEntries.autoClimbPosition,
        autoClimbLevel: scoutingEntries.autoClimbLevel,
        teleopBallsShot: scoutingEntries.teleopBallsShot,
        teleopShootPosition: scoutingEntries.teleopShootPosition,
        teleopMoveWhileShoot: scoutingEntries.teleopMoveWhileShoot,
        teleopFpsEstimate: scoutingEntries.teleopFpsEstimate,
        teleopAccuracy: scoutingEntries.teleopAccuracy,
        evadedDefense: scoutingEntries.evadedDefense,
        climbSuccess: scoutingEntries.climbSuccess,
        climbPosition: scoutingEntries.climbPosition,
        climbLevel: scoutingEntries.climbLevel,
        playedDefense: scoutingEntries.playedDefense,
        defenseRating: scoutingEntries.defenseRating,
        defenseNotes: scoutingEntries.defenseNotes,
        driverSkill: scoutingEntries.driverSkill,
        driverSkillNotes: scoutingEntries.driverSkillNotes,
        notes: scoutingEntries.notes,
        createdAt: scoutingEntries.createdAt,
        scouterDisplayName: users.displayName,
        scouterUsername: users.username,
      })
      .from(scoutingEntries)
      .innerJoin(users, eq(scoutingEntries.scouterId, users.id))
      .where(conditions);
    return rows.map((r) => {
      const { scouterDisplayName, scouterUsername, ...entry } = r;
      return {
        ...entry,
        scouter: {
          id: r.scouterId,
          displayName: scouterDisplayName ?? "Unknown",
          username: scouterUsername ?? "?",
        },
      };
    });
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

  async upsertPitScoutingEntry(entry: InsertPitScoutingEntry): Promise<PitScoutingEntry> {
    return db.transaction(async (tx) => {
      await tx
        .delete(pitScoutingEntries)
        .where(and(eq(pitScoutingEntries.eventId, entry.eventId), eq(pitScoutingEntries.teamId, entry.teamId)));
      const [created] = await tx
        .insert(pitScoutingEntries)
        .values({ ...entry, updatedAt: new Date() })
        .returning();
      return created;
    });
  }

  async getPitScoutingByEventAndTeam(eventId: number, teamId: number): Promise<PitScoutingEntry | undefined> {
    const [row] = await db
      .select()
      .from(pitScoutingEntries)
      .where(and(eq(pitScoutingEntries.eventId, eventId), eq(pitScoutingEntries.teamId, teamId)));
    return row;
  }

  async getPitScoutingEntriesWithScouters(eventId: number): Promise<
    (PitScoutingEntry & {
      scouter: { id: number; displayName: string; username: string };
      team: { id: number; teamNumber: number; teamName: string };
    })[]
  > {
    const rows = await db
      .select({
        id: pitScoutingEntries.id,
        scouterId: pitScoutingEntries.scouterId,
        eventId: pitScoutingEntries.eventId,
        teamId: pitScoutingEntries.teamId,
        robotHeroImage: pitScoutingEntries.robotHeroImage,
        robotExtraImage1: pitScoutingEntries.robotExtraImage1,
        robotExtraImage2: pitScoutingEntries.robotExtraImage2,
        robotExtraImage3: pitScoutingEntries.robotExtraImage3,
        robotExtraImage4: pitScoutingEntries.robotExtraImage4,
        drivetrainType: pitScoutingEntries.drivetrainType,
        hasAuto: pitScoutingEntries.hasAuto,
        fitsUnderTrench: pitScoutingEntries.fitsUnderTrench,
        autoDescription: pitScoutingEntries.autoDescription,
        pitClimbNotes: pitScoutingEntries.pitClimbNotes,
        hopperCapacity: pitScoutingEntries.hopperCapacity,
        hopperCapacityOver100: pitScoutingEntries.hopperCapacityOver100,
        createdAt: pitScoutingEntries.createdAt,
        updatedAt: pitScoutingEntries.updatedAt,
        scouterDisplayName: users.displayName,
        scouterUsername: users.username,
        teamNumber: teams.teamNumber,
        teamName: teams.teamName,
      })
      .from(pitScoutingEntries)
      .innerJoin(users, eq(pitScoutingEntries.scouterId, users.id))
      .innerJoin(teams, eq(pitScoutingEntries.teamId, teams.id))
      .where(eq(pitScoutingEntries.eventId, eventId));

    return rows.map((r) => {
      const {
        scouterDisplayName,
        scouterUsername,
        teamNumber,
        teamName,
        ...rest
      } = r;
      return {
        ...rest,
        scouter: {
          id: r.scouterId,
          displayName: scouterDisplayName ?? "Unknown",
          username: scouterUsername ?? "?",
        },
        team: { id: r.teamId, teamNumber, teamName: teamName ?? "" },
      };
    });
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

  async getScoutersForEvent(eventId: number): Promise<{ id: number; displayName: string; entryCount: number; rep: number; eventsScouted: number; isPresent: boolean }[]> {
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

    const presenceRows = await db
      .select({ scouterId: eventScouterPresence.scouterId, isPresent: eventScouterPresence.isPresent })
      .from(eventScouterPresence)
      .where(eq(eventScouterPresence.eventId, eventId));
    const presenceMap = new Map(presenceRows.map((r) => [r.scouterId, r.isPresent]));

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
        isPresent: presenceMap.has(s.id) ? presenceMap.get(s.id)! : true,
      };
    });
  }

  async setEventScouterPresence(eventId: number, updates: { scouterId: number; isPresent: boolean }[]): Promise<void> {
    for (const u of updates) {
      const [existing] = await db
        .select()
        .from(eventScouterPresence)
        .where(and(eq(eventScouterPresence.eventId, eventId), eq(eventScouterPresence.scouterId, u.scouterId)));
      if (existing) {
        await db
          .update(eventScouterPresence)
          .set({ isPresent: u.isPresent })
          .where(eq(eventScouterPresence.id, existing.id));
      } else {
        await db.insert(eventScouterPresence).values({ eventId, scouterId: u.scouterId, isPresent: u.isPresent });
      }
    }
  }

  async recallScoutBreakRequest(eventId: number, requestId: number, adminId: number): Promise<void> {
    const [req_] = await db
      .select()
      .from(scoutAssignmentRequests)
      .where(and(eq(scoutAssignmentRequests.id, requestId), eq(scoutAssignmentRequests.eventId, eventId)));
    if (!req_ || req_.type !== "break" || req_.status !== "approved") {
      throw new Error("Break request not found or not active");
    }
    await db
      .update(scoutAssignmentRequests)
      .set({ status: "recalled", reviewedAt: new Date(), reviewedById: adminId })
      .where(eq(scoutAssignmentRequests.id, requestId));
    await this.addScouterBreakCredits(eventId, req_.requesterId, 1);
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

  async getScoutAssignments(eventId: number, scouterId?: number): Promise<(ScoutAssignment & { scouter?: User })[]> {
    const rows = await db
      .select({
        assignment: scoutAssignments,
        scouter: users,
      })
      .from(scoutAssignments)
      .leftJoin(users, eq(scoutAssignments.scouterId, users.id))
      .where(
        scouterId != null
          ? and(eq(scoutAssignments.eventId, eventId), eq(scoutAssignments.scouterId, scouterId))
          : eq(scoutAssignments.eventId, eventId)
      );

    return rows.map((r) => ({
      ...r.assignment,
      ...(r.scouter ? { scouter: r.scouter } : {}),
    }));
  }

  async setScoutAssignment(eventId: number, matchNumber: number, slot: string, scouterId: number | null): Promise<ScoutAssignment> {
    const [upserted] = await db
      .insert(scoutAssignments)
      .values({ eventId, matchNumber, slot, scouterId })
      .onConflictDoUpdate({
        target: [scoutAssignments.eventId, scoutAssignments.matchNumber, scoutAssignments.slot],
        set: { scouterId },
      })
      .returning();
    return upserted;
  }

  async setScoutAssignmentsBulk(eventId: number, assignments: { matchNumber: number; slot: string; scouterId: number | null }[]): Promise<void> {
    for (const a of assignments) {
      await this.setScoutAssignment(eventId, a.matchNumber, a.slot, a.scouterId);
    }
  }

  async createScoutAssignmentRequest(data: InsertScoutAssignmentRequest): Promise<ScoutAssignmentRequest> {
    const [created] = await db.insert(scoutAssignmentRequests).values(data).returning();
    return created;
  }

  async getScoutAssignmentRequests(eventId: number, scouterId?: number): Promise<(ScoutAssignmentRequest & { requester?: User; targetScouter?: User })[]> {
    const requests = await db
      .select()
      .from(scoutAssignmentRequests)
      .where(
        scouterId != null && scouterId > 0
          ? and(eq(scoutAssignmentRequests.eventId, eventId), eq(scoutAssignmentRequests.requesterId, scouterId))
          : eq(scoutAssignmentRequests.eventId, eventId)
      )
      .orderBy(desc(scoutAssignmentRequests.createdAt));

    const userIds = [...new Set([...requests.map((r) => r.requesterId), ...requests.map((r) => r.targetScouterId).filter((id): id is number => id != null)])];
    const userList = userIds.length > 0 ? await db.select().from(users).where(inArray(users.id, userIds)) : [];
    const userMap = new Map(userList.map((u) => [u.id, u]));

    return requests.map((r) => ({
      ...r,
      requester: userMap.get(r.requesterId),
      targetScouter: r.targetScouterId ? userMap.get(r.targetScouterId) : undefined,
    }));
  }

  async updateScoutAssignmentRequest(id: number, data: { status: string; reviewedById?: number }): Promise<ScoutAssignmentRequest | undefined> {
    const set: Record<string, unknown> = { status: data.status, reviewedAt: new Date() };
    if (data.reviewedById != null) set.reviewedById = data.reviewedById;
    const [updated] = await db
      .update(scoutAssignmentRequests)
      .set(set)
      .where(eq(scoutAssignmentRequests.id, id))
      .returning();
    return updated ?? undefined;
  }

  async getScouterBreakCredits(eventId: number, scouterId: number): Promise<number> {
    const [row] = await db
      .select({ breaksUsed: scouterBreakCredits.breaksUsed })
      .from(scouterBreakCredits)
      .where(and(eq(scouterBreakCredits.eventId, eventId), eq(scouterBreakCredits.scouterId, scouterId)));
    return row?.breaksUsed ?? 0;
  }

  async getEventScouterBreakCredits(eventId: number): Promise<{ scouterId: number; displayName: string; breaksUsed: number }[]> {
    const rows = await db
      .select({ scouterId: scouterBreakCredits.scouterId, breaksUsed: scouterBreakCredits.breaksUsed })
      .from(scouterBreakCredits)
      .where(eq(scouterBreakCredits.eventId, eventId));
    if (rows.length === 0) return [];
    const userIds = [...new Set(rows.map((r) => r.scouterId))];
    const userList = await db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, userIds));
    const userMap = new Map(userList.map((u) => [u.id, u]));
    return rows
      .filter((r) => userMap.has(r.scouterId))
      .map((r) => ({ scouterId: r.scouterId, displayName: userMap.get(r.scouterId)!.displayName, breaksUsed: r.breaksUsed }));
  }

  async incrementScouterBreakUsed(eventId: number, scouterId: number): Promise<void> {
    const [existing] = await db
      .select()
      .from(scouterBreakCredits)
      .where(and(eq(scouterBreakCredits.eventId, eventId), eq(scouterBreakCredits.scouterId, scouterId)));
    if (existing) {
      await db
        .update(scouterBreakCredits)
        .set({ breaksUsed: existing.breaksUsed + 1 })
        .where(eq(scouterBreakCredits.id, existing.id));
    } else {
      await db.insert(scouterBreakCredits).values({ eventId, scouterId, breaksUsed: 1 });
    }
  }

  async addScouterBreakCredits(eventId: number, scouterId: number, amount: number): Promise<void> {
    const [existing] = await db
      .select()
      .from(scouterBreakCredits)
      .where(and(eq(scouterBreakCredits.eventId, eventId), eq(scouterBreakCredits.scouterId, scouterId)));
    const newUsed = Math.max(0, (existing?.breaksUsed ?? 0) - amount);
    if (existing) {
      await db
        .update(scouterBreakCredits)
        .set({ breaksUsed: newUsed })
        .where(eq(scouterBreakCredits.id, existing.id));
    } else if (newUsed === 0) {
      // No-op, already at 0
    } else {
      await db.insert(scouterBreakCredits).values({ eventId, scouterId, breaksUsed: newUsed });
    }
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

  async getAllianceSimAllowedTeamIds(eventId: number): Promise<Set<number>> {
    const dbg = process.env.ALLIANCE_SIM_DEBUG === "1" || process.env.NODE_ENV !== "production";
    const ids = new Set<number>();
    const eventRows = await this.getEventTeams(eventId);
    for (const et of eventRows) ids.add(et.teamId);
    if (dbg) {
      console.log("[AllianceSim:storage] getAllianceSimAllowedTeamIds stage event_teams", {
        eventId,
        eventTeamCount: eventRows.length,
        idCount: ids.size,
      });
    }
    if (ids.size > 0) return ids;
    const lists = await this.getPicklists(eventId);
    let picklistTeamCount = 0;
    for (const pl of lists) {
      const entries = await this.getPicklistEntries(pl.id);
      picklistTeamCount += entries.length;
      for (const e of entries) ids.add(e.teamId);
    }
    if (dbg) {
      console.log("[AllianceSim:storage] getAllianceSimAllowedTeamIds stage picklists", {
        eventId,
        picklistCount: lists.length,
        entryRows: picklistTeamCount,
        uniqueIds: ids.size,
      });
    }
    if (ids.size > 0) return ids;
    const catalog = await db.select({ id: teams.id }).from(teams);
    for (const r of catalog) ids.add(r.id);
    if (dbg) {
      console.log("[AllianceSim:storage] getAllianceSimAllowedTeamIds stage global teams catalog", {
        eventId,
        catalogCount: catalog.length,
      });
    }
    return ids;
  }

  async getAllianceSimSessions(eventId: number): Promise<AllianceSimSession[]> {
    return db
      .select()
      .from(allianceSimSessions)
      .where(eq(allianceSimSessions.eventId, eventId))
      .orderBy(desc(allianceSimSessions.updatedAt));
  }

  async getAllianceSimSession(id: number): Promise<AllianceSimSession | undefined> {
    const [row] = await db.select().from(allianceSimSessions).where(eq(allianceSimSessions.id, id));
    return row ?? undefined;
  }

  async createAllianceSimSession(eventId: number, data: { name: string; createdById?: number }): Promise<AllianceSimSession> {
    const [created] = await db
      .insert(allianceSimSessions)
      .values({
        eventId,
        name: data.name.trim() || "Alliance sim",
        ourCaptainSlot: 1,
        captainRobots: normalizeCaptainRobots([]),
        picks: [] as AllianceSimPick[],
        createdById: data.createdById ?? null,
      })
      .returning();
    return created;
  }

  async updateAllianceSimSession(
    id: number,
    data: { name?: string; picks?: AllianceSimPick[]; captainRobots?: string[] },
  ): Promise<AllianceSimSession | undefined> {
    const [session] = await db.select().from(allianceSimSessions).where(eq(allianceSimSessions.id, id));
    if (!session) return undefined;
    const event = await this.getEvent(session.eventId);
    const partnerSlots = partnerSlotCountFromEvent(event ?? {});
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name.trim() || "Alliance sim";
    if (data.captainRobots !== undefined) updates.captainRobots = normalizeCaptainRobots(data.captainRobots);
    if (data.picks !== undefined) {
      const dbg = process.env.ALLIANCE_SIM_DEBUG === "1" || process.env.NODE_ENV !== "production";
      const normalized = sortPicksCanonical(normalizePicks(data.picks, partnerSlots));
      const allowedIds = await this.getAllianceSimAllowedTeamIds(session.eventId);
      const err = validateAllianceSimPicks(normalized, allowedIds, partnerSlots);
      if (err) {
        if (dbg) {
          console.warn("[AllianceSim:storage] updateAllianceSimSession picks rejected", {
            sessionId: id,
            eventId: session.eventId,
            err,
            pickCount: normalized.length,
            picks: normalized,
            allowedIdCount: allowedIds.size,
          });
        }
        return undefined;
      }
      updates.picks = normalized;
      if (dbg) {
        console.log("[AllianceSim:storage] updateAllianceSimSession picks ok", {
          sessionId: id,
          pickCount: normalized.length,
        });
      }
    }
    if (Object.keys(updates).length === 0) {
      return session;
    }
    updates.updatedAt = new Date();
    const [updated] = await db
      .update(allianceSimSessions)
      .set(updates)
      .where(eq(allianceSimSessions.id, id))
      .returning();
    return updated ?? undefined;
  }

  async normalizeAllianceSimPicksForEvent(eventId: number, partnerSlots: AllianceSimPartnerSlotCount): Promise<void> {
    const rows = await this.getAllianceSimSessions(eventId);
    for (const s of rows) {
      const norm = sortPicksCanonical(normalizePicks(s.picks, partnerSlots));
      await db
        .update(allianceSimSessions)
        .set({ picks: norm, updatedAt: new Date() })
        .where(eq(allianceSimSessions.id, s.id));
    }
  }

  async deleteAllianceSimSession(id: number): Promise<void> {
    await db.delete(allianceSimSessions).where(eq(allianceSimSessions.id, id));
  }

  async resetAllianceSimPicks(sessionId: number): Promise<AllianceSimSession | undefined> {
    const [updated] = await db
      .update(allianceSimSessions)
      .set({ picks: [] as AllianceSimPick[], updatedAt: new Date() })
      .where(eq(allianceSimSessions.id, sessionId))
      .returning();
    return updated ?? undefined;
  }
}

export const storage = new DatabaseStorage();
