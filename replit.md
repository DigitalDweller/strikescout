# FRC Scout Hub

## Overview
A FIRST Robotics Competition scouting web application for the 2026 "Rebuilt" season. Teams use this to track robot performance at competitions with role-based access for admins and scouters.

## Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn UI + wouter routing
- **Backend:** Express.js + Passport.js (local strategy auth)
- **Database:** PostgreSQL via Drizzle ORM
- **State Management:** TanStack React Query

## Key Features
- Admin/Scouter role-based authentication (no self-registration, admin creates accounts)
- Event management with team roster control
- Active event system (admin sets which event scouters see)
- Match control panel for advancing/resetting match numbers
- Detailed scouting form with:
  - Auto: balls shot counter, field drawing canvas, notes
  - Teleop: balls shot counter, shoot position, move-while-shoot toggle, FPS estimate, accuracy slider
  - Endgame: climb result (success/failed/none), climb position (left/middle/right)
  - Defense: 0-10 rating slider + notes
  - Driver skill notes + general notes
- Multi-robot scouting (one scouter can scout multiple robots per match)
- Team profile pages with performance charts (recharts)
- Individual scouter performance tracking
- Alliance Creator (coming soon placeholder)

## Data Model
- **users** - id, username, password, displayName, role (admin/scouter)
- **events** - id, name, location, startDate, isActive, currentMatchNumber
- **teams** - id, teamNumber, teamName
- **event_teams** - junction table linking teams to events
- **scouting_entries** - id, scouterId, eventId, teamId, matchNumber, autoBallsShot, autoNotes, autoDrawing, autoClimbSuccess, autoClimbPosition, autoClimbLevel, teleopBallsShot, teleopShootPosition, teleopMoveWhileShoot, teleopFpsEstimate, teleopAccuracy, climbSuccess, climbPosition, climbLevel, defenseRating, defenseNotes, driverSkillNotes, notes, createdAt

## Default Credentials (Seed Data)
- Admin: `admin123` / `admin123`
- Scouter 1: `scout1` / `scout123`
- Scouter 2: `scout2` / `scout123`

## User Preferences
- No self-registration; admin creates all accounts
- Big touch-friendly buttons for tablet use
- Field drawing canvas for recording auto paths

## File Structure
- `shared/schema.ts` - Drizzle schema, Zod validators, TypeScript types
- `server/auth.ts` - Passport auth setup with session management
- `server/storage.ts` - DatabaseStorage implementing IStorage interface
- `server/routes.ts` - All API endpoints + seed function
- `server/db.ts` - Database connection pool
- `client/src/hooks/use-auth.tsx` - Auth context provider
- `client/src/components/app-sidebar.tsx` - Role-based navigation sidebar
- `client/src/pages/` - All page components

## Running
- `npm run dev` starts both Express backend and Vite frontend
- `npm run db:push` syncs Drizzle schema to PostgreSQL
