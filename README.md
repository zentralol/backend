# Zentra Backend

Express.js API server for Zentra. Connects to a PostgreSQL database (Supabase) and exposes location search endpoints.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (LTS recommended)
- [Git](https://git-scm.com/)
- Access to the Zentra Supabase project (database password and project URL)

## Clone the repository

```bash
git clone git@github.com:zentralol/backend.git
cd backend
```

If you use HTTPS:

```bash
git clone https://github.com/zentralol/backend.git
cd backend
```

## Install dependencies

```bash
npm install
```

## Environment variables

The app reads configuration from a `.env` file at startup (via `dotenv`). This file is **not** committed to git.

1. Copy the example file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set your values:

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `PORT` | No | HTTP port (default: `3000`) |
   | `DATABASE_URL` | **Yes** | PostgreSQL connection string for `pg` |

### Supabase `DATABASE_URL`

In Supabase Dashboard → **Project Settings → Database → Connection string**, choose **URI** and copy the direct connection (port `5432`).

Format:

```env
DATABASE_URL=postgresql://postgres:<YOUR-PASSWORD>@db.<project-ref>.supabase.co:5432/postgres
```

Replace `<YOUR-PASSWORD>` with your database password. SSL is enabled in `server.js` for cloud databases.

## Run locally

```bash
npm start
```

Or:

```bash
node server.js
```

You should see:

```
Zentra Backend Server running on http://localhost:3000
```

### Verify the server

Health check (also tests database connectivity):

```bash
curl http://localhost:3000/api/v1/health
```

Search locations:

```bash
curl "http://localhost:3000/api/v1/locations/search?q=marina"
```

Get one location by OSM ID:

```bash
curl http://localhost:3000/api/v1/locations/<locationId>
```

## Debug locally

### Node inspector (Chrome / Cursor)

Start with the inspector enabled:

```bash
node --inspect server.js
```

Then attach a debugger:

- **Chrome**: open `chrome://inspect` → **Open dedicated DevTools for Node**
- **Cursor / VS Code**: Run → **Attach to Node Process**, or add a launch config (see below)

### Cursor / VS Code launch config

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Zentra Backend",
      "program": "${workspaceFolder}/server.js",
      "envFile": "${workspaceFolder}/.env"
    }
  ]
}
```

Set breakpoints in `server.js`, press **F5**, and hit an API route to pause execution.

### Common issues

| Symptom | Likely cause |
|---------|----------------|
| `Environment variables loaded successfully? false` | Missing `.env` or `DATABASE_URL` not set |
| `DATABASE_UNAVAILABLE` on `/health` | Wrong password, network, or Supabase project paused |
| `ECONNREFUSED` on port 3000 | Another process using `PORT`; change `PORT` in `.env` |
| `Cannot find module` | Run `npm install` |

## API documentation

Full request/response contract: [`docs/api-contract.md`](docs/api-contract.md).

Current endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Service and database health |
| `GET` | `/api/v1/locations/search` | Search by name (`q`), optional `type`, `limit` |
| `GET` | `/api/v1/locations/:locationId` | Single location by OSM ID |

## Project structure

```
backend/
├── server.js          # Express app and routes
├── package.json
├── .env.example       # Environment variable template
├── docs/
│   └── api-contract.md
└── README.md
```

## Tech stack

- **Runtime**: Node.js
- **HTTP**: Express 5
- **Database**: PostgreSQL via `pg` (Supabase-hosted)
- **Config**: `dotenv`
