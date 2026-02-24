# FRC Scout Hub

## Overview
A FIRST Robotics Competition scouting web application for the 2026 "Rebuilt" season. Teams use this to track robot performance at competitions with role-based access for admins and scouters.

## Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn UI + wouter routing
- **Backend:** Express.js + Passport.js (local strategy auth)
- **Database:** PostgreSQL via Drizzle ORM
- **State Management:** TanStack React Query

## Key Features
- Admin/Scouter role-based authentication
- Event management with team roster control
- Active event system (admin sets which event scouters see)
- Match control panel for advancing/resetting match numbers
- Scouting form with counter inputs and defense rating
- Team profile pages with performance charts (recharts)
- Individual scouter performance tracking
- Alliance Creator (coming soon placeholder)

## Data Model
- **users** - id, username, password, displayName, role (admin/scouter)
- **events** - id, name, location, startDate, isActive, currentMatchNumber
- **teams** - id, teamNumber, teamName
- **event_teams** - junction table linking teams to events
- **scouting_entries** - id, scouterId, eventId, teamId, matchNumber, autoScore, teleopScore, endgameScore, defenseRating, notes, createdAt

## Default Credentials (Seed Data)
- Admin: `admin` / `admin123`
- Scouter 1: `scout1` / `scout123`
- Scouter 2: `scout2` / `scout123`

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
