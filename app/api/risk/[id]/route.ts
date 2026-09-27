import { NextResponse } from 'next/server';
import { hasDatabase, pool } from '@/lib/db';
import type { DistrictDetail } from '@/lib/types';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { id } = await params;
    const districtId = parseInt(id, 10);

    if (isNaN(districtId)) {
      return NextResponse.json({ error: 'Invalid district ID' }, { status: 400 });
    }

    // Get district info + latest risk score
    const { rows } = await pool.query(
      `
      SELECT
        d.id,
        d.name,
        d.state,
        COALESCE(rs.score, 0) AS score,
        COALESCE(rs.zone, 'green') AS zone,
        COALESCE(rs.components, '{}'::jsonb) AS components,
        COALESCE(rs.timestamp, d.updated_at, now())::text AS updated_at
      FROM districts d
      LEFT JOIN risk_scores rs ON rs.district_id = d.id
      WHERE d.id = $1
      ORDER BY rs.timestamp DESC
      LIMIT 1
      `,
      [districtId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'District not found' }, { status: 404 });
    }

    const r = rows[0];
    const detail: DistrictDetail = {
      id: r.id,
      name: r.name,
      state: r.state,
      score: r.score,
      zone: r.zone,
      components: typeof r.components === 'string' ? JSON.parse(r.components) : r.components,
      updated_at: r.updated_at,
    };

    return NextResponse.json(detail);
  } catch (err) {
    console.error('[api/risk/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
