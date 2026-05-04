# AcademIQ — Project Documentation

A full-stack academic submission and grading platform for students, instructors, and admins. Built for PRG400 (Advanced Python).

---

## 1. Overview

AcademIQ lets a course instructor post project assignments, students submit work (individually or as a group, decided per-project), and instructors grade with a rubric. AI analyses run on the report file and GitHub repo to assist grading.

**Three roles:**
- **Student** — enrols in courses, picks per-project mode (individual or group), submits work.
- **Instructor** — owns courses, posts projects, sees participants, grades submissions.
- **Admin** — full system control: every course, every project, every user, every group.

---

## 2. Architecture

```
┌─────────────────┐     HTTP/JSON      ┌──────────────────┐
│   Next.js 14    │ ◄──────────────►   │  Django + DRF    │
│   (frontend)    │                    │   (backend)      │
│   :3000         │                    │   :8000          │
└─────────────────┘                    └──────────────────┘
                                              │
                                              ├── SQLite (db.sqlite3)
                                              ├── Redis (Celery broker) :6379
                                              └── Celery worker + beat
                                                     │
                                                     └── AI analysis jobs
```

Services are orchestrated with `docker-compose`. The frontend hot-reloads against the running backend; the backend mounts source as a volume so Python edits reload via gunicorn.

---

## 3. Tech Stack

### Backend
- **Python 3.12** + **Django 5** + **Django REST Framework**
- **SimpleJWT** for auth (access + refresh tokens)
- **SQLite** (file-based, simple for dev)
- **Celery + Redis** for async AI analysis
- **Gunicorn** in container

### Frontend
- **Next.js 14** (App Router, client-side React)
- **TypeScript**
- **TanStack Query** for server state
- **Tailwind CSS** + **shadcn/ui** for components
- **Recharts** for analytics dashboards
- **Axios** for HTTP

### Infra
- **Docker Compose** with services: `backend`, `worker`, `beat`, `redis`, `frontend`
- Anonymous volume on `frontend:/app/node_modules` (mounts host code but preserves container's installed deps)

---

## 4. Project Structure

```
prg400-adv-python/
├── backend/
│   ├── academiq/                # Django project (settings, urls, celery)
│   ├── accounts/                # User model, JWT views, admin user CRUD
│   ├── projects/                # Course, Project, Group, GroupMembership, ProjectParticipation
│   ├── submissions/             # Submission model + views (in-place updates)
│   ├── reviews/                 # Rubric, Grade, PeerReview
│   ├── ai_services/             # Celery tasks: analyze_report, analyze_github
│   ├── core/                    # Activity model + emit() helper, permissions
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── (auth)/              # /login, /register
│   │   ├── (marketing)/         # public landing page
│   │   └── (app)/               # authenticated app pages
│   │       ├── dashboard/       # role-aware home
│   │       ├── courses/         # course list + detail
│   │       ├── projects/[id]/   # project detail + submissions/grades/ai-feedback/github tabs
│   │       ├── submit/[id]/     # 3-step submission form
│   │       ├── groups/          # student groups (course→project picker)
│   │       ├── inbox/           # instructor submission inbox
│   │       ├── rubrics/         # rubric management
│   │       └── admin/           # /admin (analytics), /admin/users, /admin/projects
│   ├── components/              # ui, shared, layout, projects, courses, etc.
│   ├── lib/api/                 # API client (axios + typed wrappers)
│   ├── lib/auth/                # session helpers (JWT in localStorage)
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── README.md                    # assignment brief
└── DOCUMENTATION.md             # this file
```

---

## 5. Setup & Running

### Prerequisites
- Docker Desktop (Mac/Windows) or Docker Engine + Compose
- ~2 GB free disk for images

### First run

```bash
git clone <repo>
cd prg400-adv-python

# Build images and start all services
docker compose up -d --build

# Wait ~30s for services to come up. Then:
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_courses     # adds 4 default courses
docker compose exec backend python manage.py createsuperuser  # for /admin/ Django console
```

Visit:
- **App:** http://localhost:3000
- **API:** http://localhost:8000/api/
- **Django admin:** http://localhost:8000/admin/

### Common commands

```bash
# Restart one service
docker compose restart backend

# Tail logs
docker compose logs -f backend

# Run a Django shell
docker compose exec backend python manage.py shell

# Install a new frontend dep (the container has its own node_modules volume)
docker compose exec frontend npm install <pkg>
docker compose restart frontend

# Reset the database (destructive)
docker compose exec backend rm -f db.sqlite3
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_courses
```

### Environment

`backend/.env` and `frontend/.env.local` hold secrets and config. Both are gitignored. Defaults work for local dev without setting anything.

Key vars:
- `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`
- `CELERY_BROKER_URL` (defaults to `redis://redis:6379/0`)
- `OPENAI_API_KEY` — only needed for AI analysis features
- `NEXT_PUBLIC_API_URL` — frontend → backend URL (default `http://localhost:8000/api`)

---

## 6. Data Model

### Core entities

```
User (accounts.User)
├── role: student | instructor | admin
├── email (unique), full_name, avatar, github_username
└── flags: is_active, is_staff, is_superuser

Course (projects.Course)
├── code (e.g. "PRG400") — unique
├── title, term, description
├── course_code — student invite code
├── instructors → User[] (M2M)
└── students → User[] (M2M)

Project (projects.Project)
├── course → Course
├── title, description, deadline
├── status: draft | active | submitted | graded | archived
└── created_by → User

Group (projects.Group)            ← project-scoped, NOT course-scoped
├── project → Project
├── name, group_code (invite code)
└── created_by → User

GroupMembership
├── group → Group
├── user → User
└── role: leader | member

ProjectParticipation              ← per (student, project) work mode
├── project → Project
├── user → User
├── mode: individual | group
└── group → Group (nullable; required when mode='group')

Submission (submissions.Submission)
├── project → Project
├── version (always 1 in current model — in-place updates)
├── submitted_by → User
├── group → Group (nullable; group submission)
├── report_file, github_url, notes
└── submitted_at

Activity (core.Activity)
├── project → Project
├── actor → User
├── verb: created_project | submitted | commented | graded |
│        created_group | joined_group | chose_individual
├── target_type, target_id (generic)
└── metadata (JSON)

Rubric / Grade / PeerReview (reviews.*)
├── Rubric: course-scoped, with criteria + weights + max scores
├── Grade: per (submission, student), with feedback + per-criterion scores
└── PeerReview: student-on-student rating + comment
```

### Important model rules

- **Groups belong to a single project.** A student may be in different groups across different projects in the same course.
- **`ProjectParticipation` gates access.** A student must pick individual-or-group on each project before they can submit.
- **Mode is switchable until first submission.** Once a `Submission` exists, the participation locks.
- **Submissions update in place.** Resubmitting overwrites the same row instead of creating a v2/v3/...
- **Group invite codes are globally unique** (so `join-by-code` works without specifying a project).

---

## 7. Roles & Permissions

| Capability | Student | Instructor | Admin |
|---|---|---|---|
| Enroll in course | ✓ | — | — |
| Drop self from course | — | — | — |
| See enrolled courses | ✓ | — | — |
| Create course | — | ✓ | ✓ |
| Delete course | — | own only | ✓ |
| Add/remove students from course | — | ✓ | ✓ |
| Add/remove instructors from course | — | ✓ | ✓ |
| Create project in course | — | ✓ (taught) | ✓ |
| Delete project | — | own course | ✓ |
| Pick mode for project | ✓ | — | — |
| Create group in project | ✓ | — | — |
| Delete group | leader (no submission) | own course | ✓ |
| Submit to project | ✓ | — | — |
| View all submissions to a project | own only | ✓ | ✓ |
| Grade submission | — | ✓ | ✓ |
| See AI Feedback tab | — | ✓ | ✓ |
| Access `/admin/*` pages | — | — | ✓ |
| Manage users | — | — | ✓ |

---

## 8. API Endpoints

All endpoints under `/api/` and require JWT auth (Bearer header) unless noted.

### Auth (`accounts.urls`)
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register/` | public; creates a `student` by default |
| POST | `/auth/login/` | returns `{access, refresh}` |
| POST | `/auth/refresh/` | refresh access token |
| GET  | `/auth/me/` | current user profile |
| GET  | `/auth/admin/users/` | admin only — list/CRUD users |
| GET  | `/auth/admin/stats/` | admin counts |
| GET  | `/auth/admin/analytics/` | admin dashboard data; query params `range`, `course` |

### Courses (`projects.urls` — registered on `/courses`)
| Method | Path | Notes |
|---|---|---|
| GET    | `/courses/` | list all courses |
| GET    | `/courses/enrolled/` | student's enrolled courses |
| POST   | `/courses/` | instructor/admin |
| DELETE | `/courses/{id}/` | own course or admin |
| GET    | `/courses/{id}/students/` | instructor/admin |
| POST   | `/courses/{id}/add-students/` | by `student_ids` or `emails` |
| POST   | `/courses/{id}/remove-student/` | by `student_id` |
| POST   | `/courses/{id}/add-instructors/` | by `instructor_ids` or `emails` |
| POST   | `/courses/{id}/remove-instructor/` | by `instructor_id` (refuses to remove last) |
| POST   | `/courses/{id}/self-enroll/` | student joins |

### Projects
| Method | Path | Notes |
|---|---|---|
| GET    | `/projects/` | scoped: students see enrolled course's projects, instructors see taught, admin sees all. Filter by `?course=N` |
| GET    | `/projects/{id}/` | detail |
| POST   | `/projects/` | instructor/admin (course they teach) |
| DELETE | `/projects/{id}/` | instructor of course or admin |
| GET    | `/projects/{id}/participation/` | student's own mode/group |
| POST   | `/projects/{id}/participation/` | `{mode:'individual'}` \| `{mode:'group', group_id}` \| `{mode:'group', create:{name}}` |
| DELETE | `/projects/{id}/participation/` | clear (only before first submission) |
| GET    | `/projects/{id}/participants/` | groups + individuals (instructor view) |
| GET    | `/projects/{id}/activity/` | activity feed |
| GET/POST | `/projects/{id}/comments/` | discussion |

### Groups
| Method | Path | Notes |
|---|---|---|
| GET    | `/groups/?project={id}` | groups in a project (or all, instructor/admin) |
| POST   | `/groups/` | body: `{project, name}` — creator becomes leader and gets group participation |
| DELETE | `/groups/{id}/` | leader, course instructor, or admin |
| POST   | `/groups/{id}/join/` | by `group_code` (or open if enrolled) |
| POST   | `/groups/join-by-code/` | by `group_code` only |
| GET    | `/groups/{id}/members/` | list members |
| POST   | `/groups/{id}/members/` | leader adds by `user_id` |

### Submissions
| Method | Path | Notes |
|---|---|---|
| GET    | `/projects/{id}/submissions/` | own (student) or all (instructor) |
| POST   | `/projects/{id}/submissions/` | multipart: `report_file`, `github_url`, `notes`. **Updates in place** if a submission exists. Requires `ProjectParticipation`. |
| PATCH  | `/projects/{id}/submissions/{sid}/` | edit `github_url` and `notes` only |
| POST   | `/projects/{id}/submissions/{sid}/reanalyze/` | re-dispatch AI tasks |
| GET    | `/inbox/` | instructor inbox of submissions |
| GET    | `/feed/` | role-aware activity feed |

### Reviews
| Method | Path | Notes |
|---|---|---|
| GET    | `/rubrics/` | filter by `course`, `is_active` |
| POST   | `/rubrics/` | with nested `criteria` |
| GET    | `/submissions/{id}/grades/` | per-student grades |
| POST   | `/submissions/{id}/grades/` | `{rubric, student, scores[], feedback}` |
| GET    | `/submissions/{id}/peer-reviews/` |  |
| POST   | `/submissions/{id}/peer-reviews/` | `{rating 1–5, comment}` |

### AI
| Method | Path | Notes |
|---|---|---|
| GET    | `/ai/analyses/?submission={id}` | report analyses |
| GET    | `/ai/github/?submission={id}` | GitHub analysis |

---

## 9. Frontend Pages by Role

### Student
| Page | What it does |
|---|---|
| `/dashboard` | inbox of activity, enrolled courses overview |
| `/courses` | all courses (with Enroll button if not enrolled) |
| `/courses/[id]` | course detail with project list |
| `/projects/[id]` | project overview. **If no participation, shows mode chooser (Individual / Create group / Join group with code).** Otherwise shows description + own submission |
| `/projects/[id]/submissions` | their own submission(s) |
| `/projects/[id]/grades` | their grade once posted |
| `/submit/[id]` | 3-step submission form (report → GitHub → review). Inherits mode from participation. Updates in place. |
| `/groups` | course → project drill-down, with create-new-group dialog per project + join-by-code |
| `/groups/[id]` | group detail (members, parent project) |

### Instructor
| Page | What it does |
|---|---|
| `/dashboard` | activity inbox + courses taught |
| `/inbox` | all submissions awaiting grading |
| `/courses` | all courses |
| `/courses/[id]` | course detail with: Create project, Add students, **Manage instructors**, **Manage students**, Delete course |
| `/projects/[id]` | overview + Project participants section (groups with members + individuals) — each group has a delete icon |
| `/projects/[id]/submissions` | every submission for this project, filterable by submitter |
| `/projects/[id]/ai-feedback` | per-submission AI summary, weaknesses, suggestions; manual reanalyze |
| `/projects/[id]/github` | GitHub analysis (commits, PRs, quality score) |
| `/projects/[id]/grades` | 2-step rubric grading (work scores, then per-member feedback for groups) |
| `/groups` | course → project picker; visibility into all groups in taught courses |
| `/rubrics` | rubric CRUD per course |

### Admin
Includes all instructor pages (filtered to *all* courses, not just taught), plus:
| Page | What it does |
|---|---|
| `/admin` | analytics dashboard: courses count, project status pie, submissions over time, grade distribution, top groups, instructor activity, AI insight |
| `/admin/users` | full user CRUD with role tabs (students/instructors/admins), search, password reset |
| `/admin/projects` | every project across every course; search + filter + delete |

---

## 10. Key Flows

### A. Student goes from "just enrolled" to "submitted"

```
1. Student visits /courses, clicks Enroll on PRG400.
2. Course detail shows project list. Click "Final Project".
3. /projects/N → no ProjectParticipation → MODE CHOOSER:
     • Individual                — clicks → POST /projects/N/participation/ {mode:'individual'}
     • Create group              — enter name → POST {mode:'group', create:{name}}
                                   → creates Group + GroupMembership(leader) + Participation
     • Join group with code      — paste code → POST /groups/join-by-code/
                                   → creates GroupMembership + Participation
4. Project detail unlocks. They click "New submission".
5. /submit/N — three steps: upload report → GitHub URL → review.
   POST /projects/N/submissions/ → create_submission() finds (project, user) or
   (project, group) and writes/updates in place. Version stays 1.
6. Async Celery tasks fire: analyze_report (if file) + analyze_github.
7. Redirect → /projects/N/submissions → student sees their submission.
```

### B. Instructor grades a group's work

```
1. /inbox → click a "submitted" row → /projects/N/submissions
2. Click "Grade" → /projects/N/grades
3. STEP 1 — Grade the work: score each rubric criterion. One score for
   the whole group's work. Live total updates.
4. STEP 2 — Grade the members: for each member, no per-criterion sliders
   (the work scores are reused). Just a personal feedback textarea.
   POST /submissions/{id}/grades/ per member with the same scores + their feedback.
5. project.status → graded once every member has a Grade.
```

### C. Admin manages a course end-to-end

```
1. /admin → see counts and trends.
2. /admin/projects → search and delete any project.
3. /courses/{id} → "Instructors" → add another professor by email.
4. /courses/{id} → "Students" → drop a student from the course.
5. /projects/{id} → see participants → delete a stale group via trash icon.
6. /admin/users → reset a student's password or change their role.
```

---

## 11. Activity Verbs

The project activity feed (`GET /projects/{id}/activity/`) records:

| Verb | Emitted by | Metadata | Rendered as |
|---|---|---|---|
| `created_project` | instructor creating project | — | "created the project" |
| `chose_individual` | student picking individual mode | — | "chose to work individually" |
| `created_group` | student creating group (any path) | `group_name` | "created group X" |
| `joined_group` | student joining via code | `group_name` | "joined group X" |
| `submitted` | student submitting | `version` | "submitted their work" |
| `commented` | anyone posting a comment | — | "commented" |
| `graded` | instructor grading a member | `total`, `student_id` | "graded · 87.5" |

---

## 12. Auth & Session

- Login (`POST /auth/login/`) returns `access` and `refresh` JWTs.
- Frontend stores them in `localStorage` (`access` and `refresh` keys).
- `lib/api/client.ts` adds `Authorization: Bearer <access>` to every request and refreshes on 401.
- `getSessionUser()` returns `{ id, email, full_name, role }` decoded from the access token.
- Logout clears localStorage and redirects to `/login`.

---

## 13. Test Accounts (seeded for local dev)

| Email | Password | Role | Notes |
|---|---|---|---|
| `kings@admin.com` | `pass1234` | admin | superuser/staff — system owner |
| `admin@a.com` | `pass1234` | admin | secondary admin |
| `inst@a.com` | `pass1234` | instructor | teaches all 4 seeded courses |
| `pooja@kings.com` | (set in dev) | instructor | also teaches all 4 |
| `alice@a.com` | `pass1234` | student | |
| `bob@a.com` | `pass1234` | student | |
| `carol@a.com` | `pass1234` | student | |

Seed courses (run via `seed_courses` management command):
- **PRG400** — Advanced Python (2026 Spring)
- **WEB300** — Modern Web Development (2026 Spring)
- **DAT250** — Applied Data Science (2026 Spring)
- **SEC310** — Application Security (2026 Fall)

---

## 14. AI Analysis (optional)

Two Celery tasks run on each submission:

- `analyze_report(submission_id)` — extracts text from the report file (PDF/DOCX/MD) and asks the LLM to summarize, list weaknesses, suggest improvements. Stored in `AIAnalysis`.
- `analyze_github(submission_id)` — clones the repo into `tmpfs:/tmp/repos`, runs static checks, computes a quality score 0–10. Stored in `GitHubAnalysis`.

Without `OPENAI_API_KEY`, the tasks no-op (status stays `pending`). With Redis unavailable they degrade silently.

Instructors see results on the **AI Feedback** tab. Students do not see this tab.

---

## 15. Known Limitations / Notes

- SQLite is single-writer; not for production use. Switch `DATABASES` to Postgres if needed.
- JWT in `localStorage` is convenient but vulnerable to XSS — fine for an academic project.
- `version` field on Submission is preserved at 1; the resubmit flow updates rows in place rather than appending versions.
- Frontend uses Next.js 14 App Router — the version warning in dev (`Next.js (14.2.4) is outdated`) is informational; no upgrade is required for grading.
- The `Frontend container` mounts an anonymous volume on `/app/node_modules` to preserve the image's installed deps. After adding a frontend dep, run `docker compose exec frontend npm install` to install into that volume, then `docker compose restart frontend`.

---

## 16. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 401 on every request | stale JWT for a deleted user | log out, log back in |
| `Module not found: 'recharts'` (or any pkg) | container's `node_modules` missing it | `docker compose exec frontend npm install` then restart |
| `0 courses` in admin analytics | analytics endpoint 500'd | check backend logs; usually a stale `prefetch_related` on a removed field |
| Submission saves but sees no feedback | Celery tasks running async | check `docker compose logs worker`; tasks are best-effort |
| Login fails for seeded user | password hash regenerated | reset via `User.set_password(...)` in `manage.py shell` |

---

## 17. Where to Look in the Code

| Want to change… | Edit… |
|---|---|
| What "Individual" / "Group" labels show on a project | `frontend/app/(app)/projects/[id]/layout.tsx` |
| The mode chooser when student opens a project | `frontend/app/(app)/projects/[id]/page.tsx` (`ModeChooser`) |
| What a successful submit does | `backend/submissions/services.py::create_submission` |
| Activity verbs | `backend/projects/views.py` (emit calls) + `frontend/.../page.tsx::describeActivity` |
| Admin permissions on a viewset | `backend/projects/views.py::ProjectViewSet.get_queryset` |
| Sidebar nav per role | `frontend/components/layout/Sidebar.tsx` |
| Rubric grading flow | `frontend/app/(app)/projects/[id]/grades/page.tsx` |
| Analytics dashboard | `frontend/app/(app)/admin/page.tsx` + `backend/accounts/views.py::admin_analytics` |
