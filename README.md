# India Flood-Risk Digital Twin

A Next.js dashboard for district flood-risk scores, alerts, and map data.

## Run Locally on Windows

### Prerequisites

- Node.js and npm
- Docker Desktop, running

Open PowerShell in the repository folder and enter the application directory:

```powershell
cd .\flood-risk-digital-twin
```

Run these commands from that directory, where `package.json` is located:

```powershell
npm install
docker compose up -d --wait
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The development server is started by `npm run dev`; you do not run a TypeScript or page file directly. The main page source is `app/page.tsx`.

Docker publishes Postgres on host port `5433` because port `5432` may already be used by a locally installed PostgreSQL server. The local `.env.local` connection string must use port `5433`:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/floodrisk
```

The seed command runs `scripts/seed.ts` and loads sample districts, risk scores, readings, and alerts into the local database. This is sample data, not live weather data. To stop the app, press `Ctrl+C`. To stop the database container while preserving its data, run `docker compose down`.

## Verify the API

With the development server and database running, these endpoints should return seeded records:

- [http://localhost:3000/api/risk/current](http://localhost:3000/api/risk/current)
- [http://localhost:3000/api/alerts/latest](http://localhost:3000/api/alerts/latest)

## Vercel Deployment

The local Docker database is not available to Vercel. The deployed app needs a separately hosted PostgreSQL database with PostGIS, and its connection string must be configured as `DATABASE_URL` in the Vercel project's Environment Variables, followed by a redeployment. The database schema and seed data must also be applied to that hosted database.

Without that configuration, database-backed endpoints return `503` with `Database not configured`; the deployed dashboard will show no districts or alerts. Seeded data is not automatically copied from your computer to Vercel.
