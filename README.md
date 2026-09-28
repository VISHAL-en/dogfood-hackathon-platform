# Arbiter

Arbiter is an open-source, self-hostable platform for hackathon submissions, judging, normalization, and results. Built for DOGFOOD 2026 with complete offline resilience and zero external cloud dependencies.

---

## Key Capabilities

- **Zero Cloud Dependencies**: Runs entirely offline using an embedded SQLite database (`better-sqlite3`) in WAL mode with foreign key integrity. No Supabase, Firebase, Auth0, or third-party APIs required.
- **Server-Side Security & RBAC**: Real roles (`participant`, `judge`, `organizer`, `admin`) enforced by backend Express middleware with scrypt password hashing and SHA-256 session token hashing.
- **T1 Core Foundation**: Event lifecycle management, tracks, prizes, team creation, invitation links, project drafts, deadline enforcement, and public gallery.
- **T2 Judging & Score Isolation**: Configurable weighted rubrics, deterministic judge assignment, strict backend judge isolation, aggregate progress tracking, and CSV exports with formula injection sanitization.
- **T2.5 Cross-Judge Normalization**: Deterministic $z$-score normalization with zero-variance fallbacks, immutable run preservation, and verifiable canonical SHA-256 audit proofs.
- **T3 Community Voting & Anti-Abuse**: Randomized ballots to eliminate presentation bias, duplicate vote prevention, persistent token-bucket rate limiting, moderated community comments, and strict public results masking prior to organizer publication.

---

## Technology Stack

- **Backend**: Node.js, Express, TypeScript, `better-sqlite3` (WAL mode)
- **Frontend**: React 18, TypeScript, Vite, Vanilla CSS (Cupertino / macOS desktop visual system)
- **Testing**: Node.js native test runner (`node:test`, `tsx`)
- **Acceptance Checker**: Python 3 standard library (`tomllib`, `urllib.request`)

---

## Quickstart & Local Setup

### 1. Prerequisites
- Node.js (v20+ or v22+)
- npm
- Python 3.11+ (for running the acceptance checker)

### 2. Installation
```bash
git clone <repo-url>
cd "hackathon website - dogfood"
npm install
```

### 3. Build & Run Application
```bash
# Build production bundles (frontend & backend)
npm run build

# Start the development server (runs backend on port 3000, serving frontend from dist/public)
npm run dev
```

The application is accessible at `http://localhost:3000`.

---

## Running Automated Validation

```bash
# Run the 206 automated test cases
npm test

# Run TypeScript lint and typecheck
npm run lint

# Build production bundle
npm run build

# Run the official DOGFOOD acceptance checker
python3 run.py .dogfood.toml > acceptance-report.txt
```

---

## Realistic End-to-End Demo Flow

Below is the verified end-to-end workflow demonstrating the platform's core operational flow:

### 1. Seed / Create Event
When first launched, the database seeds default events (including `event_dogfood_2026` with tracks and prizes) or an organizer can create a new event via `POST /events`.

### 2. Register Participant Account
A new participant registers via `POST /auth/register`:
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","name":"Alice Hacker","password":"Password123!"}'
```
*Note: Public registration strictly creates accounts with the `participant` role.*

### 3. Create & Join Team
The participant creates a team for the open hackathon event via `POST /events/event_dogfood_2026/teams`:
```bash
curl -X POST http://localhost:3000/events/event_dogfood_2026/teams \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Quantum Builders"}'
```
The creator becomes captain and can invite teammates via `POST /teams/<teamId>/invitations`.

### 4. Create Project Submission Draft
The captain creates a draft submission:
```bash
curl -X POST http://localhost:3000/events/event_dogfood_2026/teams/<teamId>/submission \
  -H "Authorization: Bearer <captain-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Autonomous Mesh Engine",
    "shortDescription": "Offline P2P mesh network for edge agents.",
    "description": "Full architectural description and evaluation.",
    "trackId": "track_infra_systems",
    "repoUrl": "https://github.com/quantum/mesh-engine"
  }'
```
*Draft submissions remain completely private and hidden from the public gallery.*

### 5. Finalize Submission (Enforcing Server-Side Deadline)
Before the event deadline, the captain finalizes the submission:
```bash
curl -X POST http://localhost:3000/submissions/<submissionId>/submit \
  -H "Authorization: Bearer <captain-token>"
```
The backend verifies the event deadline against the authoritative server UTC clock, timestamps `submitted_at`, and publishes the project to `GET /gallery`.

### 6. Assign Judge to Project
An organizer configures the rubric and assigns a judge:
```bash
curl -X POST http://localhost:3000/events/event_dogfood_2026/judging/assignments \
  -H "Authorization: Bearer dogfood_token_organizer" \
  -H "Content-Type: application/json" \
  -d '{"judgeId":"usr_judge_a_001","submissionId":"<submissionId>"}'
```

### 7. Judge Project (Evaluation & Score Submission)
Judge Alice evaluates the project using the active weighted rubric:
```bash
curl -X PUT http://localhost:3000/judge/assignments/<assignmentId>/scores \
  -H "Authorization: Bearer dogfood_token_judge_a" \
  -H "Content-Type: application/json" \
  -d '{
    "scores": [
      {"criterionId":"crit_tech_execution","score":28,"comment":"Solid architecture."},
      {"criterionId":"crit_innovation","score":25,"comment":"Novel topology design."}
    ]
  }'
```
*Backend judge isolation ensures Judge Alice can only view and edit her own assignments.*

### 8. Calculate Cross-Judge Normalization
The organizer triggers a normalization run via `POST /events/event_dogfood_2026/judging/normalization`:
```bash
curl -X POST http://localhost:3000/events/event_dogfood_2026/judging/normalization \
  -H "Authorization: Bearer dogfood_token_organizer"
```
The pipeline computes judge $z$-scores, handles zero-variance gracefully, computes aggregate weighted presentation scores (0–100), creates an immutable run, and outputs a canonical cryptographic proof hash. The run can be independently verified via `POST .../verify`.

### 9. Community Voting & Public Results
1. Organizer creates a voting round: `POST /events/event_dogfood_2026/voting`
2. Auto-populates candidates: `POST .../candidates/auto-populate`
3. Opens community voting: `POST .../open`
4. Voters receive server-randomized ballots (`GET .../ballot`) and cast votes (`POST .../votes`)
5. Public results remain masked (`403 Forbidden`) while voting is open or closed
6. Organizer publishes final results: `POST .../publish`
7. Public community leaderboard becomes visible via `GET .../results`

---

## Security Architecture Summary

- **Authentication**: Passwords hashed with Node.js crypto `scrypt`. Session tokens are cryptographically random and stored exclusively as SHA-256 hashes in SQLite.
- **Cookies**: Browser voter sessions and auth tokens utilize secure HttpOnly cookies with `SameSite=Lax`.
- **Judge Score Isolation**: Peer scores (`/judge/scores/peer`) strictly reject cross-judge inspection. Judges cannot read or manipulate scores belonging to other judges.
- **CSV Injection Protection**: All string fields in CSV exports (`/exports/scores.csv`) starting with formula characters (`=`, `+`, `-`, `@`) are escaped.
- **Rate Limiting**: Community votes and comments are bounded by a SQLite-backed sliding window rate limiter (30 votes/10m, 10 comments/10m).

---

## Seed Test Identities

| Role | Display Name | Email | Password | Seed Bearer Token |
| :--- | :--- | :--- | :--- | :--- |
| **Organizer** | Lead Organizer | `organizer@dogfood.local` | `OrganizerPassword123!` | `dogfood_token_organizer` |
| **Judge** | Judge Alice | `judge_a@dogfood.local` | `JudgeAPassword123!` | `dogfood_token_judge_a` |
| **Judge** | Judge Bob | `judge_b@dogfood.local` | `JudgeBPassword123!` | `dogfood_token_judge_b` |
| **Participant** | Pat Participant | `participant@dogfood.local` | `ParticipantPassword123!` | `dogfood_token_participant` |
| **Admin** | Platform Administrator | `admin@dogfood.local` | `AdminPassword123!` | `dogfood_token_admin` |

---

## Deployment & Docker Notes

A multi-stage `Dockerfile` and `docker-compose.yml` are included in the repository root for self-hosted container deployment:
```bash
docker compose up --build
```
*(Note: Runtime Docker validation requires a host environment with Docker Engine installed. In environments where Docker CLI is not installed, the platform runs natively using Node.js and SQLite).*

---

## License

This project is licensed under the terms of the [MIT License](LICENSE).
