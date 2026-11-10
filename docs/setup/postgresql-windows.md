# Installing PostgreSQL + PostGIS on Windows

Astera Watch uses a **local** PostgreSQL database with the PostGIS extension.
No Docker is used.

**Team-tested versions:** PostgreSQL **18.6** + PostGIS **3.7.0** (EDB installer +
Stack Builder "PostGIS Bundle 3.7.0 for PostgreSQL x64 18").

> Satellite files (HDF5, GeoTIFF) are **not** stored in the database. They live
> in `data/`. The database stores metadata, footprints and file references only.

## 1. Download PostgreSQL

1. Go to <https://www.postgresql.org/download/windows/> and open the
   **EDB installer** link.
2. Download **PostgreSQL 18.x** for Windows x86-64 (team-tested: 18.6).

## 2. Run the installer

| Installer screen | What to choose |
|---|---|
| Installation directory | Default (`C:\Program Files\PostgreSQL\18`) |
| Components | PostgreSQL Server, pgAdmin 4, **Stack Builder**, Command Line Tools: all ticked |
| Data directory | Default |
| Password | A strong password for the `postgres` **superuser**. Store it in a password manager. Do not share it in chat or commit it. |
| Port | `5432` (default) |
| Locale | Default |

When it finishes, leave **"Launch Stack Builder at exit"** ticked.

## 3. Install PostGIS with Stack Builder

1. In Stack Builder, select **PostgreSQL 18 on port 5432** and click **Next**.
2. Expand **Spatial Extensions** and tick the **PostGIS 3.7 Bundle for PostgreSQL 18**.
3. Click through the download. When the PostGIS installer opens:
   - Accept the license.
   - Components: **PostGIS** is enough. You can untick "Create spatial database".
   - Accept the defaults for the remaining questions.

> **Note: the PostGIS installer sets machine-wide environment variables**
> (`GDAL_DATA`, `PROJ_LIB`, `POSTGIS_GDAL_ENABLED_DRIVERS`,
> `POSTGIS_ENABLE_OUTDB_RASTERS`). **Leave them as they are.** PostGIS raster
> functions use them. They don't affect our Python code as long as it always
> runs through the Conda env (`conda run -n astera ...` or an activated
> `astera` terminal), which sets its own GDAL/PROJ paths.
> See [conda-environment.md](conda-environment.md).

## 4. Add the command-line tools to PATH (optional but recommended)

The installer does **not** add `psql` to PATH. Without it, call it with the full
path: `& "C:\Program Files\PostgreSQL\18\bin\psql.exe"`.

To use plain `psql`, add `C:\Program Files\PostgreSQL\18\bin` to your **user** PATH:
Start → "Edit environment variables for your account" → `Path` → New.
Open a **new** terminal afterwards.

Check:

```powershell
psql --version
Get-Service postgresql*
```

The service `postgresql-x64-18` should show **Running**.

## 5. Choose the `astera` password: English letters and digits ONLY

> ⚠️ **The `astera` password must contain only English letters (A–Z, a–z) and digits (0–9).**
> Make it long instead of complex, for example 20+ characters.
>
> - **No non-English characters** (Arabic or any other script, accented letters).
>   On Windows, `psql`'s hidden password prompt and Python can encode them
>   differently (keyboard layout / console code page), so the stored password never
>   matches `.env`. This happened during our own setup.
> - **No symbols** (`@ : / # ? % + &` …). They have special meaning inside the
>   `DATABASE_URL` and would need URL-encoding.
> - **Switch the keyboard to English before typing** at the hidden prompt. You
>   can't see what you type there.

## 6. Create the role, the databases and PostGIS

This uses the project script [`create_databases.sql`](create_databases.sql), which:
- creates the role `astera` with **no** superuser / createdb / createrole / replication / bypassrls rights,
- asks for the `astera` password at a **hidden prompt** (never stored in files or history),
- creates `astera_watch` (app) and `astera_watch_test` (automated tests only), both owned by `astera`,
- enables PostGIS in both,
- **stops on the first error** and **never drops or overwrites** anything.

Run all commands from the project root in PowerShell:

```powershell
cd <path-to>\astera-wildfire-platform
```

**6a. Preflight (read-only).** It must print `(0 rows)`:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -d postgres `
  -c "SELECT 'role' AS kind, rolname AS name FROM pg_roles WHERE rolname = 'astera' UNION ALL SELECT 'database', datname FROM pg_database WHERE datname IN ('astera_watch','astera_watch_test');"
```

If any row appears, **stop** and ask the team. Do not drop or reset anything on your own.

**6b. Create.** You'll be asked for the `postgres` password, then the new
`astera` password twice (letters and digits only, see step 5):

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -f docs/setup/create_databases.sql
"psql exit code: $LASTEXITCODE"
```

- Exit code `0` and `[OK] 8/8 DONE` means success.
- Exit code `3` means it stopped at an error. The last `[OK]` line shows what was
  completed. Nothing is rolled back or dropped automatically, so ask the team before retrying.

> Only the `postgres` superuser can create the PostGIS extension, which is why
> this step runs as `postgres` and not as the application user.

## 7. Configure the project (`.env`)

Create `.env` from the template **without overwriting an existing one**:

```powershell
if (Test-Path .env) { "STOP: .env already exists - NOT overwritten" } else { Copy-Item .env.example .env -ErrorAction Stop; "Created .env from .env.example" }
notepad .env
```

(A plain `Copy-Item` would silently overwrite an existing `.env`.)

Replace `CHANGE_ME` with the `astera` password, **as-is with no encoding**, in **both** lines:

```
DATABASE_URL=postgresql+psycopg://astera:<password>@localhost:5432/astera_watch
TEST_DATABASE_URL=postgresql+psycopg://astera:<password>@localhost:5432/astera_watch_test
```

`.env` is in `.gitignore` and must **never** be committed or shared.

## 8. Verify (read-only)

```powershell
conda run -n astera python docs/setup/verify_db.py
```

It must end with `RESULT: PASS`. The script runs in a read-only database session,
creates nothing, and never prints passwords, URLs or raw error messages.

## Troubleshooting

| Problem | Fix |
|---|---|
| `psql` not recognized | Use the full path `C:\Program Files\PostgreSQL\18\bin\psql.exe`, or set PATH (step 4) and reopen the terminal |
| `could not connect ... port 5432` | Start the service: `Start-Service postgresql-x64-18` (admin PowerShell) |
| `extension "postgis" is not available` | PostGIS bundle not installed for this PostgreSQL version (step 3) |
| `permission denied to create extension` | Run `CREATE EXTENSION` as `postgres`, not `astera` |
| `verify_db.py`: `FAIL connect (OperationalError)` and the server log says `password authentication failed for user "astera"` | The password in `.env` doesn't match the role. Check that both `.env` lines are complete (`...@localhost:5432/<db>`) and the password has **only English letters and digits** (step 5). If it has other characters, have the `postgres` admin set a new letters-and-digits password: `& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -d postgres -c "\password astera"` (with an English keyboard), then update both `.env` lines. |
| `verify_db.py`: `FAIL ... is a valid URL (ValueError)` | That `.env` line is malformed or cut off. Compare it with the template in `.env.example`. |
| Server log location (for the real reason behind a failed login) | `C:\Program Files\PostgreSQL\18\data\log\` (newest file). Look for `FATAL` and the `DETAIL` line under it. |
| GDAL/PROJ errors in Python (e.g. `proj.db` version mismatch) | Python was started outside the Conda env and picked up PostGIS's `GDAL_DATA`/`PROJ_LIB`. Run it with `conda run -n astera python ...` or from an activated `astera` terminal. Don't delete the PostGIS variables. |
