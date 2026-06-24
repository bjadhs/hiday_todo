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
│   │   └── plan/page.tsx       # "/plan" → <PlanTimeline />
│   ├── layout.tsx              # Root layout, <Providers>, metadata
│   ├── providers.tsx           # next-themes ThemeProvider
│   └── globals.css             # Tailwind v4 theme + brutalist utilities
├── components/
│   ├── kanban/                 # Drag-and-drop board (board → column → card)
│   ├── plan/                   # Day-planner timeline
│   ├── ui/                     # Base primitives: badge, button, input
│   ├── add-todo.tsx            # Expanding "add a todo" form (list/grid views)
│   ├── sidebar.tsx             # Nav + project CRUD + theme toggle
│   ├── theme-toggle.tsx
│   ├── todo-item.tsx           # Todo row for list/grid views
│   └── todo-list.tsx           # Page shell: header, filter/view tabs, body
└── lib/
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

`plan-timeline.tsx` renders a 24-hour vertical timeline. Click to add a `PlanItem` (snapped to 15-minute increments, default 60-minute duration); blocks can be edited and removed. Times are stored as minutes-from-midnight (`startMinutes`, `durationMinutes`).

## Styling

- **Tokens:** semantic CSS variables defined in `globals.css` under `@theme inline` (e.g. `bg-background`, `text-foreground`, `text-foreground-muted`, `bg-surface`, `bg-background-elevated`, status colors like `info`/`warning`/`success`/`danger` with `-bg`/`-border` variants).
- **Brutalist shadows:** `shadow-brutal`, `shadow-brutal-sm`, `shadow-brutal-xs`, etc.
- **Custom utilities:** `card-interactive`, `btn-brutal`, `nav-item-active`, `gradient-text-primary`, and `animate-*` helpers — all defined in `globals.css`.
- Use `cn()` from `@/lib/utils` to compose class names.

## Conventions & Gotchas

- Components that read the store are `"use client"`. Pages stay minimal and delegate to them.
- **Hydration:** the store is client-only/persisted, so server render and first client render can disagree. Components that branch on persisted state guard with `useMounted()` (returns `null` until mounted) — follow that pattern when adding store-driven UI.
- Avoid calling `Date.now()` during render; compute time-derived values in effects/handlers or memoize, to satisfy the React hooks/purity lint rules (same constraints as `myapp`).
- **No test suite** — verify changes with `npm run build` and by running the app against a Postgres (`DATABASE_URL`).
- **Persistence:** store mutations are optimistic and write through to server actions in `src/actions/*` (mirroring the store actions 1:1). On a write failure the store re-hydrates from `getAllData()`. IDs are client-generated; `filterMode`/`viewMode` are local-only UI state (not persisted).
- Timestamps on todos (`createdAt`) are Unix ms; plan times are minutes-from-midnight; `Todo.date` is a `YYYY-MM-DD` string.
