# Objective
Add a Picklist / Alliance Builder page to each event. Two-panel layout: left side shows all event teams with minimal info (number, name, OPR), right side is a drag-to-reorder ranked picklist. Picklist order persists in the database per event. One shared picklist per event (no auth).

# Tasks

### T001: Add picklist schema and storage
- **Blocked By**: []
- **Details**:
  - Add `picklist_entries` table to `shared/schema.ts`: id (serial PK), eventId (integer, not null), teamId (integer, not null), rank (integer, not null)
  - Add insert schema, insert type, and select type
  - Add unique constraint on (eventId, teamId)
  - Update `IStorage` in `server/storage.ts` with CRUD methods: `getPicklist(eventId)`, `setPicklist(eventId, teamIds[])` (replaces entire picklist with ordered team IDs), `removeFromPicklist(eventId, teamId)`
  - Implement in `DatabaseStorage`
  - Files: `shared/schema.ts`, `server/storage.ts`
  - Acceptance: Schema pushes cleanly, storage methods work

### T002: Add picklist API routes
- **Blocked By**: [T001]
- **Details**:
  - `GET /api/events/:eventId/picklist` — returns ordered picklist entries joined with team data
  - `PUT /api/events/:eventId/picklist` — accepts `{ teamIds: number[] }` and replaces the full picklist order
  - `DELETE /api/events/:eventId/picklist/:teamId` — removes a team from the picklist
  - Files: `server/routes.ts`
  - Acceptance: All endpoints return correct data, PUT correctly reorders

### T003: Build Picklist page UI
- **Blocked By**: [T002]
- **Details**:
  - Create `client/src/pages/picklist.tsx` with two-panel layout
  - **Left panel ("Available Teams")**: scrollable list of all event teams not yet on the picklist, each row shows team number, name, OPR; search/filter input at top; click or tap "+" button to add to bottom of picklist
  - **Right panel ("Your Picklist")**: numbered ranked list, drag-to-reorder using HTML5 drag-and-drop (no extra library needed), each row shows rank #, team number, name, OPR, and a remove "X" button; drag handle on left
  - On reorder or add/remove, call PUT endpoint with the new full order
  - Use TanStack Query for data fetching, optimistic updates for snappy feel
  - Touch-friendly: large tap targets, visible drag handles
  - Responsive: stack panels vertically on mobile
  - Files: `client/src/pages/picklist.tsx`
  - Acceptance: Can add teams, reorder by drag, remove teams, order persists on page refresh

### T004: Register page and add to sidebar
- **Blocked By**: [T003]
- **Details**:
  - Register route `/events/:id/picklist` in `client/src/App.tsx`
  - Add "Picklist" nav item to sidebar in `client/src/components/app-sidebar.tsx` (icon: ListOrdered from lucide-react), placed after Scouting Form
  - Files: `client/src/App.tsx`, `client/src/components/app-sidebar.tsx`
  - Acceptance: Picklist page accessible from sidebar, navigation works

### T005: Push schema and verify
- **Blocked By**: [T004]
- **Details**:
  - Run `npm run db:push` to sync the new picklist_entries table
  - Test full flow: navigate to picklist, add teams, reorder, remove, refresh to confirm persistence
  - Files: none (runtime verification)
  - Acceptance: Full picklist flow works end-to-end
