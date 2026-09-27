'use client';

import { useDashboardStore } from '@/lib/store';

export default function RiskTable() {
  const districts = useDashboardStore((s) => s.districts);
  const selected = useDashboardStore((s) => s.selected);

  return (
    <section className="table-shell" id="table">
      <div className="section-title">Risk Table</div>
      <div className="table-list">
        {districts.map((r) => {
          const active = selected?.id === r.id;
          return (
            <div
              className="table-row"
              key={r.id}
              style={{
                background: active ? '#dbeafe' : '#f8fafc',
                border: active ? '1px solid #60a5fa' : '1px solid transparent',
              }}
            >
              <span>{r.name}</span>
              <span>{r.state}</span>
              <span>{r.score}</span>
              <span>{r.zone}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
} 