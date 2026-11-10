-- Astera Watch: create the app role, the main + test databases, and PostGIS.
--
-- Run as the postgres superuser, from the project root:
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -f docs/setup/create_databases.sql
--
-- Safety:
-- - Stops on the FIRST error (ON_ERROR_STOP). psql then exits with code 3.
-- - Never drops, alters or resets anything. Partially created objects are left
--   as they are, to be reviewed by a person.
-- - Each completed step prints an [OK] line; the last [OK] line shows how far it got.
-- - Passwords are typed at a hidden prompt (\password); they never appear in this
--   file, the command line, the output or psql history. The password hash is never read.

\set ON_ERROR_STOP on

-- Step 0: re-check for conflicts (aborts if anything already exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'astera')
     OR EXISTS (SELECT 1 FROM pg_database WHERE datname IN ('astera_watch', 'astera_watch_test')) THEN
    RAISE EXCEPTION 'PREFLIGHT CONFLICT: role astera or a target database already exists. Nothing was created.';
  END IF;
END $$;
\echo '[OK] 0/8 preflight: no conflicts'

CREATE ROLE astera WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
\echo '[OK] 1/8 role astera created (no password yet)'

\echo 'Enter the NEW password for role astera (input hidden, asked twice).'
\echo 'Use ENGLISH LETTERS AND DIGITS ONLY - switch the keyboard to English first.'
\password astera

-- Step 2b: confirm a password is now set.
-- pg_roles.rolpassword is always masked as '********' (never NULL), so the check
-- must use pg_authid (superuser-only). Only IS NOT NULL is evaluated inside the
-- DO block; the hash itself is never selected, returned or printed.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_authid WHERE rolname = 'astera' AND rolpassword IS NOT NULL) THEN
    RAISE EXCEPTION 'PASSWORD CHECK FAILED: role astera has no password set. Stopping.';
  END IF;
END $$;
\echo '[OK] 2/8 password is set for astera (verified, hash not displayed)'

CREATE DATABASE astera_watch OWNER astera ENCODING 'UTF8' TEMPLATE template0;
\echo '[OK] 3/8 database astera_watch created'

CREATE DATABASE astera_watch_test OWNER astera ENCODING 'UTF8' TEMPLATE template0;
\echo '[OK] 4/8 database astera_watch_test created'

\c astera_watch
CREATE EXTENSION IF NOT EXISTS postgis;
\echo '[OK] 5/8 PostGIS enabled in astera_watch'
SELECT PostGIS_Version() AS postgis_in_astera_watch;

\c astera_watch_test
CREATE EXTENSION IF NOT EXISTS postgis;
\echo '[OK] 6/8 PostGIS enabled in astera_watch_test'
SELECT PostGIS_Version() AS postgis_in_astera_watch_test;

\echo '[OK] 7/8 all objects created'
\echo '[OK] 8/8 DONE - next: create .env (step 0.4b), then run docs/setup/verify_db.py'
