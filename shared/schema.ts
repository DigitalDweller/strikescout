import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("scouter"),
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

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location"),
  startDate: text("start_date"),
  isActive: boolean("is_active").notNull().default(false),
  currentMatchNumber: integer("current_match_number").notNull().default(1),
  tbaEventKey: text("tba_event_key"),
  tbaEventKeyValidated: boolean("tba_event_key_validated").notNull().default(false),
  tbaAutoSync: boolean("tba_auto_sync").notNull().default(false),
  szrWeights: text("szr_weights"),
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

export const usersRelations = relations(users, ({ many }) => ({
  scoutingEntries: many(scoutingEntries),
  repAwardsReceived: many(repAwards),
}));

export const repAwardsRelations = relations(repAwards, ({ one }) => ({
  scouter: one(users, { fields: [repAwards.scouterId], references: [users.id] }),
  awardedBy: one(users, { fields: [repAwards.awardedById], references: [users.id] }),
  event: one(events, { fields: [repAwards.eventId], references: [events.id] }),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  eventTeams: many(eventTeams),
  scoutingEntries: many(scoutingEntries),
  scheduleMatches: many(scheduleMatches),
  picklists: many(picklists),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  eventTeams: many(eventTeams),
  scoutingEntries: many(scoutingEntries),
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

export const picklistsRelations = relations(picklists, ({ one, many }) => ({
  event: one(events, { fields: [picklists.eventId], references: [events.id] }),
  entries: many(picklistEntries),
}));

export const picklistEntriesRelations = relations(picklistEntries, ({ one }) => ({
  picklist: one(picklists, { fields: [picklistEntries.picklistId], references: [picklists.id] }),
  team: one(teams, { fields: [picklistEntries.teamId], references: [teams.id] }),
}));

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true });
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true });
export const insertEventTeamSchema = createInsertSchema(eventTeams).omit({ id: true });
export const insertScoutingEntrySchema = createInsertSchema(scoutingEntries).omit({ id: true, createdAt: true });
export const insertScheduleMatchSchema = createInsertSchema(scheduleMatches).omit({ id: true });
export const insertPicklistSchema = createInsertSchema(picklists).omit({ id: true, createdAt: true });
export const insertPicklistEntrySchema = createInsertSchema(picklistEntries).omit({ id: true });
export const insertRepAwardSchema = createInsertSchema(repAwards).omit({ id: true, createdAt: true });
export const insertPendingSignupSchema = createInsertSchema(pendingSignups).omit({ id: true, createdAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type PendingSignup = typeof pendingSignups.$inferSelect;
export type InsertPendingSignup = z.infer<typeof insertPendingSignupSchema>;
export type User = typeof users.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;
export type InsertEventTeam = z.infer<typeof insertEventTeamSchema>;
export type EventTeam = typeof eventTeams.$inferSelect;
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
