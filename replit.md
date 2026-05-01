# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### `artifacts/gta-clone` — South Island City
A top-down 2D crime/driving game in the spirit of GTA1. Pure Canvas 2D — every sprite is bezier-path drawn (no images, no 3D). React + Vite + TypeScript. Served at `/` (root).

Game systems: procedural city world, AI pedestrians/police/gangs, physics engine, Web Audio synthesized music, mission system, enterable shop interiors, day/night cycle, weather system, weapon wheel, fistfighting. 

Key game files in `src/game/`: `world.ts`, `render.ts`, `physics.ts`, `ai.ts`, `audio.ts`, `game.ts`, `sprites.ts`, `input.ts`, `interior.ts`, `types.ts`, `factory.ts`, `utils.ts`.
UI: `src/components/GameCanvas.tsx`, `src/components/HUD.tsx`, `src/components/TitleOverlay.tsx`.

### `artifacts/api-server` — API Server
Express 5 backend served at `/api`. Currently has only a health check endpoint (`/api/healthz`). The game doesn't require a backend (all game state is client-side).

### `artifacts/mockup-sandbox` — Canvas/Mockup Sandbox
Design prototyping sandbox served at `/__mockup`.
