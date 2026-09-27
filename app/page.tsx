'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Map as MapLibreMap, Source, Layer, Popup } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiGet } from '@/lib/api';
import type { DistrictDetail, DistrictSummary, AlertItem } from '@/lib/types';
import { computeRiskScore } from '@/lib/riskEngine';

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
  const [popupCoords, setPopupCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [trends, setTrends] = useState<any>(null);
  const [sim, setSim] = useState({ rainfallPct: 0, riverOffset: 0, floodDelta: 0 });

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

  function getSituationExplanation(d: DistrictDetail): string {
    const components = d.components || {};
    const rainfall = components.rainfall_mm ?? 0;
    const river = components.river_level ?? 0;
    const floods = components.historical_floods ?? 0;
    const sev = components.alert_severity ?? 0;

    if (d.zone === 'red') {
      return `🔴 CRITICAL: High flood risk. Rainfall at ${rainfall}mm, river level at ${river}m. ${floods > 2 ? `Historically flood-prone (${floods} past events).` : ''} Immediate monitoring required.`;
    }
    if (d.zone === 'yellow') {
      return `🟡 MODERATE: Elevated flood risk. Rainfall at ${rainfall}mm, river level at ${river}m. ${floods > 1 ? `${floods} historical flood events on record.` : ''} Stay vigilant.`;
    }
    return `🟢 LOW: Minimal flood risk. Rainfall at ${rainfall}mm, river level at ${river}m. Conditions are stable.`;
  }

  return (
    <main style={{ minHeight: '100vh', background: '#07111f', color: '#e5eefb', padding: 16, fontFamily: 'Inter, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Flood Risk Digital Twin</h1>
          <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>
            Live district risk monitoring, alerts, and map intelligence.
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
            initialViewState={{ longitude: 78.9629, latitude: 20.5937, zoom: 4.2 }}
            mapStyle="https://demotiles.maplibre.org/style.json"
            style={{ width: '100%', height: '100%' }}
            interactiveLayerIds={['district-fill', 'district-line']}
            onClick={(e: any) => {
              // Query features at the clicked point
              const features = e.target?.queryRenderedFeatures?.(e.point) || [];
              const feature = features.find(
                (f: any) => f.layer?.id === 'district-fill' || f.layer?.id === 'district-line'
              );
              if (!feature) return;
              const id = feature.properties?.id;
              if (!id) return;
              apiGet<DistrictDetail>(`/api/risk/${id}`).then((detail) => {
                setSelected(detail);
                setPopupCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat });
              });
              apiGet(`/api/trends/${id}`).then(setTrends).catch(() => setTrends(null));
            }}
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

            {selected && popupCoords ? (
              <Popup
                longitude={popupCoords.lng}
                latitude={popupCoords.lat}
                anchor="bottom"
                onClose={() => setPopupCoords(null)}
                style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 0, color: '#e5eefb', fontFamily: 'Inter, sans-serif' }}
                maxWidth="320px"
              >
                <div style={{ padding: 12, minWidth: 240 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.name}</div>
                  <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>{selected.state}</div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Score</div>
                      <div style={{
                        fontSize: 22, fontWeight: 700,
                        color: selected.zone === 'red' ? '#ef4444' : selected.zone === 'yellow' ? '#f59e0b' : '#22c55e',
                      }}>{selected.score}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Zone</div>
                      <div style={{
                        fontSize: 16, fontWeight: 600, textTransform: 'capitalize',
                        color: selected.zone === 'red' ? '#ef4444' : selected.zone === 'yellow' ? '#f59e0b' : '#22c55e',
                      }}>{selected.zone}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.5, color: '#cbd5e1', borderTop: '1px solid #1e293b', paddingTop: 8 }}>
                    {getSituationExplanation(selected)}
                  </div>
                  {selected.components && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 11, color: '#94a3b8', borderTop: '1px solid #1e293b', paddingTop: 8 }}>
                      <span>🌧️ {selected.components.rainfall_mm ?? '?'}mm</span>
                      <span>🌊 {selected.components.river_level ?? '?'}m</span>
                      <span>📊 {selected.components.historical_floods ?? '?'} floods</span>
                    </div>
                  )}
                </div>
              </Popup>
            ) : null}
          </MapLibreMap>

          <div style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(15,23,42,0.9)', padding: 14, borderRadius: 14, border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>Districts</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{districts.length}</div>
          </div>

          <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(15,23,42,0.9)', padding: 14, borderRadius: 14, border: '1px solid #1e293b', width: 260, maxHeight: 'calc(100% - 80px)', overflowY: 'auto' }}>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>Selected District</div>
            {selected ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{selected.name}</div>
                <div style={{ color: '#cbd5e1', fontSize: 13 }}>{selected.state}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
                  <div><span style={{ color: '#94a3b8' }}>Score:</span> <strong style={{ color: selected.zone === 'red' ? '#ef4444' : selected.zone === 'yellow' ? '#f59e0b' : '#22c55e' }}>{selected.score}</strong></div>
                  <div><span style={{ color: '#94a3b8' }}>Zone:</span> {selected.zone}</div>
                </div>

                {/* Trends comparison */}
                {trends?.risk ? (
                  <div style={{ marginTop: 10, padding: 10, background: '#111827', borderRadius: 10, border: '1px solid #1f2937', fontSize: 12 }}>
                    <div style={{ color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>📈 30-Day Trend</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                      <span>Avg score: {trends.risk.avg}</span>
                      <span style={{ color: trends.risk.avg >= 70 ? '#ef4444' : trends.risk.avg >= 40 ? '#f59e0b' : '#22c55e' }}>{trends.risk.avg >= 70 ? '🔴' : trends.risk.avg >= 40 ? '🟡' : '🟢'} {trends.risk.avg}</span>
                    </div>
                    <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                      Range: {trends.risk.min} – {trends.risk.max} | {trends.risk.readings} readings
                    </div>
                    {selected.score > trends.risk.avg * 1.2 && (
                      <div style={{ color: '#fca5a5', fontSize: 11, marginTop: 4 }}>
                        ⚠️ Score is {(selected.score / trends.risk.avg - 1) * 100 > 0 ? `+${Math.round((selected.score / trends.risk.avg - 1) * 100)}%` : ''} above average
                      </div>
                    )}
                    {selected.score < trends.risk.avg * 0.8 && (
                      <div style={{ color: '#86efac', fontSize: 11, marginTop: 4 }}>
                        ✅ Score is {Math.round((1 - selected.score / trends.risk.avg) * 100)}% below average
                      </div>
                    )}
                  </div>
                ) : null}

                {/* What-If Simulator */}
                <div style={{ marginTop: 10, padding: 10, background: '#111827', borderRadius: 10, border: '1px solid #1f2937', fontSize: 12 }}>
                  <div style={{ color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>🔮 What-If Simulator</div>

                  <div style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                      <span>Rainfall</span>
                      <span>{sim.rainfallPct > 0 ? '+' : ''}{sim.rainfallPct}%</span>
                    </div>
                    <input type="range" min="-50" max="50" value={sim.rainfallPct}
                      onChange={(e) => setSim({ ...sim, rainfallPct: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: '#60a5fa' }} />
                  </div>

                  <div style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                      <span>River level</span>
                      <span>{sim.riverOffset > 0 ? '+' : ''}{sim.riverOffset}m</span>
                    </div>
                    <input type="range" min="-1" max="2" step="0.1" value={sim.riverOffset}
                      onChange={(e) => setSim({ ...sim, riverOffset: parseFloat(e.target.value) })}
                      style={{ width: '100%', accentColor: '#60a5fa' }} />
                  </div>

                  <div style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                      <span>Flood count</span>
                      <span>{sim.floodDelta > 0 ? '+' : ''}{sim.floodDelta}</span>
                    </div>
                    <input type="range" min="0" max="5" step="1" value={sim.floodDelta}
                      onChange={(e) => setSim({ ...sim, floodDelta: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: '#60a5fa' }} />
                  </div>

                  {(() => {
                    const components = selected.components || {};
                    const base = {
                      rainfall_mm: components.rainfall_mm ?? 0,
                      river_level: components.river_level ?? 0,
                      historical_floods: (components.historical_floods ?? 0) + sim.floodDelta,
                      alert_severity: components.alert_severity ?? 1,
                    };
                    const modified = {
                      ...base,
                      rainfall_mm: Math.round(base.rainfall_mm * (1 + sim.rainfallPct / 100) * 10) / 10,
                      river_level: Math.max(0, Math.round((base.river_level + sim.riverOffset) * 100) / 100),
                    };
                    const result = computeRiskScore(modified);
                    const zoneColor = result.zone === 'red' ? '#ef4444' : result.zone === 'yellow' ? '#f59e0b' : '#22c55e';
                    const changed = result.score !== selected.score || result.zone !== selected.zone;
                    return (
                      <div style={{ marginTop: 8, padding: 8, background: '#0f172a', borderRadius: 8, border: changed ? `1px solid ${zoneColor}` : '1px solid transparent' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>Predicted</span>
                          <strong style={{ color: zoneColor, fontSize: 16 }}>{result.score} · {result.zone}</strong>
                        </div>
                        {changed && (
                          <div style={{ color: '#fca5a5', fontSize: 11, marginTop: 4 }}>
                            ⚡ Change from {selected.score} ({selected.zone})
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
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
              onClick={() => {
                apiGet<DistrictDetail>(`/api/risk/${d.id}`).then((detail) => {
                  setSelected(detail);
                });
                apiGet(`/api/trends/${d.id}`).then(setTrends).catch(() => setTrends(null));
              }}
              style={{
                cursor: 'pointer',
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