---
description: 'Drizzle ORM + Node SQLite data layer patterns for the Astro app'
applyTo: 'db/**/*.ts,src/lib/*.ts'
---

# Drizzle ORM + Node SQLite Instructions

The app's data lives in a local SQLite database accessed through **Drizzle ORM** over Node.js's built-in `node:sqlite` driver. It is consumed at **build time** from Astro page frontmatter — there is no runtime API server. Schema changes are managed with **drizzle-kit** migrations.

## Layout

- `db/schema.ts` — Drizzle table definitions (`publishers`, `categories`, `games`) and inferred row types. The single source of truth for the schema.
- `db/transforms.ts` — **pure** functions (CSV parsing, description building, de-duplication, deterministic `ratingFromTitle`). No DB access — easy to unit test.
- `db/seed.ts` — idempotent seeding from `db/games.csv` using the transforms.
- `db/migrate.ts` — applies generated migrations.
- `db/migrations/` — generated SQL migrations (do not hand-edit).
- `db/test-helpers.ts` — `createTestDatabase()` returns a migrated in-memory Node SQLite db for tests.
- `src/lib/db.ts` — `createDatabase(url)` / `getDatabase()` build the Drizzle client from `DATABASE_URL` (defaults to the local `tailspin.db` file).
- `src/lib/games.ts` — typed, **injectable-db** data-access helpers used by pages and tests.

## Schema Conventions

- Use `sqliteTable` with explicit column names (`text`, `integer`, `real`).
- Primary keys: `integer('id').primaryKey({ autoIncrement: true })`.
- Mark required columns `.notNull()`; nullable columns (e.g. `starRating`) are left nullable.
- Foreign keys use `.references(() => other.id)`.
- Export inferred types (`typeof table.$inferSelect`) and build app-facing types from them — don't redeclare row shapes by hand.

## Migrations Workflow

1. Edit `schema.ts`.
2. Generate a migration: `npm run db:generate` (drizzle-kit).
3. Apply + seed locally: `npm run db:setup` (`db:migrate` + `db:seed`).
4. Commit both the schema change **and** the generated migration in `db/migrations/`.

> [!IMPORTANT]
> The database must be migrated and seeded **before** `astro build`. The `prebuild`/`predev` npm scripts run `db:setup` automatically; CI relies on this ordering.

## Data-Access Helpers (injectable db)

Helpers take the `db` instance as their first argument so they work both with the real client (in pages) and an in-memory client (in tests):

```ts
import { asc, count, eq } from 'drizzle-orm';
import type { Database } from './db';
import { games } from '../../db/schema';

export async function getAllGameIds(db: Database): Promise<number[]> {
  const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
  return rows.map((r) => r.id);
}
```

- Always `order by` a stable column (title) so static builds are deterministic.
- Map raw rows to the app-facing `Game`/`Publisher`/`Category` types in one place; don't leak Drizzle row shapes into components.
- Keep ordering/lookup logic in `games.ts`, not in pages.

## Exported Function Documentation

Every exported function in `db/` and `src/lib/` must have a TSDoc/JSDoc block that:

- Summarizes the function's purpose and any non-obvious behavior or constraints.
- Includes an `@param` tag for every parameter.
- Includes an `@returns` tag describing the returned value, including important empty or not-found states.
- Explains that an injectable `db` parameter accepts the production database or an in-memory test database.

```ts
/**
 * Returns one game by its database identifier.
 *
 * @param db - Database client supplied by the page or an in-memory test.
 * @param id - Identifier of the game to retrieve.
 * @returns The mapped game, or `null` when the identifier does not exist.
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    // ...
}
```

Comments inside a function should explain why a query, transform, or workaround is necessary. Do not narrate SQL-builder calls or restate a type signature. Update or remove comments in the same change whenever the behavior they describe changes.

## Determinism

Seed-derived values must be reproducible across builds. Derive star ratings from a stable hash of the title (`ratingFromTitle`) — **never** `Math.random()`.

## Testing

Unit-test transforms directly and helpers against `createTestDatabase()`. See [`unit-tests.instructions.md`](unit-tests.instructions.md).

## Node.js requirement

Node.js 22.13 or later is required because the data layer uses the built-in `node:sqlite` module without an experimental flag. Do not introduce third-party SQLite drivers that ship platform-specific binaries.

## Type checking

The data layer (`db/**/*.ts`, `src/lib/*.ts`) is type-checked by `npm run typecheck`, which runs the native **TypeScript 7** compiler (`tsgo`, from `@typescript/native-preview`) against `tsconfig.tsgo.json`. Keep helpers exported with explicit parameter and return types so `tsgo` can verify them. Linting is unaffected — ESLint + `typescript-eslint` still run on the classic `typescript` package.

## TypeScript Formatting

- Use 4 spaces for indentation.
- Use single quotes for strings and terminate statements with semicolons.
- Include trailing commas in multiline arrays, objects, imports, parameters, and calls.
- Keep imports at the top of the module and use `import type` for type-only imports.
- Follow the surrounding code's line-breaking style and keep nested query chains readable.
- Run lint through the `quality-checks` skill. ESLint enforces the machine-checkable baseline; documentation meaning and the remaining formatting conventions require review.
