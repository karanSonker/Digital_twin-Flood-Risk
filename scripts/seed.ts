/**
 * scripts/seed.ts
 *
 * Seeds the database with districts from GeoJSON and generates
 * realistic sample data so the dashboard has content immediately.
 *
 * Usage:  npx tsx scripts/seed.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

import { config } from 'dotenv';
config({ path: join(__dirname, '..', '.env.local') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function computeRisk(rainfall: number, river: number, floods: number, alertSev: number) {
  const raw = rainfall * 0.35 + river * 22 + floods * 8 + alertSev * 12;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const zone = score >= 70 ? 'red' : score >= 40 ? 'yellow' : 'green';
  return { score, zone };
}

async function columnExists(table: string, column: string) {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return rows.length > 0;
}

async function ensureSchema() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS districts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      state TEXT NOT NULL,
      geom geometry(MultiPolygon, 4326) NOT NULL,
      centroid geometry(Point, 4326),
      area_sqkm NUMERIC(12,2),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  if (!(await columnExists('districts', 'area_sqkm'))) {
    await pool.query(`ALTER TABLE districts ADD COLUMN area_sqkm NUMERIC(12,2);`);
  }
  if (!(await columnExists('districts', 'updated_at'))) {
    await pool.query(`ALTER TABLE districts ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rainfall_readings (
      id SERIAL PRIMARY KEY,
      district_id INT REFERENCES districts(id),
      rainfall_mm NUMERIC(10,2) NOT NULL,
      recorded_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  if (!(await columnExists('rainfall_readings', 'recorded_at'))) {
    await pool.query(`ALTER TABLE rainfall_readings ADD COLUMN recorded_at TIMESTAMPTZ DEFAULT now();`);
  }
  if (!(await columnExists('rainfall_readings', 'timestamp'))) {
    await pool.query(`ALTER TABLE rainfall_readings ADD COLUMN timestamp TIMESTAMPTZ DEFAULT now();`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS river_levels (
      id SERIAL PRIMARY KEY,
      district_id INT REFERENCES districts(id),
      level_m NUMERIC(10,2) NOT NULL,
      recorded_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  if (!(await columnExists('river_levels', 'recorded_at'))) {
    await pool.query(`ALTER TABLE river_levels ADD COLUMN recorded_at TIMESTAMPTZ DEFAULT now();`);
  }
  if (!(await columnExists('river_levels', 'timestamp'))) {
    await pool.query(`ALTER TABLE river_levels ADD COLUMN timestamp TIMESTAMPTZ DEFAULT now();`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      severity TEXT DEFAULT 'info',
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  if (!(await columnExists('alerts', 'severity'))) {
    await pool.query(`ALTER TABLE alerts ADD COLUMN severity TEXT DEFAULT 'info';`);
  }
  if (!(await columnExists('alerts', 'message'))) {
    await pool.query(`ALTER TABLE alerts ADD COLUMN message TEXT;`);
  }
  if (!(await columnExists('alerts', 'created_at'))) {
    await pool.query(`ALTER TABLE alerts ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();`);
  }
  if (!(await columnExists('alerts', 'level'))) {
    await pool.query(`ALTER TABLE alerts ADD COLUMN level TEXT DEFAULT 'info';`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS risk_scores (
      id SERIAL PRIMARY KEY,
      district_id INT REFERENCES districts(id),
      score INT NOT NULL,
      zone TEXT NOT NULL,
      components JSONB NOT NULL DEFAULT '{}'::jsonb,
      timestamp TIMESTAMPTZ DEFAULT now()
    );
  `);
  if (!(await columnExists('risk_scores', 'timestamp'))) {
    await pool.query(`ALTER TABLE risk_scores ADD COLUMN timestamp TIMESTAMPTZ DEFAULT now();`);
  }
}

async function insertAlert(a: { severity: string; message: string }) {
  const hasSeverity = await columnExists('alerts', 'severity');
  const hasLevel = await columnExists('alerts', 'level');
  if (hasSeverity) {
    await pool.query(`INSERT INTO alerts (severity, message, created_at) VALUES ($1, $2, now())`, [a.severity, a.message]);
  } else if (hasLevel) {
    await pool.query(`INSERT INTO alerts (level, message, created_at) VALUES ($1, $2, now())`, [a.severity, a.message]);
  } else {
    await pool.query(`INSERT INTO alerts (message, created_at) VALUES ($1, now())`, [a.message]);
  }
}

async function insertRainfall(districtId: number, rainfall: number) {
  const hasRecordedAt = await columnExists('rainfall_readings', 'recorded_at');
  const hasTimestamp = await columnExists('rainfall_readings', 'timestamp');
  if (hasRecordedAt) {
    await pool.query(
      `INSERT INTO rainfall_readings (district_id, rainfall_mm, recorded_at, timestamp, source) VALUES ($1, $2, now(), now(), $3)`,
      [districtId, rainfall, 'seed-script']
    );
  } else if (hasTimestamp) {
    await pool.query(
      `INSERT INTO rainfall_readings (district_id, rainfall_mm, timestamp, source) VALUES ($1, $2, now(), $3)`,
      [districtId, rainfall, 'seed-script']
    );
  } else {
    await pool.query(`INSERT INTO rainfall_readings (district_id, rainfall_mm, source) VALUES ($1, $2, $3)`, [districtId, rainfall, 'seed-script']);
  }
}

async function insertRiverLevel(districtId: number, river: number) {
  const hasRecordedAt = await columnExists('river_levels', 'recorded_at');
  const hasTimestamp = await columnExists('river_levels', 'timestamp');
  if (hasRecordedAt) {
    await pool.query(`INSERT INTO river_levels (district_id, level_m, recorded_at) VALUES ($1, $2, now())`, [districtId, river]);
  } else if (hasTimestamp) {
    await pool.query(`INSERT INTO river_levels (district_id, level_m, timestamp) VALUES ($1, $2, now())`, [districtId, river]);
  } else {
    await pool.query(`INSERT INTO river_levels (district_id, level_m) VALUES ($1, $2)`, [districtId, river]);
  }
}

async function insertRiskScore(districtId: number, score: number, zone: string, components: Record<string, number | string>) {
  await pool.query(
    `INSERT INTO risk_scores (district_id, score, zone, components, timestamp) VALUES ($1, $2, $3, $4, now())`,
    [districtId, score, zone, JSON.stringify(components)]
  );
}

async function main() {
  console.log('🌊 Seeding flood-risk DB...\n');

  await ensureSchema();

  const geojsonPath = join(__dirname, '..', 'public', 'data', 'districts.geojson');
  const geojson = JSON.parse(readFileSync(geojsonPath, 'utf-8'));

  console.log(`📂 Loaded ${geojson.features.length} districts from GeoJSON\n`);

  for (const feat of geojson.features) {
    const { id, name, state } = feat.properties;
    const geom = JSON.stringify(feat.geometry);
    await pool.query(
      `INSERT INTO districts (id, name, state, geom, centroid)
       VALUES ($1, $2, $3, ST_GeomFromGeoJSON($4), ST_Centroid(ST_GeomFromGeoJSON($4)))
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name, state = EXCLUDED.state,
             geom = EXCLUDED.geom, centroid = EXCLUDED.centroid,
             updated_at = now()`,
      [id, name, state, geom]
    );
    console.log(`  ✅ District ${id}: ${name} (${state})`);
  }

  const alerts = [
    { severity: 'high', message: 'IMD orange alert: Heavy rainfall expected in next 24h — upstream catchment at risk' },
    { severity: 'medium', message: 'River level rising in multiple districts — monitoring threshold approaching 2.5m' },
    { severity: 'low', message: 'Weekly forecast: scattered showers across northern and eastern India' },
    { severity: 'high', message: 'Dam discharge increased — downstream districts on alert' },
    { severity: 'medium', message: 'Soil saturation above 80% in coastal districts — flash flood risk elevated' },
    { severity: 'low', message: 'Routine check: all monitoring stations operational' },
  ];

  await pool.query('DELETE FROM alerts');
  for (const a of alerts) {
    await insertAlert(a);
    console.log(`  🔔 Alert: [${a.severity}] ${a.message.slice(0, 50)}...`);
  }

  const districts = geojson.features.map((f: any) => {
    const props = f.properties;
    // Compute centroid from polygon
    const coords = f.geometry.coordinates[0][0];
    const cx = coords.reduce((s: number, c: number[]) => s + c[0], 0) / coords.length;
    const cy = coords.reduce((s: number, c: number[]) => s + c[1], 0) / coords.length;
    return { ...props, lng: cx, lat: cy };
  });

  for (const d of districts) {
    // Heuristic base values based on geographic location
    const coastal = d.lng < 73 || (d.lng > 85 && d.lat < 22) ? 1 : d.lng > 85 ? 0.7 : 0.3;
    const floodProne = d.lat > 24 && d.lat < 28 && d.lng > 83 ? 1 : coastal > 0.5 ? 0.6 : 0.2;

    const rainfall = Math.round(20 + coastal * 65 + Math.random() * 10);
    const river = +(0.5 + floodProne * 2.3 + Math.random() * 0.3).toFixed(2);
    const floods = Math.round(floodProne * 4 + Math.random());
    const alertSev = floodProne > 0.5 ? 3 : coastal > 0.5 ? 2 : 1;
    const { score, zone } = computeRisk(rainfall, river, floods, alertSev);

    await insertRainfall(d.id, rainfall);
    await insertRiverLevel(d.id, river);
    await insertRiskScore(d.id, score, zone, {
      rainfall_mm: rainfall,
      river_level: river,
      historical_floods: floods,
      alert_severity: alertSev,
    });

    console.log(`  📊 ${d.name} (${d.state}): score=${score} zone=${zone} rainfall=${rainfall}mm river=${river}m`);
  }

  console.log('\n✅ Seed complete! Dashboard is ready.');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
