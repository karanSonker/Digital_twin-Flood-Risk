'use client';

import { create } from 'zustand';
import type { DistrictDetail, DistrictSummary } from '@/lib/types';

type DashboardState = {
  districts: DistrictSummary[];
  selected: DistrictDetail | null;
  setDistricts: (districts: DistrictSummary[]) => void;
  setSelected: (district: DistrictDetail | null) => void;
};

export const useDashboardStore = create<DashboardState>((set) => ({
  districts: [],
  selected: null,
  setDistricts: (districts) => set({ districts }),
  setSelected: (selected) => set({ selected }),
}));