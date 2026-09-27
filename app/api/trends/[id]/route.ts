import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const districtId = parseInt(id, 10);
    if (isNaN(districtId)) {
      return NextResponse.json({ error: 'Invalid district ID' }, { status: 400 });
    }

    const range = '30 days';

    // Historical baseline for rainfall
    const rainfall = await pool.query(`
      SELECT
        COALESCE(AVG(rainfall_mm), 0) AS avg,
        COALESCE(MIN(rainfall_mm), 0) AS min,
        COALESCE(MAX(rainfall_mm), 0) AS max
      FROM rainfall_readings
      WHERE district_id = $1 AND recorded_at > now() - interval '30 days'
    `, [districtId]);

    // Historical baseline for river levels
    const river = await pool.query(`
      SELECT
        COALESCE(AVG(level_m), 0) AS avg,
        COALESCE(MIN(level_m), 0) AS min,
        COALESCE(MAX(level_m), 0) AS max
      FROM river_levels
      WHERE district_id = $1 AND recorded_at > now() - interval '30 days'
    `, [districtId]);

    // Historical baseline for risk scores
    const risk = await pool.query(`
      SELECT
        COALESCE(AVG(score), 0) AS avg,
        COALESCE(MIN(score), 0) AS min,
        COALESCE(MAX(score), 0) AS max,
        COUNT(*) AS readings
      FROM risk_scores
      WHERE district_id = $1 AND timestamp > now() - interval '30 days'
    `, [districtId]);

    // Current (latest) values
    const current = await pool.query(`
      SELECT
        rs.score,
        rs.zone,
        rs.components::text,
        rs.timestamp::text AS timestamp
      FROM risk_scores rs
      WHERE rs.district_id = $1
      ORDER BY rs.timestamp DESC
      LIMIT 1
    `, [districtId]);

    const r = rainfall.rows[0];
    const rv = river.rows[0];
    const rs = risk.rows[0];
    const cur = current.rows[0];

    return NextResponse.json({
      district_id: districtId,
      range,
      rainfall: {
        current: null,
        avg: Math.round(r.avg * 10) / 10,
        min: Math.round(r.min * 10) / 10,
        max: Math.round(r.max * 10) / 10,
      },
      river: {
        current: null,
        avg: Math.round(rv.avg * 100) / 100,
        min: Math.round(rv.min * 100) / 100,
        max: Math.round(rv.max * 100) / 100,
      },
      risk: {
        current: cur ? { score: cur.score, zone: cur.zone } : null,
        avg: Math.round(rs.avg),
        min: Math.round(rs.min),
        max: Math.round(rs.max),
        readings: parseInt(rs.readings, 10),
      },
    });
  } catch (err) {
    console.error('[trends]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
