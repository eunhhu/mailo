<div align="center">

# Mailo

**A single-user Gmail webmail client you can self-host.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/runtime-Bun-F9F1E1?logo=bun&logoColor=black)](https://bun.sh/)
[![Elysia](https://img.shields.io/badge/server-Elysia-8B5CF6)](https://elysiajs.com/)
[![SolidJS](https://img.shields.io/badge/frontend-SolidJS-2C4F7C?logo=solid&logoColor=white)](https://www.solidjs.com/)
[![Postgres](https://img.shields.io/badge/store-Postgres-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

</div>

---

## Overview

Mailo is a lightweight webmail UI for **one Gmail account**. It authenticates with Google via OAuth2, stores the resulting tokens encrypted in Postgres, and talks to the Gmail API from a small Bun/Elysia backend. The frontend is a SolidJS SPA that looks and feels like a minimal Gmail / Hey-style inbox: keyboard shortcuts, sidebar folders, swipe gestures on mobile, batch selection, and search.

A simple **app password** gate sits in front of OAuth, so even if you expose the service publicly only someone with that password can start a Gmail session.

## Features

### Mail

- **Full inbox surface** — Inbox / Starred / Sent / Archive / Spam / Trash / All Mail.
- **Server-side search** — anything valid in Gmail's search box is accepted.
- **Message view** — sandboxed iframe (`srcdoc`, no `allow-scripts`) with auto-resize via `ResizeObserver`.
- **Compose** — plain-text outbound mail via `gmail.send`.
- **Batch actions** — archive, trash, untrash, spam/unspam, star/unstar, mark read/unread, move-to-inbox.
- **Permanent delete** — `DELETE` on the Gmail API, reachable from the Trash folder.

### UX

- **Keyboard shortcuts** in the inbox (`j`/`k` to move, `e` to archive, `#` to trash, `/` to search, etc.).
- **Swipe gestures** on mobile for archive / trash.
- **Long-press + tap to multi-select**, then apply an action from the batch toolbar.
- **Toasts** for every mutation (with an undo-ish "moved to …" feedback).
- **Skip-link** + focus-trap sidebar for keyboard users.
- **In-memory list & detail cache** so re-entering a folder is instant.

### Backend & security

- **OAuth2 with Google** (`gmail.modify` + `gmail.send` scopes).
- **`state` cookie** verified on the OAuth callback (login CSRF mitigation).
- **OAuth tokens encrypted at rest** with AES-256-GCM (key derived from `SESSION_SECRET` via SHA-256).
- **Per-session rate limit** on Gmail API endpoints (60 req / 60 s) and a stricter one on the password gate.
- **Base64url body decoding** with padding correction for Gmail bodies that omit `=`.
- **Session cookies** are HttpOnly + SameSite=Lax + Secure in production.

## Stack

| Layer | Tech |
|---|---|
| Runtime | [Bun](https://bun.sh/) |
| Backend | [Elysia](https://elysiajs.com/) |
| Database | PostgreSQL (`postgres` client) |
| Frontend | [SolidJS](https://www.solidjs.com/) + [@solidjs/router](https://docs.solidjs.com/solid-router) + [@motionone/solid](https://motion.dev/solid) |
| Bundler | Vite |
| Lint / format | [Biome](https://biomejs.dev/) |

## Getting started

### 1. Create a Google Cloud OAuth client

- Enable the **Gmail API** in a Google Cloud project.
- Create an **OAuth 2.0 Client ID** (type: "Web application").
- Add `http://localhost:8380/auth/callback` (and your prod URL) as an authorized redirect URI.
- Copy the client ID + secret.

### 2. Configure the environment

```bash
cp .env.example .env
# then edit .env:
#   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
#   APP_PASSWORD        -> the password that gates the login page
#   SESSION_SECRET      -> >= 32 bytes of random data (used to encrypt tokens)
#   BASE_URL            -> public URL of the server
```

Generate a strong session secret:

```bash
openssl rand -hex 32
```

### 3. Start Postgres

```bash
docker compose up -d
```

This starts Postgres 17 on `localhost:5433` with the credentials in `.env.example`.

### 4. Install dependencies and initialise the DB

```bash
bun install
cd frontend && bun install && cd ..
bun run setup-db
```

### 5. Run in development

```bash
# Terminal 1: backend (Elysia, watches src/)
bun run dev

# Terminal 2: frontend (Vite dev server)
cd frontend
bun run dev
```

Open http://localhost:5173/, enter the `APP_PASSWORD`, then sign in with Google.

### 6. Production build

```bash
bun run build
```

This runs `scripts/build.sh`, which:

1. Builds the SolidJS app to `frontend/dist/`.
2. Compiles the backend into a single executable at `./mailo-server` via `bun build --compile`.

Deploy `mailo-server`, `frontend/dist/`, `.env`, and the systemd unit at `systemd/webmail.service` to `/opt/webmail/`.

## Configuration reference

All settings come from environment variables (see `.env.example`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `postgres://…` connection string. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google OAuth client. |
| `APP_PASSWORD` | Gate in front of the OAuth flow. |
| `SESSION_SECRET` | Used as the HMAC / cookie-signing secret and as input to AES-256-GCM key derivation. Must be long and random. |
| `PORT`, `HOST` | Listener config. |
| `BASE_URL` | Public URL of the deployment (used by the CORS / cookie-domain logic). |

## Scripts

| Script | What it does |
|---|---|
| `bun run dev` | Backend dev server (watches `src/`). |
| `bun run build` | Build frontend + compile backend into `./mailo-server`. |
| `bun run setup-db` | Applies the schema in `src/db/schema.ts`. |
| `bun run lint` | Biome (lint + format + organize imports). |
| `bun run lint:fix` | `biome check --write .`. |
| `bun run typecheck` | `tsc --noEmit` on both backend and `frontend/`. |

## API surface

All routes live under `/api/messages` and require a valid session cookie. Mutations go through a per-session rate limiter (60 / 60 s).

| Method & Path | Action |
|---|---|
| `GET    /api/messages` | List messages (optional `q` = Gmail search query). |
| `GET    /api/messages/:id` | Fetch full message with decoded body. |
| `POST   /api/messages/send` | Send a message (`to` / `subject` / `body`). |
| `POST   /api/messages/:id/archive` | Remove `INBOX` label. |
| `POST   /api/messages/:id/trash` / `untrash` | Move to Trash / restore. |
| `POST   /api/messages/:id/spam` / `unspam` | Apply / remove the `SPAM` label. |
| `POST   /api/messages/:id/star` / `unstar` | Toggle `STARRED`. |
| `POST   /api/messages/:id/read` / `unread` | Toggle `UNREAD`. |
| `POST   /api/messages/:id/move-to-inbox` | Re-apply `INBOX`. |
| `POST   /api/messages/:id/delete` | Permanently delete via Gmail's `DELETE` endpoint. |

Auth flow lives under `/auth`:

| Method & Path | Action |
|---|---|
| `POST /auth/password` | Verify `APP_PASSWORD`, set the gate cookie. |
| `GET  /auth/login` | Redirect to Google's OAuth consent screen with a generated `state`. |
| `GET  /auth/callback` | Complete OAuth, verify `state`, encrypt + store tokens, set session cookie. |
| `POST /auth/logout` | Clear session + invalidate tokens. |
| `GET  /auth/me` | Current user info (for the frontend). |

## Known limitations

- Intended as a **single-user** deployment. The session model stores tokens keyed by the one Google account that logged in most recently.
- Only plain-text sending is supported (no HTML compose, attachments, or drafts yet).
- No push notifications — list refreshes are manual or on navigation.
- `x-forwarded-for` is used as a rate-limit key on the password route. Run Mailo behind a trusted reverse proxy that strips / rewrites that header from external clients.

## License

Mailo is released under the [MIT License](LICENSE).
