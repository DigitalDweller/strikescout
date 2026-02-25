# FRC Scout Hub

## Overview
A FIRST Robotics Competition scouting web application for the 2026 "Rebuilt" season. Unified team scouting app — no role distinctions. Anyone who logs in can scout as many robots as they want per match, view all team stats, browse a searchable/sortable team list, and view the full competition schedule (imported via CSV).

## Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn UI + wouter routing
- **Backend:** Express.js + Passport.js (local strategy auth)
- **Database:** PostgreSQL via Drizzle ORM
- **State Management:** TanStack React Query
- **Dark Mode:** ThemeProvider with localStorage persistence + system preference detection

## Key Features
- Unified access (no admin/scouter role distinction — everyone can do everything)
- Event management with team roster control
- Active event system (any user can set which event is active)
- Detailed scouting form with:
  - Auto: balls shot counter, field drawing canvas, climb tracking, notes
  - Teleop: shooting heatmap, FPS estimate, accuracy slider, move-while-shoot toggle
  - Endgame: climb result (success/failed/none), climb position (left/middle/right), climb level (1/2/3)
  - Defense: 0-10 rating slider + notes
  - Driver skill notes + general notes
- Multi-robot scouting (scout multiple robots per match side-by-side)
- Local match number control (auto-increments after submission)
- Team List page with search and sort by any stat column
- Schedule page with CSV import for competition match schedule
- Team profile pages with performance charts (recharts)
- Dark mode toggle (moon/sun icon in sidebar)

## Data Model
- **users** - id, username, password, displayName, role
- **events** - id, name, location, startDate, isActive, currentMatchNumber
- **teams** - id, teamNumber, teamName, city, stateProv, country
- **event_teams** - junction table linking teams to events
- **scouting_entries** - id, scouterId, eventId, teamId, matchNumber, autoBallsShot, autoNotes, autoDrawing, autoClimbSuccess, autoClimbPosition, autoClimbLevel, teleopBallsShot, teleopShootPosition, teleopMoveWhileShoot, teleopFpsEstimate, teleopAccuracy, climbSuccess, climbPosition, climbLevel, defenseRating, defenseNotes, driverSkillNotes, notes, createdAt
- **schedule_matches** - id, eventId, matchNumber, red1, red2, red3, blue1, blue2, blue3, time

## Default Credentials (Seed Data)
- User 1: `admin123` / `admin123`
- User 2: `scout1` / `scout123`
- User 3: `scout2` / `scout123`

## User Preferences
- No self-registration; accounts are created manually
- Big touch-friendly buttons for tablet use
- Field drawing canvas for recording auto paths
- CSV import for team lists and match schedules

## File Structure
- `shared/schema.ts` - Drizzle schema, Zod validators, TypeScript types
- `server/auth.ts` - Passport auth setup with session management
- `server/storage.ts` - DatabaseStorage implementing IStorage interface
- `server/routes.ts` - All API endpoints + seed function
- `server/db.ts` - Database connection pool
- `client/src/hooks/use-auth.tsx` - Auth context provider
- `client/src/hooks/use-theme.tsx` - Dark mode theme provider
- `client/src/components/app-sidebar.tsx` - Unified navigation sidebar
- `client/src/pages/dashboard.tsx` - Home page with quick links
- `client/src/pages/scout-form.tsx` - Multi-robot scouting form
- `client/src/pages/team-list.tsx` - Searchable/sortable team list
- `client/src/pages/schedule.tsx` - Match schedule with CSV import
- `client/src/pages/admin-events.tsx` - Event management
- `client/src/pages/admin-event-detail.tsx` - Event detail with team roster
- `client/src/pages/team-profile.tsx` - Individual team stats

## Running
- `npm run dev` starts both Express backend and Vite frontend
- `npm run db:push` syncs Drizzle schema to PostgreSQL
