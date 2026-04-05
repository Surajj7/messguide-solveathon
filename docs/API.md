# REST API overview

Base URL: `http://localhost:4000/api` (or proxied via Vite as `/api`).

Auth: `Authorization: Bearer <JWT>` (except `/auth/login`, `/auth/register`).

## Auth

| Method | Path | Roles |
|--------|------|-------|
| POST | `/auth/login` | — |
| POST | `/auth/register` | — |
| GET | `/auth/me` | all |

## Profiles & menu items

| Method | Path | Roles |
|--------|------|-------|
| GET | `/profiles/student` | STUDENT |
| PUT | `/profiles/student` | STUDENT |
| PATCH | `/profiles/menu-item/:id` | MESS_INCHARGE, ADMIN |
| GET | `/menus/day?date=&messType=` | all (messType inferred for students) |
| GET | `/menus/items/:id` | all |
| GET | `/menus/items` | MESS, ADMIN |
| POST | `/menus/date-entry` | MESS, ADMIN |
| POST | `/menus/template-entry` | MESS, ADMIN |
| DELETE | `/menus/date-entry/:id` | MESS, ADMIN |
| DELETE | `/menus/template-entry/:id` | MESS, ADMIN |

## Import

| Method | Path | Roles |
|--------|------|-------|
| POST | `/import/csv` (multipart `file`) | MESS, ADMIN |
| GET | `/import/sql-instructions` | MESS, ADMIN |

## Reviews & complaints

| Method | Path | Roles |
|--------|------|-------|
| POST | `/reviews` | STUDENT |
| GET | `/reviews/mine` | STUDENT |
| GET | `/reviews/report` | MESS, ADMIN |
| POST | `/complaints` | STUDENT |
| GET | `/complaints/report` | MESS, ADMIN |
| PATCH | `/complaints/:id/status` | MESS, ADMIN |

## Suggestions, crowd, leftovers, night mess

| Method | Path | Roles |
|--------|------|-------|
| POST/GET | `/suggestions` | POST: STUDENT, GET: all |
| POST | `/suggestions/:id/upvote` | STUDENT |
| POST | `/crowd` | MESS, ADMIN |
| GET | `/crowd/latest` | all |
| GET | `/crowd/history` | MESS, ADMIN |
| POST | `/leftovers` | MESS, ADMIN |
| GET | `/leftovers/summary` | MESS, ADMIN |
| GET | `/night-mess?date=` | all (fixed catalog + extras; prices INR) |
| POST | `/night-mess/sync-day` | MESS, ADMIN (body: `serviceDate`, `entries[]` with catalog `name`, `availableQty`, optional `remainingQty`) |
| PATCH | `/night-mess/:id/stock` | MESS, ADMIN |
| POST | `/night-mess/item` | MESS, ADMIN |

## Community

| Method | Path | Roles |
|--------|------|-------|
| GET | `/community?q=&tag=` | all |
| POST | `/community` | STUDENT, ADMIN |
| POST | `/community/:id/like` | all |
| POST | `/community/:id/comment` | all |
| GET | `/community/:id/comments` | all |

## Notifications & announcements

| Method | Path | Roles |
|--------|------|-------|
| GET | `/notifications` | all |
| PATCH | `/notifications/:id/read` | all |
| POST | `/notifications/read-all` | all |
| GET/POST | `/announcements` | GET: all, POST: MESS, ADMIN |

## AI & PDF

| Method | Path | Roles |
|--------|------|-------|
| POST | `/ai/chat` | STUDENT, ADMIN |
| POST | `/ai/meal-plan` | STUDENT |
| POST | `/ai/monthly-pdf` | ADMIN |

## Preferences

| Method | Path | Roles |
|--------|------|-------|
| POST | `/preferences` | STUDENT |
| GET | `/preferences/mine` | STUDENT |
| GET | `/preferences/summary` | MESS, ADMIN |

## Admin & users

| Method | Path | Roles |
|--------|------|-------|
| GET | `/admin/overview` | ADMIN |
| GET | `/admin/complaints` | ADMIN |
| GET/POST/PATCH | `/users` | ADMIN |
| POST | `/admin-notify/menu-change` | ADMIN |

## WhatsApp (mock)

| Method | Path | Roles |
|--------|------|-------|
| GET/POST | `/whatsapp/templates` | ADMIN |
| POST | `/whatsapp/send-mock` | ADMIN |
| GET | `/whatsapp/history` | ADMIN |
