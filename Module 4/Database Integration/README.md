# Database Integration Assignment

Replace the in-memory repository implementation with PostgreSQL through Prisma. The starter uses an asynchronous repository contract so services and controllers remain stable during the swap.

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy the environment file and fill in your PostgreSQL credentials
cp .env.example .env
# Edit .env and set DATABASE_URL to your local Postgres connection string

# 3. Apply the migration (creates tables in your database)
npx prisma migrate deploy

# 4. Generate the Prisma Client
npm run prisma:generate

# 5. (Optional) Seed demo data
npm run prisma:seed

# 6. Start the API
npm start
```

## Environment configuration

Copy `.env.example` to `.env` and set `DATABASE_URL` to a valid PostgreSQL connection string:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?schema=public"
PORT=3000
```

> [!CAUTION]
> Never commit `.env` or any file containing real credentials. Only `.env.example` is committed.

## Prisma commands

| Command | Description |
|---------|-------------|
| `npm run prisma:generate` | Regenerate the Prisma Client from `schema.prisma` |
| `npm run prisma:migrate` | Create and apply a new migration (dev only) |
| `npx prisma migrate deploy` | Apply committed migrations (CI / production) |
| `npm run prisma:seed` | Seed demo data (safe to rerun – uses upsert) |
| `npm run prisma:format` | Format `schema.prisma` |
| `npm run prisma:validate` | Validate `schema.prisma` |

## Architecture

```
Route → Controller → Service → Repository → Prisma → PostgreSQL
```

- **Controllers** handle HTTP, call services, map null/false to 404/204.
- **Services** own domain rules (validation, business logic).
- **Repositories** own all Prisma calls; nothing above them imports `@prisma/client`.
- **`src/db/prisma.js`** — the single shared `PrismaClient` singleton for the process.

## Schema

The schema defines these models with full relational constraints:

| Model | Purpose |
|-------|---------|
| `User` | Platform member |
| `Post` | Content authored by a user |
| `Comment` | Reply attached to a post |
| `Vote` | Up/down vote by a user on a post (unique per user–post pair) |
| `Follow` | Directed follow relationship between users (unique per follower–following pair) |
| `Tag` | Content label (unique name) |
| `PostTag` | Many-to-many join between posts and tags |

## Reset and reseed

To tear down and recreate the schema locally:

```bash
# Drop and recreate the schema, then apply migrations (dev only)
npx prisma migrate reset

# Reseed demo data
npm run prisma:seed
```

`prisma migrate reset` is destructive — only use it on a local development database.

## Notes

- `.env` is intentionally ignored and should never be committed.
- The repository layer sits behind the service/controller API contract — route behavior is unchanged.
- All Prisma error codes are translated to application-level errors inside the repository; services and controllers never see Prisma internals.
