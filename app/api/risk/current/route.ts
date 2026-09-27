import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import type { DistrictSummary } from '@/lib/types';

export async function GET() {
  try {
    // Get latest risk score per district, joining districts table for name/state
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (d.id)
        d.id,
        d.name,
        d.state,
        COALESCE(rs.score, 0) AS score,
        COALESCE(rs.zone, 'green') AS zone,
        COALESCE(rs.timestamp, d.updated_at, now())::text AS updated_at
      FROM districts d
      LEFT JOIN risk_scores rs ON rs.district_id = d.id
      ORDER BY d.id, rs.timestamp DESC
    `);

    const districts: DistrictSummary[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      state: r.state,
      score: r.score,
      zone: r.zone,
      updated_at: r.updated_at,
    }));

    return NextResponse.json(districts);
  } catch (err) {
    console.error('[api/risk/current]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
