'use client';

import { useDashboardStore } from '@/lib/store';

export default function DistrictPanel() {
  const selected = useDashboardStore((s) => s.selected);

  return (
    <section className="district-panel" id="panel">
      <div className="section-title">District Panel</div>
      {selected ? (
        <div>
          <div><strong>{selected.name}</strong></div>
          <div>{selected.state}</div>
          <div>Score: {selected.score}</div>
          <div>Zone: {selected.zone}</div>
          <div>Updated: {selected.updated_at}</div>
        </div>
      ) : (
        <div className="panel-empty">Click a district to view details</div>
      )}
    </section>
  );
}