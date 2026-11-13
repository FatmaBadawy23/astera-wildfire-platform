# Database

Local **PostgreSQL 18 + PostGIS 3.7** on Windows, with no Docker. Windows service: `postgresql-x64-18`, port 5432.

> **Status:** the role and both databases exist and pass verification, but they are **empty**. There are no
> tables, no SQLAlchemy models and no Alembic migrations yet (roadmap Stages 1 and 5).

## What the setup creates

`docs/setup/create_databases.sql` (run once by the `postgres` superuser; full steps in
[postgresql-windows.md](../setup/postgresql-windows.md)):

| Object | Details |
|---|---|
| Role `astera` | Login role with **no** superuser, createdb, createrole, replication or bypassrls rights. Its password is typed at a hidden prompt and never written to a file |
| Database `astera_watch` | Application database, owned by `astera`, UTF-8, PostGIS enabled |
| Database `astera_watch_test` | **Automated tests only**, owned by `astera`, PostGIS enabled |

The script stops on the first error and never drops or overwrites anything.

## Connection settings (no secrets here)

The project root `.env` (created from `.env.example`, **never committed**) holds `DATABASE_URL` and
`TEST_DATABASE_URL`. Rules:

- The `astera` password uses **English letters and digits only**. It goes into the URL as-is, with no URL encoding.
- Never print, log, screenshot or share `.env` or a full `DATABASE_URL`.
- New developers create their **own** local role, password and databases with the script. Nobody shares passwords.

## Verify (read-only)

```powershell
conda run -n astera python docs/setup/verify_db.py
```

This opens read-only sessions to both databases and checks the PostgreSQL version, connected user and database,
least-privilege role, ownership, PostGIS 3.7, EPSG:4326 and EPSG:6933 (equal-area), and an equal-area area test.
It ends with `RESULT: PASS` (27/27).

`psql` is not on PATH by default. Use the full path:
`& "C:\Program Files\PostgreSQL\18\bin\psql.exe"`.

## Planned schema (roadmap Stage 1, not designed yet)

The roadmap lists these entities: fire events, scenes, data sources, analysis jobs, results, change layers and chat
sessions. FIRMS points are stored as `active_fire_point`, **never** as burned area. A users table and authentication
are planned but not designed. Geometry will use PostGIS through GeoAlchemy2. Areas are calculated in an equal-area
projection (EPSG:6933 is available and verified). Satellite files stay on disk; the database keeps metadata,
footprints and file references only.

When the schema is designed, record it here and add Alembic migrations under `backend/app/database/` (the planned
location).
