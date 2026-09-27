'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Map as MapLibreMap, Source, Layer } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiGet } from '@/lib/api';
import type { DistrictDetail, DistrictSummary, AlertItem } from '@/lib/types';

type DistrictGeoJson = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: {
      id: number;
      name: string;
      state: string;
      zone?: string;
      score?: number;
    };
    geometry: any;
  }>;
};

export default function DashboardPage() {
  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [selected, setSelected] = useState<DistrictDetail | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [geojson, setGeojson] = useState<DistrictGeoJson | null>(null);
  const [liveTime, setLiveTime] = useState<string>('');

  useEffect(() => {
    apiGet<DistrictSummary[]>('/api/risk/current').then(setDistricts).catch(console.error);
    apiGet<AlertItem[]>('/api/alerts/latest').then(setAlerts).catch(console.error);
    fetch('/data/districts.geojson').then((r) => r.json()).then(setGeojson).catch(console.error);
  }, []);

  useEffect(() => {
    const es = new EventSource('/api/stream/risk');
    es.addEventListener('risk', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      if (data?.districts) setDistricts(data.districts);
      if (data?.alerts) setAlerts(data.alerts);
      if (data?.ts) setLiveTime(data.ts);
    });
    es.onerror = () => es.close();
    return () => es.close();
  }, []);

  const enrichedGeojson = useMemo(() => {
    if (!geojson) return null;
    const byId = new globalThis.Map(districts.map((d) => [d.id, d]));
    return {
      ...geojson,
      features: geojson.features.map((f) => {
        const d = byId.get(f.properties.id);
        return {
          ...f,
          properties: {
            ...f.properties,
            zone: d?.zone ?? f.properties.zone ?? 'green',
            score: d?.score ?? f.properties.score ?? 0,
          },
        };
      }),
    };
  }, [geojson, districts]);

  async function handleClick(e: any) {
    const feature = e.features?.[0];
    if (!feature) return;
    const id = feature.properties.id;
    const detail = await apiGet<DistrictDetail>(`/api/risk/${id}`);
    setSelected(detail);
  }

  const initialViewState = {
    longitude: 78.9629,
    latitude: 20.5937,
    zoom: 4.2,
  };

  return (
    <main style={{ minHeight: '100vh', background: '#07111f', color: '#e5eefb', padding: 16, fontFamily: 'Inter, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Flood Risk Digital Twin</h1>
          <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>
            Live district risk monitoring, map intelligence, and alert tracking.
          </p>
        </div>
        <div style={{ textAlign: 'right', color: '#cbd5e1' }}>
          <div>Live: {liveTime || 'connecting...'}</div>
          <Link href="/" style={{ color: '#60a5fa' }}>Home</Link>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '1.8fr 0.8fr', gap: 16 }}>
        <div style={{ position: 'relative', height: 640, borderRadius: 20, overflow: 'hidden', background: '#0f172a' }}>
          <MapLibreMap
            initialViewState={initialViewState}
            mapStyle="https://demotiles.maplibre.org/style.json"
            style={{ width: '100%', height: '100%' }}
            onClick={handleClick}
          >
            {enrichedGeojson ? (
              <Source id="districts" type="geojson" data={enrichedGeojson}>
                <Layer
                  id="district-fill"
                  type="fill"
                  paint={{
                    'fill-color': [
                      'match',
                      ['get', 'zone'],
                      'red', '#ef4444',
                      'yellow', '#f59e0b',
                      'green', '#22c55e',
                      '#64748b',
                    ],
                    'fill-opacity': 0.62,
                  }}
                />
                <Layer
                  id="district-line"
                  type="line"
                  paint={{
                    'line-color': '#e2e8f0',
                    'line-width': 1,
                  }}
                />
              </Source>
            ) : null}
          </MapLibreMap>

          <div style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(15,23,42,0.9)', padding: 14, borderRadius: 14, border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>Districts</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{districts.length}</div>
          </div>

          <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(15,23,42,0.9)', padding: 14, borderRadius: 14, border: '1px solid #1e293b', width: 260 }}>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>Selected District</div>
            {selected ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.name}</div>
                <div style={{ color: '#cbd5e1' }}>{selected.state}</div>
                <div style={{ marginTop: 8 }}>Score: {selected.score}</div>
                <div>Zone: {selected.zone}</div>
                <div>Updated: {selected.updated_at}</div>
              </>
            ) : (
              <div style={{ marginTop: 8, color: '#cbd5e1' }}>Click a district to inspect it.</div>
            )}
          </div>

          <div style={{ position: 'absolute', bottom: 14, left: 14, display: 'flex', gap: 10, background: 'rgba(15,23,42,0.92)', padding: 12, borderRadius: 999, border: '1px solid #1e293b' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: '#ef4444', display: 'inline-block' }} /> High risk</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: '#f59e0b', display: 'inline-block' }} /> Medium risk</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: '#22c55e', display: 'inline-block' }} /> Low risk</span>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <section style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 20, padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Alerts</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {alerts.length ? alerts.map((a) => (
                <div key={a.id} style={{ background: '#111827', borderRadius: 12, padding: 12, border: '1px solid #1f2937' }}>
                  <div style={{ color: '#fca5a5', fontWeight: 700 }}>{a.level}</div>
                  <div style={{ color: '#e5e7eb' }}>{a.message}</div>
                </div>
              )) : <div style={{ color: '#94a3b8' }}>No alerts yet.</div>}
            </div>
          </section>

          <section style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 20, padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Live Stats</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: '#111827', borderRadius: 14, padding: 12 }}>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>Tracked districts</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{districts.length}</div>
              </div>
              <div style={{ background: '#111827', borderRadius: 14, padding: 12 }}>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>Alerts</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{alerts.length}</div>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section style={{ marginTop: 16, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 20, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Risk Table</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {districts.map((d) => (
            <div
              key={d.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 1fr 0.6fr 0.6fr',
                gap: 10,
                padding: 12,
                borderRadius: 12,
                background: selected?.id === d.id ? '#1e293b' : '#111827',
                border: selected?.id === d.id ? '1px solid #60a5fa' : '1px solid #1f2937',
              }}
            >
              <span>{d.name}</span>
              <span>{d.state}</span>
              <span>{d.score}</span>
              <span>{d.zone}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}