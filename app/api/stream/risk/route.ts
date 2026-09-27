import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();

      let closed = false;
      const isClosed = () => closed;

      const safeEnqueue = (data: Uint8Array) => {
        if (!isClosed()) {
          try { controller.enqueue(data); } catch { /* ignore */ }
        }
      };

      const sendEvent = (event: string, data: unknown) => {
        safeEnqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // Keep connection alive every 15s
      const keepAlive = setInterval(() => {
        safeEnqueue(encoder.encode(':keepalive\n\n'));
      }, 15_000);

      const poll = async () => {
        if (isClosed()) return;
        try {
          // Get latest risk scores
          const { rows: districts } = await pool.query(`
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

          // Get latest alerts
          const { rows: alerts } = await pool.query(`
            SELECT id, level, message, created_at::text AS created_at
            FROM alerts
            ORDER BY created_at DESC
            LIMIT 5
          `);

          sendEvent('risk', {
            ts: new Date().toISOString(),
            districts: districts.map((d: any) => ({
              id: d.id,
              name: d.name,
              state: d.state,
              score: d.score,
              zone: d.zone,
              updated_at: d.updated_at,
            })),
            alerts: alerts.map((a: any) => ({
              id: a.id,
              level: a.level,
              message: a.message,
              created_at: a.created_at,
            })),
          });
        } catch (err) {
          console.error('[stream/risk]', err);
        }
      };

      // Initial push
      await poll();

      // Poll every 60 seconds
      const pollInterval = setInterval(poll, 60_000);

      // Cleanup on disconnect via request signal
      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        clearInterval(pollInterval);
        try { controller.close(); } catch { /* ignore */ }
      };

      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
