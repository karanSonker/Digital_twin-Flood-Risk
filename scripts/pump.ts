/**
 * scripts/pump.ts
 *
 * Background data pump — periodically fetches live/open-source data,
 * computes risk scores, and writes to the database.
 *
 * Runs indefinitely. Press Ctrl+C to stop.
 *
 * Usage:
 *   npx tsx scripts/pump.ts                  # every 5 min (default)
 *   npx tsx scripts/pump.ts --interval 60    # every 60 seconds
 *
 * Data sources (auto-fallback to realistic mock if env vars not set):
 *   1. Rainfall  → IMD / OGD API  → fallback: simulated monsoon data
 *   2. River levels → CWC API     → fallback: simulated river gauge
 *   3. Alerts    → Alert API      → fallback: generated alerts
 *   4. Weather   → Open-Meteo     → always live (free, no key)
 */

import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '..', '.env.local') });

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── CLI args ────────────────────────────────────────────────────────
const INTERVAL_SEC = parseInt(process.argv[3] || process.argv[2] || '300', 10) || 300;

// ── Helpers ─────────────────────────────────────────────────────────
function noise(center: number, pct = 0.15) {
  return Math.max(0, center + center * (Math.random() - 0.5) * pct * 2);
}

function computeRisk(rainfall: number, river: number, floods: number, alertSev: number) {
  const raw = rainfall * 0.35 + river * 22 + floods * 8 + alertSev * 12;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const zone = score >= 70 ? 'red' : score >= 40 ? 'yellow' : 'green';
  return { score, zone };
}

/** Derive base rainfall, river level, and flood count from geographic coordinates */
function baseValuesFromCoords(lng: number, lat: number) {
  const coastal = lng < 73 || (lng > 85 && lat < 22) ? 1 : lng > 85 ? 0.7 : 0.3;
  const floodProne = lat > 24 && lat < 28 && lng > 83 ? 1 : coastal > 0.5 ? 0.6 : 0.2;
  return {
    rainfall: Math.round(20 + coastal * 65),
    riverLevel: +(0.5 + floodProne * 2.3).toFixed(2),
    floods: Math.round(floodProne * 4),
  };
}

async function fetchRainfall(districtIds: number[]): Promise<Record<number, number>> {
  const centroids = await fetchCentroids(districtIds);
  // 1. Open-Meteo Weather API (free, no key needed) — live precipitation
  try {
    const results = await Promise.all(
      districtIds.map(async (id) => {
        const c = centroids[id];
        if (!c) return null;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}&current=precipitation&daily=precipitation_sum&forecast_days=1`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        // Prefer daily sum (total today), fall back to current precipitation
        const mm = data.daily?.precipitation_sum?.[0] ?? data.current?.precipitation ?? null;
        return mm !== null ? { id, mm: Math.round(mm * 10) / 10 } : null;
      })
    );
    const map: Record<number, number> = {};
    let count = 0;
    for (const r of results) {
      if (r) { map[r.id] = r.mm; count++; }
    }
    if (count > 0) {
      console.log(`  🌧️  Open-Meteo: live rainfall for ${count}/${districtIds.length} district(s)`);
      // Fill missing districts with mock data
      for (const id of districtIds) {
        if (map[id] === undefined) {
          const c = centroids[id];
          const base = c ? baseValuesFromCoords(c.lng, c.lat) : { rainfall: 30 };
          map[id] = Math.round(noise(base.rainfall, 0.2));
        }
      }
      return map;
    }
  } catch { /* fall through */ }

  // 2. IMD (if configured)
  if (process.env.IMD_RAINFALL_URL) {
    try {
      const res = await fetch(process.env.IMD_RAINFALL_URL, {
        headers: process.env.IMD_API_KEY
          ? { Authorization: `Bearer ${process.env.IMD_API_KEY}` }
          : undefined,
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length) {
          const map: Record<number, number> = {};
          for (const d of data) map[d.district_id] = d.rainfall_mm;
          return map;
        }
      }
    } catch { /* fall through */ }
  }

  // 3. OGD (if configured)
  if (process.env.OGD_RAINFALL_URL) {
    try {
      const res = await fetch(process.env.OGD_RAINFALL_URL);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length) {
          const map: Record<number, number> = {};
          for (const d of data) map[d.district_id] = d.rainfall_mm;
          return map;
        }
      }
    } catch { /* fall through */ }
  }

  // ── Realistic mock (Indian monsoon simulation) ──────────────────
  const result: Record<number, number> = {};
  for (const id of districtIds) {
    const c = centroids[id];
    const base = c ? baseValuesFromCoords(c.lng, c.lat) : { rainfall: 30 };
    result[id] = Math.round(noise(base.rainfall, 0.2));
  }
  return result;
}

async function fetchRiverLevels(districtIds: number[]): Promise<Record<number, number>> {
  const centroids = await fetchCentroids(districtIds);

  // 1. Open-Meteo Flood API (free, no key needed) — live river discharge from GloFAS
  try {
    const results = await Promise.all(
      districtIds.map(async (id) => {
        const c = centroids[id];
        if (!c) return null;
        const url = `https://flood-api.open-meteo.com/v1/flood?latitude=${c.lat}&longitude=${c.lng}&daily=river_discharge&forecast_days=1`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const discharge = data.daily?.river_discharge?.[0] ?? null;
        if (discharge === null) return null;
        // Convert discharge (m³/s) to approximate level proxy (meters)
        // Typical monsoon discharge 50-1000 m³/s → 0.25-5.0 meters
        const levelProxy = Math.min(5, +(discharge / 200).toFixed(2));
        return { id, level: Math.max(0.1, levelProxy) };
      })
    );
    const map: Record<number, number> = {};
    let count = 0;
    for (const r of results) {
      if (r) { map[r.id] = r.level; count++; }
    }
    if (count > 0) {
      console.log(`  🌊 Open-Meteo Flood: live river data for ${count}/${districtIds.length} district(s)`);
      // Fill missing districts with mock data
      for (const id of districtIds) {
        if (map[id] === undefined) {
          const c = centroids[id];
          const base = c ? baseValuesFromCoords(c.lng, c.lat) : { riverLevel: 1.0 };
          map[id] = +noise(base.riverLevel, 0.12).toFixed(2);
        }
      }
      return map;
    }
  } catch { /* fall through */ }

  // 2. Custom API (if configured)
  if (process.env.RIVER_LEVELS_API_URL) {
    try {
      const res = await fetch(process.env.RIVER_LEVELS_API_URL);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const map: Record<number, number> = {};
          for (const d of data) map[d.district_id] = d.river_level ?? d.level_m;
          return map;
        }
      }
    } catch { /* fall through */ }
  }

  // ── Realistic mock (monsoon river levels in meters) ─────────────
  const result: Record<number, number> = {};
  for (const id of districtIds) {
    const c = centroids[id];
    const base = c ? baseValuesFromCoords(c.lng, c.lat) : { riverLevel: 1.0 };
    result[id] = +noise(base.riverLevel, 0.12).toFixed(2);
  }
  return result;
}

async function fetchAlerts(districtIds: number[]): Promise<{ level: string; message: string }[]> {
  if (process.env.ALERTS_API_URL) {
    try {
      const res = await fetch(process.env.ALERTS_API_URL);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch { /* fall through */ }
  }

  // ── Realistic mock alerts ───────────────────────────────────────
  const templates = [
    { level: 'high', message: 'IMD orange alert: heavy rainfall (>115mm) expected in next 6 hours' },
    { level: 'high', message: 'River gauge crossing danger mark at upstream station — prepare evacuation' },
    { level: 'medium', message: 'Moderate flooding reported in low-lying areas of the district' },
    { level: 'medium', message: 'Dam discharge rate increased to 2500 cusecs — downstream alert' },
    { level: 'low', message: 'Weekly bulletin: scattered light showers expected, levels normal' },
    { level: 'low', message: 'Routine inspection: all flood monitoring stations operational' },
    { level: 'high', message: 'Flash flood warning: intense rainfall in upper catchment area' },
  ];

  // Always include 2-3 alerts, randomly chosen
  const count = 2 + Math.floor(Math.random() * 2);
  const shuffled = [...templates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function fetchCentroids(districtIds: number[]): Promise<Record<number, { lat: number; lng: number }>> {
  const { rows } = await pool.query(
    `SELECT id, ST_X(centroid) AS lng, ST_Y(centroid) AS lat FROM districts WHERE id = ANY($1)`,
    [districtIds]
  );
  const map: Record<number, { lat: number; lng: number }> = {};
  for (const r of rows) map[r.id] = { lat: r.lat, lng: r.lng };
  return map;
}

// ── Main loop ───────────────────────────────────────────────────────
async function pump() {
  const start = Date.now();
  const ts = new Date().toISOString();
  console.log(`\n🔄 [${ts.slice(11, 19)}] Pumping data...`);

  try {
    // Get all district IDs
    const { rows: districts } = await pool.query('SELECT id, name FROM districts ORDER BY id');
    const districtIds = districts.map((d: any) => d.id);
    const names = Object.fromEntries(districts.map((d: any) => [d.id, d.name]));

    if (districtIds.length === 0) {
      console.log('  ⚠️  No districts in DB — run `npx tsx scripts/seed.ts` first');
      return;
    }

    // Fetch all data in parallel
    const [rainfallMap, riverMap, alerts] = await Promise.all([
      fetchRainfall(districtIds),
      fetchRiverLevels(districtIds),
      fetchAlerts(districtIds),
    ]);

    // Write alerts
    const existingAlerts = (await pool.query('SELECT id FROM alerts')).rows;
    if (existingAlerts.length > 20) {
      await pool.query('DELETE FROM alerts WHERE id IN (SELECT id FROM alerts ORDER BY created_at ASC LIMIT $1)', [
        existingAlerts.length - 15,
      ]);
    }

    for (const alert of alerts) {
      await pool.query(
        'INSERT INTO alerts (message, severity, level) VALUES ($1, $2, $3)',
        [alert.message ?? 'Flood alert', alert.level ?? 'low', alert.level ?? 'low']
      );
    }

    // Write rainfall readings
    for (const id of districtIds) {
      const mm = rainfallMap[id] ?? 0;
      await pool.query(
        'INSERT INTO rainfall_readings (district_id, rainfall_mm, timestamp, source, recorded_at) VALUES ($1, $2, now(), $3, now())',
        [id, mm, 'pump-script']
      );
    }

    // Write river levels
    for (const id of districtIds) {
      const lvl = riverMap[id] ?? 0;
      await pool.query(
        'INSERT INTO river_levels (district_id, level_m, recorded_at, timestamp) VALUES ($1, $2, now(), now())',
        [id, lvl]
      );
    }

    // Compute & write risk scores
    const alertSevMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const centroids = await fetchCentroids(districtIds);

    for (const id of districtIds) {
      const rainfall = rainfallMap[id] ?? 0;
      const river = riverMap[id] ?? 0;
      const c = centroids[id];
      const base = c ? baseValuesFromCoords(c.lng, c.lat) : { floods: 1 };
      const floods = base.floods;
      const alertSev = Math.max(...alerts.map((a: any) => alertSevMap[a.level] ?? 1), 1);

      const { score, zone } = computeRisk(rainfall, river, floods, alertSev);

      await pool.query(
        `INSERT INTO risk_scores (district_id, score, zone, components, timestamp)
         VALUES ($1, $2, $3, $4, now())`,
        [
          id,
          score,
          zone,
          JSON.stringify({ rainfall_mm: rainfall, river_level: river, historical_floods: floods, alert_severity: alertSev }),
        ]
      );

      const icon = zone === 'red' ? '🔴' : zone === 'yellow' ? '🟡' : '🟢';
      console.log(`  ${icon} ${names[id] || `District ${id}`}: score=${score} (${rainfall}mm rain, ${river}m river)`);
    }

    console.log(`  📬 ${alerts.length} alerts inserted`);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  ⏱️  Done in ${elapsed}s — next run in ${INTERVAL_SEC}s`);
  } catch (err) {
    console.error('  ❌ Pump error:', err);
  }
}

// ── Entry ───────────────────────────────────────────────────────────
console.log('🚰 Data Pump started');
console.log(`   Interval: every ${INTERVAL_SEC}s`);
console.log(`   DB: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@') || 'not set'}`);
console.log(`   Live APIs: Open-Meteo Weather ✅  Open-Meteo Flood ✅`);
console.log(`   Custom APIs: ${process.env.IMD_RAINFALL_URL ? 'IMD ✅' : 'IMD ❌'}  ${process.env.RIVER_LEVELS_API_URL ? 'River ✅' : 'River ❌'}  ${process.env.ALERTS_API_URL ? 'Alerts ✅' : 'Alerts ❌'}`);
console.log(`   Press Ctrl+C to stop\n`);

// Run immediately, then on interval
pump();
const timer = setInterval(pump, INTERVAL_SEC * 1000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down pump...');
  clearInterval(timer);
  pool.end();
  process.exit(0);
});
