import { pgTable, text, serial, integer, boolean, timestamp, real, unique, jsonb } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import type { AllianceSimPick } from "./alliance-sim";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("scouter"),
  /** When role is `demo`, this is the only event/comp they may access (read-only). */
  demoEventId: integer("demo_event_id").references(() => events.id),
  email: text("email"),
});

export const pendingSignups = pgTable("pending_signups", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  confirmationToken: text("confirmation_token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** FRC game years; rows are inserted by developers (DB/migration), not in-app. */
export const seasons = pgTable("seasons", {
  year: integer("year").primaryKey(),
});

/** Singleton row id=1: which season the whole org is working in. */
export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey(),
  selectedSeasonYear: integer("selected_season_year")
    .notNull()
    .references(() => seasons.year),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location"),
  startDate: text("start_date"),
  /** Competition season this event belongs to (must match app selected season to appear on dashboard). */
  seasonYear: integer("season_year").notNull().default(2026),
  isActive: boolean("is_active").notNull().default(false),
  currentMatchNumber: integer("current_match_number").notNull().default(1),
  tbaEventKey: text("tba_event_key"),
  tbaEventKeyValidated: boolean("tba_event_key_validated").notNull().default(false),
  tbaAutoSync: boolean("tba_auto_sync").notNull().default(false),
  szrWeights: text("szr_weights"),
  predictorWeights: text("predictor_weights"),
  testingOverrideEventEnded: boolean("testing_override_event_ended").notNull().default(false),
  testingOverrideMatchNumber: integer("testing_override_match_number"),
  /** When true, alliance sim uses three partner slots per captain (P1–P3), e.g. Championship “fourth robot” style. */
  allianceSimFourPartnerSlots: boolean("alliance_sim_four_partner_slots").notNull().default(false),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  teamNumber: integer("team_number").notNull().unique(),
  teamName: text("team_name").notNull(),
  city: text("city"),
  stateProv: text("state_prov"),
  country: text("country"),
  avatar: text("avatar"),
});

export const eventTeams = pgTable("event_teams", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  teamId: integer("team_id").notNull(),
  opr: real("opr"),
  rankingPoints: real("ranking_points"),
  rank: integer("rank"),
  wins: integer("wins"),
  losses: integer("losses"),
  ties: integer("ties"),
});

export const picklists = pgTable("picklists", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  name: text("name").notNull(),
  adminOnly: boolean("admin_only").notNull().default(false),
  /** Optional UI metadata for list identification. */
  icon: text("icon"), // 'sword' | 'shield' | 'bolt'
  color: text("color"), // 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet'
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const picklistEntries = pgTable("picklist_entries", {
  id: serial("id").primaryKey(),
  picklistId: integer("picklist_id").notNull(),
  teamId: integer("team_id").notNull(),
  rank: integer("rank").notNull(),
  tier: text("tier").notNull().default("pick"),
});

/** Saved manual alliance-selection simulations (serpentine draft). */
export const allianceSimSessions = pgTable("alliance_sim_sessions", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Alliance sim"),
  /** Legacy column; no longer used in UI (always 1 for new rows). */
  ourCaptainSlot: integer("our_captain_slot").notNull().default(1),
  /** Per-alliance captain robot / team number notes (length 8; index 0 = captain #1). */
  captainRobots: jsonb("captain_robots").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  picks: jsonb("picks").$type<AllianceSimPick[]>().notNull(),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** One pit scouting sheet per team per event (latest submit replaces prior). */
export const pitScoutingEntries = pgTable("pit_scouting_entries", {
  id: serial("id").primaryKey(),
  scouterId: integer("scouter_id").notNull(),
  eventId: integer("event_id").notNull(),
  teamId: integer("team_id").notNull(),
  /** Data URL or HTTPS URL — primary robot photo for dashboards / team views. */
  robotHeroImage: text("robot_hero_image"),
  robotExtraImage1: text("robot_extra_image_1"),
  robotExtraImage2: text("robot_extra_image_2"),
  robotExtraImage3: text("robot_extra_image_3"),
  robotExtraImage4: text("robot_extra_image_4"),
  drivetrainType: text("drivetrain_type").notNull().default("other"),
  hasAuto: boolean("has_auto").notNull().default(false),
  fitsUnderTrench: boolean("fits_under_trench").notNull().default(false),
  autoDescription: text("auto_description"),
  pitClimbNotes: text("pit_climb_notes"),
  /** 0–100 when hopperCapacityOver100 is false; ignored for display when over-100 is set. */
  hopperCapacity: integer("hopper_capacity").notNull().default(0),
  hopperCapacityOver100: boolean("hopper_capacity_over_100").notNull().default(false),
  /** Optional in case team refuses to share. */
  robotWeightLbs: integer("robot_weight_lbs"),
  usesPathplanner: boolean("uses_pathplanner").notNull().default(false),
  hasMidfieldFuelAuto: boolean("has_midfield_fuel_auto").notNull().default(false),
  /** Minutes to make a new auton (rough estimate). */
  newAutonTimeMinutes: integer("new_auton_time_minutes"),
  /** Number of REV motor controllers on the robot. */
  revMotorControllerCount: integer("rev_motor_controller_count"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Per-event allowlist: which scouters may access Pit scouting UI/APIs. */
export const eventPitScoutingAccess = pgTable(
  "event_pit_scouting_access",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    scouterId: integer("scouter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("event_pit_scouting_access_event_scouter").on(t.eventId, t.scouterId)],
);

export const scoutingEntries = pgTable("scouting_entries", {
  id: serial("id").primaryKey(),
  scouterId: integer("scouter_id").notNull(),
  eventId: integer("event_id").notNull(),
  teamId: integer("team_id").notNull(),
  matchNumber: integer("match_number").notNull(),

  autoBallsShot: integer("auto_balls_shot").notNull().default(0),
  autoAccuracy: integer("auto_accuracy"),
  autoNotes: text("auto_notes"),
  autoDrawing: text("auto_drawing"),
  autoClimbSuccess: text("auto_climb_success").notNull().default("none"),
  autoClimbPosition: text("auto_climb_position"),
  autoClimbLevel: text("auto_climb_level"),

  teleopBallsShot: integer("teleop_balls_shot").notNull().default(0),
  teleopShootPosition: text("teleop_shoot_position"),
  teleopMoveWhileShoot: boolean("teleop_move_while_shoot").notNull().default(false),
  teleopFpsEstimate: integer("teleop_fps_estimate").notNull().default(0),
  teleopAccuracy: integer("teleop_accuracy").notNull().default(5),
  /** 0–100 when recorded; null when scout did not score evaded defense this match. */
  evadedDefense: integer("evaded_defense"),

  climbSuccess: text("climb_success").notNull().default("none"),
  climbPosition: text("climb_position"),
  climbLevel: text("climb_level"),

  playedDefense: boolean("played_defense").notNull().default(false),
  defenseRating: integer("defense_rating").notNull().default(0),
  defenseNotes: text("defense_notes"),

  driverSkill: integer("driver_skill"),
  driverSkillNotes: text("driver_skill_notes"),

  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const repAwards = pgTable("rep_awards", {
  id: serial("id").primaryKey(),
  scouterId: integer("scouter_id").notNull().references(() => users.id),
  awardedById: integer("awarded_by_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  reason: text("reason"),
  eventId: integer("event_id").references(() => events.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const scheduleMatches = pgTable("schedule_matches", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  matchNumber: integer("match_number").notNull(),
  red1: integer("red1"),
  red2: integer("red2"),
  red3: integer("red3"),
  blue1: integer("blue1"),
  blue2: integer("blue2"),
  blue3: integer("blue3"),
  time: text("time"),
  videoUrl: text("video_url"),
  redScore: integer("red_score"),
  blueScore: integer("blue_score"),
  winningAlliance: text("winning_alliance"),
});

export const scoutSlots = ["R1", "R2", "R3", "B1", "B2", "B3"] as const;
export type ScoutSlot = (typeof scoutSlots)[number];

export const scoutAssignments = pgTable(
  "scout_assignments",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull().references(() => events.id),
    matchNumber: integer("match_number").notNull(),
    slot: text("slot").notNull(),
    scouterId: integer("scouter_id").references(() => users.id),
  },
  (t) => [unique("scout_assignments_event_match_slot").on(t.eventId, t.matchNumber, t.slot)]
);

export const scoutAssignmentRequests = pgTable("scout_assignment_requests", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id),
  type: text("type").notNull(), // 'break' | 'trade'
  requesterId: integer("requester_id").notNull().references(() => users.id),
  targetScouterId: integer("target_scouter_id").references(() => users.id), // for trade
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'denied' | 'cancelled'
  reviewedById: integer("reviewed_by_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const scouterBreakCredits = pgTable("scouter_break_credits", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id),
  scouterId: integer("scouter_id").notNull().references(() => users.id),
  breaksUsed: integer("breaks_used").notNull().default(0),
}, (t) => [unique("scouter_break_credits_event_scouter").on(t.eventId, t.scouterId)]);

/** Per-event attendance: which scouters are physically present (defaults to true if no row). */
export const eventScouterPresence = pgTable(
  "event_scouter_presence",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull().references(() => events.id),
    scouterId: integer("scouter_id").notNull().references(() => users.id),
    isPresent: boolean("is_present").notNull().default(true),
  },
  (t) => [unique("event_scouter_presence_event_scouter").on(t.eventId, t.scouterId)],
);

export const usersRelations = relations(users, ({ many }) => ({
  scoutingEntries: many(scoutingEntries),
  pitScoutingEntries: many(pitScoutingEntries),
  repAwardsReceived: many(repAwards),
  scoutAssignments: many(scoutAssignments),
  eventPitScoutingAccess: many(eventPitScoutingAccess),
}));

export const repAwardsRelations = relations(repAwards, ({ one }) => ({
  scouter: one(users, { fields: [repAwards.scouterId], references: [users.id] }),
  awardedBy: one(users, { fields: [repAwards.awardedById], references: [users.id] }),
  event: one(events, { fields: [repAwards.eventId], references: [events.id] }),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  eventTeams: many(eventTeams),
  scoutingEntries: many(scoutingEntries),
  pitScoutingEntries: many(pitScoutingEntries),
  scheduleMatches: many(scheduleMatches),
  scoutAssignments: many(scoutAssignments),
  scoutAssignmentRequests: many(scoutAssignmentRequests),
  scouterBreakCredits: many(scouterBreakCredits),
  eventScouterPresence: many(eventScouterPresence),
  picklists: many(picklists),
  allianceSimSessions: many(allianceSimSessions),
  eventPitScoutingAccess: many(eventPitScoutingAccess),
}));

export const eventPitScoutingAccessRelations = relations(eventPitScoutingAccess, ({ one }) => ({
  event: one(events, { fields: [eventPitScoutingAccess.eventId], references: [events.id] }),
  scouter: one(users, { fields: [eventPitScoutingAccess.scouterId], references: [users.id] }),
}));

export const eventScouterPresenceRelations = relations(eventScouterPresence, ({ one }) => ({
  event: one(events, { fields: [eventScouterPresence.eventId], references: [events.id] }),
  scouter: one(users, { fields: [eventScouterPresence.scouterId], references: [users.id] }),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  eventTeams: many(eventTeams),
  scoutingEntries: many(scoutingEntries),
  pitScoutingEntries: many(pitScoutingEntries),
}));

export const pitScoutingEntriesRelations = relations(pitScoutingEntries, ({ one }) => ({
  scouter: one(users, { fields: [pitScoutingEntries.scouterId], references: [users.id] }),
  event: one(events, { fields: [pitScoutingEntries.eventId], references: [events.id] }),
  team: one(teams, { fields: [pitScoutingEntries.teamId], references: [teams.id] }),
}));

export const eventTeamsRelations = relations(eventTeams, ({ one }) => ({
  event: one(events, { fields: [eventTeams.eventId], references: [events.id] }),
  team: one(teams, { fields: [eventTeams.teamId], references: [teams.id] }),
}));

export const scoutingEntriesRelations = relations(scoutingEntries, ({ one }) => ({
  scouter: one(users, { fields: [scoutingEntries.scouterId], references: [users.id] }),
  event: one(events, { fields: [scoutingEntries.eventId], references: [events.id] }),
  team: one(teams, { fields: [scoutingEntries.teamId], references: [teams.id] }),
}));

export const scheduleMatchesRelations = relations(scheduleMatches, ({ one }) => ({
  event: one(events, { fields: [scheduleMatches.eventId], references: [events.id] }),
}));

export const scoutAssignmentsRelations = relations(scoutAssignments, ({ one }) => ({
  event: one(events, { fields: [scoutAssignments.eventId], references: [events.id] }),
  scouter: one(users, { fields: [scoutAssignments.scouterId], references: [users.id] }),
}));

export const scoutAssignmentRequestsRelations = relations(scoutAssignmentRequests, ({ one }) => ({
  event: one(events, { fields: [scoutAssignmentRequests.eventId], references: [events.id] }),
  requester: one(users, { fields: [scoutAssignmentRequests.requesterId], references: [users.id] }),
  targetScouter: one(users, { fields: [scoutAssignmentRequests.targetScouterId], references: [users.id] }),
  reviewedBy: one(users, { fields: [scoutAssignmentRequests.reviewedById], references: [users.id] }),
}));

export const picklistsRelations = relations(picklists, ({ one, many }) => ({
  event: one(events, { fields: [picklists.eventId], references: [events.id] }),
  entries: many(picklistEntries),
}));

export const picklistEntriesRelations = relations(picklistEntries, ({ one }) => ({
  picklist: one(picklists, { fields: [picklistEntries.picklistId], references: [picklists.id] }),
  team: one(teams, { fields: [picklistEntries.teamId], references: [teams.id] }),
}));

export const allianceSimSessionsRelations = relations(allianceSimSessions, ({ one }) => ({
  event: one(events, { fields: [allianceSimSessions.eventId], references: [events.id] }),
  createdBy: one(users, { fields: [allianceSimSessions.createdById], references: [users.id] }),
}));

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true });
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true });
export const insertEventTeamSchema = createInsertSchema(eventTeams).omit({ id: true });
export const insertPitScoutingEntrySchema = createInsertSchema(pitScoutingEntries)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    drivetrainType: z.enum(["swerve", "tank", "mecanum", "other"]),
  })
  .superRefine((data, ctx) => {
    const cap = data.hopperCapacity ?? 0;
    if (!data.hopperCapacityOver100 && (cap < 0 || cap > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Hopper capacity must be 0–100 unless 100+ is selected",
        path: ["hopperCapacity"],
      });
    }
  });
export const insertScoutingEntrySchema = createInsertSchema(scoutingEntries).omit({ id: true, createdAt: true });
export const insertScheduleMatchSchema = createInsertSchema(scheduleMatches).omit({ id: true });
export const insertPicklistSchema = createInsertSchema(picklists)
  .omit({ id: true, createdAt: true })
  .extend({
    icon: z.enum(["sword", "shield", "bolt"]).nullable().optional(),
    color: z.enum(["red", "orange", "yellow", "green", "blue", "violet"]).nullable().optional(),
  });
export const insertPicklistEntrySchema = createInsertSchema(picklistEntries).omit({ id: true });
export const insertRepAwardSchema = createInsertSchema(repAwards).omit({ id: true, createdAt: true });
export const insertPendingSignupSchema = createInsertSchema(pendingSignups).omit({ id: true, createdAt: true });
export const insertScoutAssignmentSchema = createInsertSchema(scoutAssignments).omit({ id: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type PendingSignup = typeof pendingSignups.$inferSelect;
export type InsertPendingSignup = z.infer<typeof insertPendingSignupSchema>;
export type User = typeof users.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;
export type Season = typeof seasons.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;
export type InsertEventTeam = z.infer<typeof insertEventTeamSchema>;
export type EventTeam = typeof eventTeams.$inferSelect;
export type InsertPitScoutingEntry = z.infer<typeof insertPitScoutingEntrySchema>;
export type PitScoutingEntry = typeof pitScoutingEntries.$inferSelect;
export type EventPitScoutingAccess = typeof eventPitScoutingAccess.$inferSelect;
export type InsertScoutingEntry = z.infer<typeof insertScoutingEntrySchema>;
export type ScoutingEntry = typeof scoutingEntries.$inferSelect;
export type InsertScheduleMatch = z.infer<typeof insertScheduleMatchSchema>;
export type ScheduleMatch = typeof scheduleMatches.$inferSelect;
export type Picklist = typeof picklists.$inferSelect;
export type InsertPicklist = z.infer<typeof insertPicklistSchema>;
export type InsertPicklistEntry = z.infer<typeof insertPicklistEntrySchema>;
export type PicklistEntry = typeof picklistEntries.$inferSelect;
export type RepAward = typeof repAwards.$inferSelect;
export type InsertRepAward = z.infer<typeof insertRepAwardSchema>;
export type ScoutAssignment = typeof scoutAssignments.$inferSelect;
export type InsertScoutAssignment = z.infer<typeof insertScoutAssignmentSchema>;
export type ScoutAssignmentRequest = typeof scoutAssignmentRequests.$inferSelect;
export type InsertScoutAssignmentRequest = typeof scoutAssignmentRequests.$inferInsert;
export type AllianceSimSession = typeof allianceSimSessions.$inferSelect;
