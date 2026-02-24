import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("scouter"),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location"),
  startDate: text("start_date"),
  isActive: boolean("is_active").notNull().default(false),
  currentMatchNumber: integer("current_match_number").notNull().default(1),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  teamNumber: integer("team_number").notNull().unique(),
  teamName: text("team_name").notNull(),
});

export const eventTeams = pgTable("event_teams", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  teamId: integer("team_id").notNull(),
});

export const scoutingEntries = pgTable("scouting_entries", {
  id: serial("id").primaryKey(),
  scouterId: integer("scouter_id").notNull(),
  eventId: integer("event_id").notNull(),
  teamId: integer("team_id").notNull(),
  matchNumber: integer("match_number").notNull(),
  autoScore: integer("auto_score").notNull().default(0),
  teleopScore: integer("teleop_score").notNull().default(0),
  endgameScore: integer("endgame_score").notNull().default(0),
  defenseRating: integer("defense_rating").notNull().default(3),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  scoutingEntries: many(scoutingEntries),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  eventTeams: many(eventTeams),
  scoutingEntries: many(scoutingEntries),
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

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true });
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true });
export const insertEventTeamSchema = createInsertSchema(eventTeams).omit({ id: true });
export const insertScoutingEntrySchema = createInsertSchema(scoutingEntries).omit({ id: true, createdAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;
export type InsertEventTeam = z.infer<typeof insertEventTeamSchema>;
export type EventTeam = typeof eventTeams.$inferSelect;
export type InsertScoutingEntry = z.infer<typeof insertScoutingEntrySchema>;
export type ScoutingEntry = typeof scoutingEntries.$inferSelect;
