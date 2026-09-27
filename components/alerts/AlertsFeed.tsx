'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import type { AlertItem } from '@/lib/types';

export default function AlertsFeed() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    apiGet<AlertItem[]>('/api/alerts/latest')
      .then(setAlerts)
      .catch(console.error);
  }, []);

  return (
    <section className="alerts-shell" id="alerts">
      <div className="section-title">Alerts feed</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {alerts.length ? (
          alerts.map((a) => (
            <div key={a.id} style={{ background: '#f8fafc', padding: 10, borderRadius: 10 }}>
              <div><strong>{a.level}</strong></div>
              <div>{a.message}</div>
            </div>
          ))
        ) : (
          <div className="alerts-empty">No alerts loaded yet</div>
        )}
      </div>
    </section>
  );
}