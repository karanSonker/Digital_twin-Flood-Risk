export type RiverLevelReading = {
  district_id: number;
  river_level: number;
  source?: string;
};

export async function fetchRiverLevels(): Promise<RiverLevelReading[]> {
  const url = process.env.RIVER_LEVELS_API_URL;

  if (!url) {
    return [
      { district_id: 1, river_level: 2.8, source: 'mock' },
      { district_id: 2, river_level: 1.9, source: 'mock' },
      { district_id: 3, river_level: 0.7, source: 'mock' },
    ];
  }

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`River levels fetch failed: ${res.status}`);

  return res.json();
}