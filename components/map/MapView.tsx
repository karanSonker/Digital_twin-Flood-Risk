'use client';

import { useEffect, useMemo, useState } from 'react';
import { Map as MapLibreMap, Source, Layer } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiGet } from '@/lib/api';
import { useRiskStream } from '@/hooks/useRiskStream';
import type { DistrictDetail, DistrictSummary } from '@/lib/types';
import { useDashboardStore } from '@/lib/store';

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

const zoneFill: any = {
  id: 'zone-fill',
  type: 'fill',
  paint: {
    'fill-color': [
      'match',
      ['get', 'zone'],
      'red',
      '#dc2626',
      'yellow',
      '#f59e0b',
      'green',
      '#16a34a',
      '#94a3b8',
    ],
    'fill-opacity': 0.6,
  },
};

const zoneLine: any = {
  id: 'zone-line',
  type: 'line',
  paint: {
    'line-color': '#ffffff',
    'line-width': 1,
  },
};

export default function MapView() {
  const stream = useRiskStream();
  const districts = useDashboardStore((s) => s.districts);
  const setSelected = useDashboardStore((s) => s.setSelected);
  const setDistricts = useDashboardStore((s) => s.setDistricts);
  const [geojson, setGeojson] = useState<DistrictGeoJson | null>(null);

  useEffect(() => {
    fetch('/data/districts.geojson')
      .then((r) => r.json())
      .then(setGeojson)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (stream?.districts) setDistricts(stream.districts);
  }, [stream, setDistricts]);

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
    sessionStorage.setItem('selected_district_id', String(id));
  }

  const initialViewState = useMemo(
    () => ({
      longitude: 78.9629,
      latitude: 20.5937,
      zoom: 4.2,
    }),
    []
  );

  return (
    <div className="map-view" id="map" style={{ position: 'relative' }}>
      <MapLibreMap
        initialViewState={initialViewState}
        mapStyle="https://demotiles.maplibre.org/style.json"
        style={{ width: '100%', height: '100%' }}
        onClick={handleClick}
      >
        {enrichedGeojson ? (
          <Source id="districts" type="geojson" data={enrichedGeojson}>
            <Layer {...zoneFill} />
            <Layer {...zoneLine} />
          </Source>
        ) : null}
      </MapLibreMap>

      <div className="map-overlay" style={{ position: 'absolute', top: 16, left: 16, background: 'white', padding: 12, borderRadius: 12 }}>
        <div>Last update: {stream?.ts ?? 'waiting...'}</div>
        <div>Districts: {districts.length}</div>
      </div>
    </div>
  );
}