import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import type { AlertItem } from '@/lib/types';

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT id, level, message, created_at::text AS created_at
      FROM alerts
      ORDER BY created_at DESC
      LIMIT 10
    `);

    const alerts: AlertItem[] = rows.map((r) => ({
      id: r.id,
      level: r.level,
      message: r.message,
      created_at: r.created_at,
    }));

    return NextResponse.json(alerts);
  } catch (err) {
    console.error('[api/alerts/latest]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
