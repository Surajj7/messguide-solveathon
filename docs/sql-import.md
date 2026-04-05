# SQL import (PostgreSQL)

The app stores menus in normalized tables (`MenuItem`, `MenuTemplateEntry`, `MenuDateEntry`, `NightMessItem`). For safety, the **HTTP API does not execute arbitrary SQL uploads**.

## Recommended workflow

1. Apply schema: from `server/`, run `npx prisma db push` (or `prisma migrate dev` after migrations).
2. Export UUIDs from your `MenuItem` rows, or insert items first.
3. Run SQL with `psql` or pgAdmin against the same `DATABASE_URL` as in `server/.env`.

### Example `psql` (Windows PowerShell)

```powershell
$env:PGPASSWORD="yourpassword"
psql -h localhost -U postgres -d mess_menu -f docs/sample_menu_inserts.sql
```

Or use the connection string:

```powershell
psql $env:DATABASE_URL -f docs/sample_menu_inserts.sql
```

## Notes

- `MenuItem.name` is **unique** — duplicate names update nutrition on CSV import.
- `MenuDateEntry.menuDate` is date-only; use `DATE '2026-04-04'`.
- `MenuTemplateEntry.dayOfWeek` uses **0 = Sunday … 6 = Saturday** (JavaScript convention).
- For night mess, use `NightMessItem` with `serviceDate` + unique `name`.
