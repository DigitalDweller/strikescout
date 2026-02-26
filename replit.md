# StrikeScout

## Overview
A FIRST Robotics Competition scouting web application for the 2026 "Rebuilt" season. Unified team scouting app — no sign-in required, no role distinctions. Anyone can scout as many robots as they want per match, view all team stats, browse a searchable/sortable team list, and view the full competition schedule (imported via CSV).

## Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn UI + wouter routing
- **Backend:** Express.js (no auth — open access)
- **Database:** PostgreSQL via Drizzle ORM
- **State Management:** TanStack React Query
- **Dark Mode:** ThemeProvider with localStorage persistence + system preference detection

## Key Features
- No authentication — open access for the entire scouting team
- Event selection as the home page (list of events with + button to add, no sidebar)
- Event settings dialog (rename, change location, delete with 5-step confirmation)
- Event-scoped sidebar navigation showing event name, location, back button, and event tabs (Leaderboard, Scout, Teams, Schedule)
- **Leaderboard page** with podium-style top 3 teams per category (Auto, Throughput, Accuracy, Defense, Climb Rate) with team avatars, plus 4th-8th place runners-up; placeholder avatar for teams without TBA avatars
- Detailed scouting form with:
  - Auto: balls shot counter, field drawing canvas, climb tracking, notes
  - Teleop: shooting heatmap, FPS estimate, accuracy slider, move-while-shoot toggle
  - Endgame: climb result (success/failed/none), climb position (left/middle/right), climb level (1/2/3)
  - Defense: 0-10 rating slider + notes
  - Driver skill notes + misc. notes
- Multi-robot scouting (scout multiple robots per match side-by-side)
- Local match number control (starts at 1, auto-increments after submission)
- Team List page with search and sort by any stat column (no entry count)
- Schedule page with CSV import for competition match schedule (clickable rows → match detail)
- Match detail page with alliance cards, scouting data, and embedded YouTube videos
- Team profile pages with ranking badges (ordinal, color-coded by percentile) and match history
- The Blue Alliance integration: TBA event key config, manual + auto-sync (every 5 min) for match videos
- Event Settings page for TBA configuration
- Data Management page for CSV export (scouting data, team summary, schedule)
- Dark mode toggle (moon/sun icon in sidebar)
- High-readability design: large bold fonts, strong contrast, touch-friendly

## Data Model
- **events** - id, name, location, startDate, isActive (legacy), currentMatchNumber (legacy), tbaEventKey, tbaAutoSync
- **teams** - id, teamNumber, teamName, city, stateProv, country
- **event_teams** - junction table linking teams to events
- **scouting_entries** - id, scouterId (always 0), eventId, teamId, matchNumber, autoBallsShot, autoNotes, autoDrawing, autoClimbSuccess, autoClimbPosition, autoClimbLevel, teleopBallsShot, teleopShootPosition, teleopMoveWhileShoot, teleopFpsEstimate, teleopAccuracy, climbSuccess, climbPosition, climbLevel, defenseRating, defenseNotes, driverSkillNotes, notes, createdAt
- **schedule_matches** - id, eventId, matchNumber, red1, red2, red3, blue1, blue2, blue3, time, videoUrl
- **users** - legacy table (not used, kept for schema compatibility)

## User Preferences
- No sign-in; open access for the team
- Big touch-friendly buttons for tablet use
- Field drawing canvas for recording auto paths
- CSV import for team lists and match schedules

## File Structure
- `shared/schema.ts` - Drizzle schema, Zod validators, TypeScript types
- `server/storage.ts` - DatabaseStorage implementing IStorage interface
- `server/routes.ts` - All API endpoints + seed function
- `server/db.ts` - Database connection pool
- `client/src/hooks/use-theme.tsx` - Dark mode theme provider
- `client/src/components/app-sidebar.tsx` - Navigation sidebar
- `client/src/pages/admin-events.tsx` - Event selection home page (default `/` route)
- `client/src/pages/scout-form.tsx` - Multi-robot scouting form
- `client/src/pages/form-history.tsx` - Entry history with edit/delete
- `client/src/pages/team-list.tsx` - Searchable/sortable team list
- `client/src/pages/schedule.tsx` - Match schedule with CSV import
- `client/src/pages/admin-event-detail.tsx` - Event overview with leaderboards and team roster
- `client/src/pages/team-profile.tsx` - Individual team stats (Auto/Teleop/Endgame sections + heatmap)
- `client/src/pages/team-notes.tsx` - Full scout notes view for a team
- `client/src/pages/match-detail.tsx` - Minimal match detail view (teams, scores, winner from TBA, video)
- `client/src/pages/event-settings.tsx` - Event settings (TBA integration config)
- `server/tba.ts` - The Blue Alliance API service

## Running
- `npm run dev` starts both Express backend and Vite frontend
- `npm run db:push` syncs Drizzle schema to PostgreSQL
