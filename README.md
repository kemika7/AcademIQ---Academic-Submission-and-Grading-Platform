# AcademIQ

A full-stack academic submission and grading platform for students, instructors, and admins. 

Instructors post project assignments, students submit work (individually or as a group, decided per-project), and instructors grade with a rubric. Optional AI analyses run on the report file and GitHub repository to assist grading.

---

## Tech Stack

**Backend** — Python 3.12, Django 5, Django REST Framework, SimpleJWT, SQLite, Celery + Redis, Gunicorn

**Frontend** — Next.js 14 (App Router), TypeScript, TanStack Query, Tailwind CSS, shadcn/ui, Recharts, Axios

**Infra** — Docker Compose (`backend`, `worker`, `beat`, `redis`, `frontend`)

---

## Roles

- **Student** — enrols in courses, picks individual-or-group per project, submits work
- **Instructor** — owns courses, posts projects, grades submissions with rubrics
- **Admin** — full system control: courses, projects, users, groups, analytics

---

## Quick Start

Prerequisites: Docker Desktop (or Docker Engine + Compose) and ~2 GB free disk.

```bash
git clone <repo-url>
cd prg400-adv-python

# Build and start all services
docker compose up -d --build

# After ~30s, run migrations and seed data
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_courses
docker compose exec backend python manage.py createsuperuser
```

Then open:

- **App** — http://localhost:3000
- **API** — http://localhost:8000/api/
- **Django admin** — http://localhost:8000/admin/

---

## Project Structure

```
prg400-adv-python/
├── backend/
│   ├── academiq/        # Django project (settings, urls, celery)
│   ├── accounts/        # User model, JWT auth, admin user CRUD
│   ├── projects/        # Course, Project, Group, ProjectParticipation
│   ├── submissions/     # Submission model + views
│   ├── reviews/         # Rubric, Grade, PeerReview
│   ├── ai_services/     # Celery tasks: analyze_report, analyze_github
│   ├── core/            # Activity feed + permissions
│   └── Dockerfile
├── frontend/
│   ├── app/             # Next.js App Router pages (auth, marketing, app)
│   ├── components/      # UI, layout, shared components
│   ├── lib/             # API client + session helpers
│   └── Dockerfile
└── docker-compose.yml
```

---

## Common Commands

```bash
docker compose restart backend                          # Restart a service
docker compose logs -f backend                          # Tail logs
docker compose exec backend python manage.py shell     # Django shell
docker compose exec frontend npm install <pkg>         # Add a frontend dep

# Reset the database (destructive)
docker compose exec backend rm -f db.sqlite3
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_courses
```

---

## Configuration

`backend/.env` and `frontend/.env.local` hold local config (both gitignored). Defaults work for dev without setting anything.

Key variables:

- `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`
- `CELERY_BROKER_URL` (default `redis://redis:6379/0`)
- `OPENAI_API_KEY` — only needed for AI analysis features
- `NEXT_PUBLIC_API_URL` — frontend → backend URL (default `http://localhost:8000/api`)

---

## Test Accounts (seeded)

| Email | Password | Role |
|---|---|---|
| `kings@admin.com` | `pass1234` | admin (superuser) |
| `inst@a.com` | `pass1234` | instructor |
| `alice@a.com` | `pass1234` | student |
| `bob@a.com` | `pass1234` | student |

Seeded courses: **PRG400**, **WEB300**, **DAT250**, **SEC310**.

---

## Documentation

For full details — architecture, data model, API reference, role permissions, key flows, AI analysis, and troubleshooting — see [`DOCUMENTATION.md`](./DOCUMENTATION.md).

The original PRG400 assignment brief (SOLID, 12-Factor, evaluation rubric) is preserved in the course materials.
# AcademIQ---Academic-Submission-and-Grading-Platform
# AcademIQ---Academic-Submission-and-Grading-Platform
# AcademIQ---Academic-Submission-and-Grading-Platform
