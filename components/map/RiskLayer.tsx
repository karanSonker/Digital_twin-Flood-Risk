'use client';

import { useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { useControl } from '@vis.gl/react-maplibre';
import { ZONE_COLORS } from '@/lib/map';

function DeckOverlay(props: any) {
  useControl(() => new MapboxOverlay(props));
  return null;
}

export default function RiskLayer({ data, onSelect }: any) {
  const layer = useMemo(
    () =>
      new GeoJsonLayer({
        id: 'districts-layer',
        data,
        stroked: true,
        filled: true,
        pickable: true,
        getLineColor: [255, 255, 255, 180],
        lineWidthMinPixels: 1,
        getFillColor: (f: any) => ZONE_COLORS[f.properties.zone] || [100, 100, 100, 120],
        onClick: ({ object }: any) => {
          if (object) onSelect(object);
        },
      }),
    [data, onSelect]
  );

  return <DeckOverlay layers={[layer]} />;
}