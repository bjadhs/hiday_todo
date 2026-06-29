# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> `AGENTS.md` is a symlink to this file — edit `CLAUDE.md` only.

## Project Overview

**Hiday Todo** is a lightweight, client-only todo + day-planner app. It's a simplified companion to the main **Hiday** time-tracking app (in `../myapp`) and reuses its neo-brutalist "Bruddle" design language — high-contrast borders, hard offset shadows (`shadow-brutal-*`), and vibrant purple accents.

State lives in a Zustand store that the UI reads synchronously, but it is **backed by a self-hosted Postgres** database (via Drizzle ORM): the store hydrates from the DB on mount and **writes through** to server actions on every mutation. The whole app sits behind a single shared-password gate. It deploys as a Docker image (Dokploy) against the existing Hostinger Postgres. Pages are intentionally thin — they render client components that read from the store.

## Development Commands

Run from the `todo/` directory:

```bash
npm run dev          # Next.js dev server (Turbopack)
npm run build        # Production build (also runs tsc)
npm run start        # Serve the production build
npm run lint         # ESLint (flat config: eslint.config.mjs)
npm run db:generate  # Generate a Drizzle migration from schema changes
npm run db:migrate   # Apply migrations (drizzle-kit) — needs DATABASE_URL
npm run db:seed      # Insert default projects if the table is empty
```

**Node:** 20.x. Next.js 16 removed `next lint`, so the lint script runs `eslint .` directly.

**Env vars** (see `.env.example`; put them in `.env.local` for dev): `DATABASE_URL` (Postgres), `APP_PASSWORD` (the shared gate password), `AUTH_SECRET` (signs the session cookie).

## Deployment (self-hosted via `docker compose`)

The app self-hosts as a bundled `app` + `db` stack (`docker-compose.yml`):

```bash
docker compose up -d --build   # build image, start db+app; entrypoint migrates + seeds
```

- **`.env`** (next to `docker-compose.yml`, gitignored — see `.env.docker.example`) supplies `POSTGRES_USER/PASSWORD/DB`, `APP_PASSWORD`, `AUTH_SECRET`.
- **Public HTTPS** is via an external Traefik on `dokploy-network`: the `app` service carries `traefik.*` labels routing `todo.bijbrin.cloud` → port 3000 with a Let's Encrypt cert (HTTP→HTTPS redirect). Host ports are bound to the Tailscale IP only, so direct `:8085`/`:5435` access is private.
- **Reverse-proxy gotcha:** behind a proxy on a custom domain, Next.js rejects Server Actions (login/add/edit) with a **403** unless the forwarded host is allowlisted — see `serverActions.allowedOrigins` in `next.config.ts`. Add any new domain there (a rebuild is required; it's baked at build time).
- **Backups:** a `db-backup` service (postgres:16-alpine) runs `scripts/backup.sh` — a gzipped `pg_dump` of the database into `./backups` (bind mount, gitignored), pruned after `BACKUP_RETENTION_DAYS` (default 7). It backs up on start then ~daily. Restore with `gunzip -c backups/<file>.sql.gz | psql <conn>`. Note: the DB has **no WAL archiving / PITR**, so these dumps are the only safety net.

### Building the image — two prerequisites

The `Dockerfile` build (`npm ci`, strict) fails unless:
1. **`package-lock.json` is in sync with `package.json`.** After changing deps, regenerate the lockfile against the build base image: `docker run --rm -v "$PWD":/app -w /app node:20-alpine npm install --package-lock-only`.
2. **A `public/` directory exists** — the `Dockerfile` does `COPY .../public ./public`. Keep `public/.gitkeep` committed even if there are no static assets.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Styling:** Tailwind CSS v4 with custom design tokens in `globals.css`
- **State:** Zustand — the in-memory source of truth, hydrated from and written through to Postgres (no `persist`/localStorage, no React Query).
- **Database:** self-hosted Postgres via **Drizzle ORM** (driver: `postgres`/postgres.js). Tables in `src/lib/db/schema.ts`; migrations in `drizzle/`.
- **Auth:** single shared-password gate. Session is a signed httpOnly cookie; routes guarded by `src/proxy.ts`, server actions guarded by `assertAuthed()`.
- **Deploy:** `docker compose` (`docker-compose.yml`) on a self-hosted box — bundled `app` (standalone `Dockerfile`) + `db` (Postgres), fronted by Traefik for public HTTPS. `docker-entrypoint.sh` runs `scripts/migrate.mjs` + `scripts/seed.mjs` before starting the server. See **Deployment** below. (Originally Dokploy; moved to plain compose.)
- **Theming:** `next-themes` (class-based dark mode, `defaultTheme="system"`)
- **Icons:** `lucide-react`
- **Drag & drop:** `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` (kanban board)

## Project Structure

```
todo/src/
├── app/
│   ├── (app)/                  # Main app group (shares the sidebar layout)
│   │   ├── layout.tsx          # Sidebar + full-height main pane
│   │   ├── page.tsx            # "/"  → <TodoList projectId="__all__" />
│   │   ├── [projectId]/page.tsx# "/:projectId" (and "/inbox") → <TodoList />
│   │   ├── plan/page.tsx       # "/plan" → <PlanTimeline />
│   │   ├── plan-md/page.tsx    # "/plan-md" → <PlanMd /> (daily markdown)
│   │   └── archived/page.tsx   # "/archived" → <ArchivedView /> (soft-delete trash)
│   ├── layout.tsx              # Root layout, <Providers>, metadata
│   ├── providers.tsx           # next-themes ThemeProvider
│   └── globals.css             # Tailwind v4 theme + brutalist utilities
├── components/
│   ├── kanban/                 # Drag-and-drop board (board → column → card)
│   ├── plan/                   # Day-planner timeline + edit dialog + markdown view
│   ├── ui/                     # Base primitives: badge, button, input
│   ├── add-todo.tsx            # Expanding "add a todo" form (list/grid views)
│   ├── archived-view.tsx       # Archived trash: restore / permanently delete
│   ├── sidebar.tsx             # Nav + project CRUD + theme toggle
│   ├── theme-toggle.tsx
│   ├── todo-item.tsx           # Todo row for list/grid views
│   └── todo-list.tsx           # Page shell: header, filter/view tabs, body
└── lib/
    ├── archive.ts              # ARCHIVE_RETENTION_MS (3-day trash window)
    ├── store.ts                # Zustand store (state + actions + persist)
    ├── types.ts                # Shared types
    ├── use-mounted.ts          # Hydration-safe mount guard
    └── utils.ts                # cn(), formatDate()
```

**Path mapping:** `@/*` → `./src/*`.

## State (`src/lib/store.ts`)

`useTodoStore` is the whole app's state. It's persisted to `localStorage` under the key `todo-store`.

Key slices:
- `projects: Project[]` — always includes a non-deletable **Inbox** (`__inbox__`). New project colors/icons cycle through preset lists in `sidebar.tsx`.
- `todos: Todo[]` — flat array; ordering is array position.
- `planItems: PlanItem[]` — time blocks for the `/plan` timeline.
- `filterMode` / `viewMode` — persisted UI state for the todo views (see below).

Important behaviors:
- **Special project ids:** `__all__` (the "All" view, not a real project) and `__inbox__`. `filterByProject` in `todo-list.tsx` treats todos with no `projectId` as Inbox.
- **`merge` migration:** the persist config has a `merge` that (a) re-inserts Inbox if missing and (b) migrates the legacy `filterMode: "kanban"` to `filterMode: "date"` + `viewMode: "kanban"` (kanban moved from a filter to a view — see below).
- Mutations are plain immutable `set` updates. Always go through the store actions (`addTodo`, `updateTodo`, `moveTodo`, etc.) — never mutate arrays in place.

## Filters vs. Views (todo screens)

The todo screen has two independent axes, rendered as two tab groups in `todo-list.tsx`:

- **Filter (`FilterMode`, left tabs):** `date | day | tag` — how todos are **grouped into sections**. Implemented by the `groupBy*` helpers in `todo-list.tsx`.
- **View (`ViewMode`, right tabs):** `list | grid-2 | grid-3 | kanban` — how todos are **laid out**.

`kanban` is a **view**, not a filter. When the kanban view is active:
- The filter tabs are hidden (the board has its own fixed status columns).
- `<KanbanBoard>` renders instead of the grouped list/grid.

## Kanban board (`src/components/kanban/`)

Drag-and-drop board ported from `myapp`'s kanban, adapted to the local store.

- **`kanban-board.tsx`** — owns the `DndContext`. Columns are **Next / Doing / Done** (`KanbanStatus`). Uses a column-first `collisionDetection` (pointer-within, falling back to rect-intersection) so a card can be dropped into an empty column rather than getting trapped by the nearest sibling card. `onDragEnd` calls `store.moveTodo`.
- **`kanban-column.tsx`** — a `useDroppable` column wrapping a `SortableContext`. Has an inline **+** quick-add that creates a todo directly in that column/status.
- **`kanban-card.tsx`** — a `useSortable` card with a drag handle, complete toggle, inline title edit, and tag/date/day badges.

`store.moveTodo(id, status, overId?)` updates a todo's `kanbanStatus`, slots it next to the hovered card (or appends), and keeps `completed` in sync with the **Done** column. New cards added from the board are assigned to the current project (or Inbox in the "All" view).

## Day planner (`/plan`)

`plan-timeline.tsx` renders a 24-hour vertical timeline. Click empty space to add a `PlanItem` (snapped to 15-minute increments, default 60-minute duration). Times are stored as minutes-from-midnight (`startMinutes`, `durationMinutes`).

Clicking an existing block opens **`plan-edit-dialog.tsx`** — a modal (no Radix dep; a fixed overlay closed by Escape / backdrop click) to edit `title`, `description`, `projectId`, and the time span. Start/end/duration are three linked views of the same span: editing the start shifts the block (keeps duration); editing the end or duration repins the other. The dialog also has a Delete action. `PlanItem.description` is an optional nullable text column (migration `0003`).

## Daily markdown (`/plan-md`, "Plan MD" in the sidebar)

`plan-md.tsx` is an **editable** monospace markdown view of a single day, synced bidirectionally with the `/plan` timeline (both read the same Zustand store, so edits on either side reflect on the other; cross-tab via realtime rehydrate). `←`/`→`/Today date nav + a **Copy** button. Three sections per day:
- **`## Plan`** — editable & synced: that day's blocks as `### HH:MM – HH:MM · Title` headings with `Project:` and optional `Note:` lines.
- **`## Focused`** / **`## Completed`** — read-only context (focus sessions for the day; todos with `completed && date === selectedDate`). Regenerated on every sync and ignored by the parser.

**Sync model** (see `src/lib/plan-markdown.ts`): a `canonicalMarkdown` is derived from the store; a `draftMarkdown` wins once you start editing. Sync is **manual** — a **Sync** button applies the `## Plan` section. The header shows a status badge: green **Synced**, amber **Unsynced** (pending edits), red **Sync failed**. The most-recent entry is at the top of each section, with a `---` rule between entries.

`parsePlanMarkdown(markdown, knownProjectNames)` returns `{ blocks, errors }`. **Validation is all-or-nothing**: if any `### ` line is malformed, has an invalid time, has end ≤ start, names a non-existent project, or duplicates another block, nothing is applied — the offending lines are listed in a banner (`Line N: reason`) and a danger toast is shown. On a clean parse, blocks diff against the day's items by their `(start, end, title)` key (`planItemKey`): matched blocks get in-place `Project:`/`Note:` updates; unmatched parsed blocks are **created**; existing items with no matching block are **deleted**. Because the key includes time+title, editing either is delete-old + create-new (a `Note:` won't survive a time/title change via markdown — use the timeline dialog). Times are 24h `HH:MM` (parser also accepts `9:00 AM`); switching days drops any unsynced draft.

**Delete guard (important):** sync never silently wipes blocks. (1) If the `## Plan` section parses to **zero blocks while items still exist** — the classic "I accidentally cleared the text" case — sync is a **no-op** (toast: nothing changed, blocks safe). (2) Any sync that *would* delete one or more blocks is **held** behind a confirm banner listing what will be deleted (with an emphatic message when it's the whole day); `applySync` only runs on explicit confirm. Editing the textarea or changing day cancels a pending confirm. This guard exists because an earlier version delete-all'd a day's plan when the heading was removed — see git history.

## Archived trash (`/archived`, "Archived" in the sidebar)

Deleting a todo, focus session, or plan block is a **soft delete**, not a hard one. Every `delete_at`-bearing table (`todos`, `sessions`, `plan_items` — migration `0004`) carries a nullable `deleted_at` (Unix ms); `NULL` = active.

- **Store model:** the store keeps active items and archived items in separate arrays (`todos`/`archivedTodos`, etc.). `removeTodo`/`removeSession`/`removePlanItem` now **archive** (stamp `deletedAt = now`, move active→archived) instead of hard-deleting; `restore*` moves back (clears `deletedAt`); `purge*` permanently deletes. Deleting a todo cascades to its sessions (archive/restore/purge together).
- **Server actions** (`src/actions/{todos,sessions,plan-items}.ts`): `archive* / restore* / delete*Forever` (+ `*SessionsForTodo*` cascades). `ARCHIVE_RETENTION_MS` lives in `src/lib/archive.ts` (kept out of the `"use server"` `data.ts`, which may only export async fns).
- **Hydration & purge:** `getAllData` first hard-deletes anything older than `ARCHIVE_RETENTION_MS` (3 days), then returns active rows (`deleted_at IS NULL`) plus `archived{Todos,PlanItems,Sessions}` (`IS NOT NULL`).
- **View:** `archived-view.tsx` lists the three kinds with "deleted Xm ago / purges in Y", an **Undo** (restore) and a permanent-delete button each. Restore returns plan items/sessions to their exact slot (date + time); a todo returns to its project/column but at the **end** of that column (todos carry no position in the `Todo` type).

## Styling

- **Tokens:** semantic CSS variables defined in `globals.css` under `@theme inline` (e.g. `bg-background`, `text-foreground`, `text-foreground-muted`, `bg-surface`, `bg-background-elevated`, status colors like `info`/`warning`/`success`/`danger` with `-bg`/`-border` variants).
- **Brutalist shadows:** `shadow-brutal`, `shadow-brutal-sm`, `shadow-brutal-xs`, etc.
- **Custom utilities:** `card-interactive`, `btn-brutal`, `nav-item-active`, `gradient-text-primary`, and `animate-*` helpers — all defined in `globals.css`.
- Use `cn()` from `@/lib/utils` to compose class names.

## Conventions & Gotchas

- **Git commits:** do **not** add a `Co-Authored-By` trailer (or any AI attribution) to commit messages. Keep messages short.
- Components that read the store are `"use client"`. Pages stay minimal and delegate to them.
- **Hydration:** the store is client-only/persisted, so server render and first client render can disagree. Components that branch on persisted state guard with `useMounted()` (returns `null` until mounted) — follow that pattern when adding store-driven UI.
- Avoid calling `Date.now()` during render; compute time-derived values in effects/handlers or memoize, to satisfy the React hooks/purity lint rules (same constraints as `myapp`).
- **No test suite** — verify changes with `npm run build` and by running the app against a Postgres (`DATABASE_URL`).
- **Persistence:** store mutations are optimistic and write through to server actions in `src/actions/*` (mirroring the store actions 1:1). On a write failure the store re-hydrates from `getAllData()`. IDs are client-generated; `filterMode`/`viewMode` are local-only UI state (not persisted).
- Timestamps on todos (`createdAt`) are Unix ms; plan times are minutes-from-midnight; `Todo.date` is a `YYYY-MM-DD` string.
