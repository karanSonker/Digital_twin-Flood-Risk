'use client';

import { useEffect, useState } from 'react';
import type { AlertItem, DistrictSummary } from '@/lib/types';

type StreamSnapshot = {
  ts: string;
  districts: DistrictSummary[];
  alerts: AlertItem[];
};

export function useRiskStream() {
  const [snapshot, setSnapshot] = useState<StreamSnapshot | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/stream/risk');

    es.addEventListener('risk', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setSnapshot(data);
    });

    es.addEventListener('error', () => {
      es.close();
    });

    return () => es.close();
  }, []);

  return snapshot;
}