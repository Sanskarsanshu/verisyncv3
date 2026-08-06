# AI Face Recognition Attendance System

A full-stack attendance system with **face recognition** and **QR code** scanning, built with React, Node.js, PostgreSQL, MediaPipe, and InsightFace.

## Features

### Student Portal
- **Register** — 3-step flow: account details → face enrollment with liveness → confirmation
- **Login** — secure cookie-based sessions (requires completed face verification)
- **Dynamic QR Check-In** — scan the teacher's rotating QR to mark attendance (`/attendance`)
- **Dashboard** — profile, attendance stats, QR code, recent history

### Teacher Portal
- **Dynamic QR Attendance** — live rotating QR (30 s), subject/section session, real-time counter
- **Face Recognition Attendance** — real-time detection, embedding matching, live status panel
- **QR Code Attendance** — webcam QR scanning with live scan panel
- **Dashboard** — today's attendance, registered student count

### AI Pipeline
- **Face Detection:** MediaPipe BlazeFace + Face Landmarker
- **Face Recognition:** InsightFace Buffalo_L (`w600k_r50.onnx`) via ONNX Runtime Web
- **Liveness:** head pose (left/right/up/down) + blink detection
- **Matching:** cosine similarity (configurable threshold, default 0.45)

### Security (Dynamic QR)
- **HttpOnly session cookie** (`sid`) + **CSRF double-submit** (`XSRF-TOKEN`) protection
- **30-second rotating QR** — old tokens are instantly invalidated on refresh
- **Single-use tokens** — replay is rejected (`TOKEN_EXPIRED`)
- **Duplicate prevention** — one check-in per student per session
- **Section enforcement** — a student outside the session's section is rejected (`SECTION_MISMATCH`)
- **Auto-expiry** — sessions end after the set duration or when the teacher stops them
- **Audit trail** — each check-in stores IP address, user-agent, browser, and device

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, React Router, Axios, React Hook Form, Zod |
| Backend | Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, JWT, bcrypt |
| AI/CV | MediaPipe, InsightFace (ONNX), ONNX Runtime Web, html5-qrcode |

---

## Prerequisites

- **Node.js** 20+
- **PostgreSQL** 14+ (or use Docker)
- **Webcam** (for face enrollment and attendance)
- **~200 MB disk** for the InsightFace ONNX model

---

## Installation

### 1. Clone and install dependencies

```bash
cd face-attendance-system
npm run install:all
```

### 2. Download the InsightFace model

```bash
npm run download:model
```

This downloads `w600k_r50.onnx` (~174 MB) to `frontend/public/models/`.

**Manual download (if script fails):**
- URL: https://huggingface.co/public-data/insightface/resolve/main/models/buffalo_l/w600k_r50.onnx
- Save to: `frontend/public/models/w600k_r50.onnx`

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/face_attendance?schema=public"
JWT_SECRET="your-long-random-secret-here"
JWT_EXPIRES_IN="7d"
REGISTRATION_TOKEN_EXPIRES_IN="30m"
FACE_SIMILARITY_THRESHOLD=0.45
PORT=3001
CORS_ORIGIN="http://localhost:5173"
# Public URL used in attendance QR codes — REQUIRED for QR generation.
# Cloudflare Tunnel: https://abc123.trycloudflare.com · ngrok: https://abc123.ngrok.io · Prod domain: https://attendance.mycollege.edu
PUBLIC_APP_URL="https://abc123.trycloudflare.com"
TEACHER_EMAIL="teacher@school.edu"
TEACHER_PASSWORD="Teacher@123"
TEACHER_NAME="Default Teacher"
```

### 4. Set up the database

```bash
npm run db:setup
```

This runs `prisma db push` and seeds the default teacher account.

### 5. Start development servers

```bash
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **Health check:** http://localhost:3001/health

---

## Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Teacher | teacher@school.edu | Teacher@123 |

Students must register through the Student Portal (registration includes mandatory face enrollment).

---

## Project Structure

```
face-attendance-system/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── seed.ts             # Default teacher seed
│   └── src/
│       ├── controllers/        # Request handlers
│       ├── services/           # Business logic
│       ├── middleware/         # Auth, validation, errors
│       ├── routes/             # API route definitions
│       ├── validators/         # Zod schemas
│       └── utils/              # Face similarity utilities
├── frontend/
│   ├── public/models/          # InsightFace ONNX model
│   └── src/
│       ├── components/         # Shared UI components
│       ├── hooks/              # Camera hook
│       ├── lib/                # API client, face pipeline
│       └── pages/              # Route pages
├── scripts/
│   └── download-model.js       # Model download script
├── docker-compose.yml
└── README.md
```

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `students` | Student accounts with face verification status |
| `face_embeddings` | 512-dim InsightFace embeddings per student |
| `teachers` | Teacher accounts |
| `sessions` | Daily FACE/QR attendance sessions + dynamic QR sessions (session code, subject, section, classroom, expiry) |
| `attendance` | Attendance records (unique per student per session), with session code, subject, IP, and user-agent metadata |
| `session_tokens` | Rotating single-use QR tokens per dynamic session |
| `subjects` | Default subject catalog used to start dynamic sessions |
| `qr_tokens` | Unique QR tokens per student |
| `pending_registrations` | Temporary storage before face enrollment completes |

**Key constraint:** A student account is only created after successful face enrollment. Pending registrations expire after 30 minutes.

---

## API Documentation

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | None | Validate registration, return registration token |
| POST | `/api/auth/register/complete` | Registration JWT | Complete registration with face embeddings |
| POST | `/api/auth/login` | None | Student login (sets `sid` + `XSRF-TOKEN` cookies) |
| POST | `/api/auth/teacher/login` | None | Teacher login (sets cookies) |
| GET | `/api/auth/me` | Cookie/Bearer | Current user (role, profile, section) |
| POST | `/api/auth/logout` | Cookie/Bearer | Clear session cookies |

> All state-changing requests must send the `X-CSRF-Token` header matching the `XSRF-TOKEN` cookie.

### Face Enrollment

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/face/enroll` | Registration JWT | Alias for register/complete |

### Attendance

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/attendance/session` | Teacher JWT | Create/get today's session |
| POST | `/api/attendance/face` | Teacher JWT | Mark attendance via face embedding |
| POST | `/api/attendance/qr` | Teacher JWT | Mark attendance via QR token |
| GET | `/api/attendance/history` | Student/Teacher JWT | Attendance history |

### Dynamic QR Sessions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/subjects` | Teacher | List available subjects |
| POST | `/api/session/create` | Teacher | Start a session (subject, semester, section, classroom, duration) |
| GET | `/api/session/current` | Teacher | Current active session with QR + present count |
| POST | `/api/session/refresh-qr` | Teacher | Rotate the QR (invalidates old tokens) |
| POST | `/api/session/stop` | Teacher | End the session |
| GET | `/api/session/:sessionCode` | Teacher | Session detail + attendance list |
| GET | `/api/attendance/dynamic/status?sessionCode=&token=` | Student | Validate token + session before marking |
| POST | `/api/attendance/dynamic` | Student | Mark attendance (section check, replay/duplicate prevention) |

### Profile & Dashboard

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/student/profile` | Student JWT | Student profile + stats + QR |
| POST | `/api/face/re-enroll` | Student JWT | Re-enroll face for an already-registered student (replaces stored embeddings; needs ≥20 samples) |
| GET | `/api/teacher/dashboard` | Teacher JWT | Teacher dashboard data |
| GET | `/api/config` | None | Similarity threshold config |

---

## Public QR Codes (Cloudflare Tunnel / ngrok)

Attendance QR codes must point to a URL any device can reach. A hardcoded `http://localhost:5173` only works on the machine running the servers, so the QR base URL is now a configurable environment variable.

### Which files were modified

| File | Change |
|------|--------|
| `backend/src/services/sessionService.ts` | QR URL now built from `PUBLIC_APP_URL`; throws a clear error (and logs it) when unset |
| `backend/src/index.ts` | Logs a warning at startup when `PUBLIC_APP_URL` is missing; `CORS_ORIGIN` supports a comma-separated list |
| `backend/.env` / `backend/.env.example` | Replaced `APP_URL` with `PUBLIC_APP_URL` |
| `docker-compose.yml` | Uses `PUBLIC_APP_URL` instead of `APP_URL` |
| `frontend/.env` / `frontend/.env.example` | Added `VITE_PUBLIC_APP_URL` (for display/sharing from the UI) |
| `frontend/src/lib/config.ts` | Exports `PUBLIC_APP_URL` from `VITE_PUBLIC_APP_URL` |

### Where the public URL is configured

- **Backend (QR generation):** `PUBLIC_APP_URL` in `backend/.env`.
- **Frontend (optional, for UI sharing):** `VITE_PUBLIC_APP_URL` in `frontend/.env`.

The QR is generated server-side as:

```
${PUBLIC_APP_URL}/attendance?session=<SESSION_ID>&token=<TOKEN>
```

Session and token generation logic is unchanged.

### 1. Start a Cloudflare Quick Tunnel

```bash
# Install cloudflared once (Windows: winget install cloudflared | macOS/Linux: brew/apt)
cloudflared tunnel --url http://localhost:5173
```

Cloudflare prints a URL like `https://abc123.trycloudflare.com`. It only exposes the local frontend; the Vite dev proxy forwards `/api` to the backend, so the whole app works through the tunnel.

### 2. Update the environment variable

Edit `backend/.env`:

```env
PUBLIC_APP_URL="https://abc123.trycloudflare.com"
```

Then restart the backend:

```bash
cd backend
npm run build
npm run start
```

Only the environment variable needs to change — no code changes.

### 3. Verify on a phone on a different network

1. Teacher: start a Dynamic QR session (Dashboard → Dynamic QR Attendance → Start Session).
2. Scan the QR with a phone that is **not** on your Wi-Fi (use mobile data).
3. The phone opens `https://abc123.trycloudflare.com/attendance?session=...&token=...`.
4. Log in as a student and confirm **Mark Attendance** succeeds; check the teacher's live counter increments.

> **ngrok alternative:** run `ngrok http 5173` and use the printed `https://xxxx.ngrok.io` URL as `PUBLIC_APP_URL`.

### Production

Deploying to a real domain such as `https://attendance.mycollege.edu`? Set `PUBLIC_APP_URL="https://attendance.mycollege.edu"` (backend) and `VITE_PUBLIC_APP_URL` (frontend build) and rebuild. Nothing else changes.

### Error handling

If `PUBLIC_APP_URL` is missing, the backend:
1. Logs a clear warning at startup.
2. Rejects QR generation with the message: *"PUBLIC_APP_URL is not configured. Set PUBLIC_APP_URL in backend/.env to your public URL (Cloudflare Tunnel, ngrok, or domain) to generate QR codes."*

No invalid QR is ever generated.

---

## Deploy to Render (single service)

The app is designed to run as **one** Node web service that serves both the API and the built
frontend (including the 166 MB face model), with a free managed PostgreSQL database.

### 1. Push to GitHub

```bash
git init -b main
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/Sanskarsanshu/verisyncv3.git
git push -u origin main
```

> The ONNX model (`frontend/public/models/*.onnx`) is gitignored — it is downloaded during the
> Render build via `npm run download:model`.

### 2. Create the app on Render

1. Go to https://render.com and sign in.
2. Click **New → Blueprint** and paste the repo URL (`https://github.com/Sanskarsanshu/verisyncv3`).
3. Render reads `render.yaml` and creates:
   - A **PostgreSQL** database (`verisync-postgres`, free)
   - A **Web Service** (`verisync`, free) with build + start commands already set
4. Click **Apply** and wait for the build (it downloads the model + installs deps, ~5–10 min).

### 3. Configure the public URL

After the first deploy, in the service **Environment** tab add:

| Key | Value |
|-----|-------|
| `PUBLIC_APP_URL` | `https://verisync.onrender.com` (use your service's actual URL) |
| `CORS_ORIGIN` | `https://verisync.onrender.com` (same URL) |

`JWT_SECRET` is generated automatically and `DATABASE_URL` is wired to the Postgres instance.
Then **Redeploy** (Manual Deploy → Clear build cache) or just restart.

If `PUBLIC_APP_URL` is missing, the server logs a warning and QR generation returns a clear error —
no invalid QR is produced.

### 4. Verify

- Open `https://verisync.onrender.com` — the app loads.
- Teacher login: `teacher@school.edu` / `Teacher@123`.
- Start a Dynamic QR session and scan with a phone on any network — the QR points to your Render URL.

> **Free tier notes:** the web service sleeps after ~15 min idle (cold start ~30 s) and the free
> database is removed after 30 days unless you upgrade.

---

## Docker Deployment

```bash
# Start PostgreSQL, backend, and frontend
docker compose up --build

# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
```

> **Note:** The ONNX model must be present in `frontend/public/models/` before building the frontend Docker image. Run `npm run download:model` first.

---

## Testing Instructions

### 1. Student Registration
1. Go to http://localhost:5173 → Student Portal → Register
2. Fill in name, roll number, email, password
3. Complete liveness checks (look left, right, up, down, blink)
4. Wait for 30 face samples to be captured
5. Verify "Registration Successful" message appears
6. Confirm dashboard shows face verification as ✅

### 2. Student Login
1. Login with registered email/password
2. Verify redirect to dashboard
3. Try logging in before face enrollment — should show "Face verification is incomplete"

### 3. Face Recognition Attendance
1. Login as teacher (teacher@school.edu / Teacher@123)
2. Go to Face Recognition Attendance
3. Point camera at registered student
4. Verify Real-Time Recognition Status panel shows:
   - Camera: Connected
   - Face: Detected
   - Recognition Confidence: >60%
   - Matched Student name and roll number
   - Attendance: Marked Successfully

### 4. QR Code Attendance
1. Student dashboard shows personal QR code
2. Teacher opens QR Code Attendance
3. Scan student QR code
4. Verify attendance marked in scan panel

### 5. Duplicate Prevention
1. Mark attendance for a student
2. Scan/recognize same student again in same session
3. Verify "Attendance already marked" warning

### 6. Dynamic QR Attendance
1. Teacher → Dashboard → **Dynamic QR Attendance**
2. Select a subject, enter semester/section/classroom, pick a duration, click **Start Session**
3. Teacher shows the rotating QR (refreshes every 30 s with a countdown)
4. Student (logged in) scans the QR or opens the link → `/attendance?session=ATT...&token=...`
5. Verify session details and **Mark Attendance**
6. Verify "Attendance Marked!" and the live present count increments on the teacher view
7. Scan the same QR again → "already marked"; re-scan an old QR → "expired"
8. A student from a different section is rejected ("not enrolled in this section")
9. **Stop Session** ends check-in immediately

### 7. Registration Flow Notes
- Registration now collects **semester** and **section**, which are used for dynamic-QR section enforcement.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `JWT_SECRET` | — | Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | `7d` | JWT expiration |
| `REGISTRATION_TOKEN_EXPIRES_IN` | `30m` | Pending registration token TTL |
| `FACE_SIMILARITY_THRESHOLD` | `0.45` | Cosine similarity threshold for face match. Lower it (e.g. `0.35`) if real webcam faces are not recognized; raise it if wrong matches occur |
| `PUBLIC_APP_URL` | — | Public URL used in attendance QR codes (Cloudflare Tunnel / ngrok / domain). Required for QR generation; when missing, QR generation fails with a clear error |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origins (comma-separated) |
| `TEACHER_EMAIL` | `teacher@school.edu` | Seed teacher email |
| `TEACHER_PASSWORD` | `Teacher@123` | Seed teacher password |

---

## Recognition Pipeline

### Registration
```
Student Camera → MediaPipe Face Detection → Liveness Verification
→ InsightFace Embedding (×30 samples) → Store in PostgreSQL → Account Created
```

### Face Attendance
```
Teacher Camera → MediaPipe Detection → InsightFace Embedding
→ Cosine Similarity vs Database → Match Found → Attendance Marked
```

### QR Attendance
```
Teacher Camera → html5-qrcode Scan → Backend Token Verification → Attendance Marked
```

### Dynamic QR Attendance
```
Teacher: Create Session → Server generates 48-char single-use token (30s TTL)
→ QR encodes /attendance?session=ATT...&token=...
Student: Opens link → /auth/me (cookie) → token+section validation → mark
→ Server atomically creates attendance + consumes token → replay rejected
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Camera not working | Allow browser camera permissions; use HTTPS or localhost |
| Model load fails | Ensure `frontend/public/models/w600k_r50.onnx` exists (~174 MB) |
| Face not recognized | Improve lighting; re-enroll with clearer face samples (Dashboard → Re-enroll Face) |
| Database connection error | Check PostgreSQL is running and `DATABASE_URL` is correct |
| 401 on API calls | Token expired — log in again |
| Low recognition confidence | Adjust `FACE_SIMILARITY_THRESHOLD` (try 0.35–0.45) |

---

## License

MIT
