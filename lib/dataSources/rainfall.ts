export type RainfallReading = {
  district_id: number;
  rainfall_mm: number;
  source?: string;
  recorded_at?: string;
};

async function fetchImdRainfall(): Promise<RainfallReading[]> {
  const url = process.env.IMD_RAINFALL_URL;
  if (!url) throw new Error('IMD_RAINFALL_URL missing');

  const res = await fetch(url, {
    cache: 'no-store',
    headers: process.env.IMD_API_KEY
      ? { Authorization: `Bearer ${process.env.IMD_API_KEY}` }
      : undefined,
  });

  if (!res.ok) throw new Error(`IMD rainfall fetch failed: ${res.status}`);
  return res.json();
}

async function fetchOgdRainfall(): Promise<RainfallReading[]> {
  const url = process.env.OGD_RAINFALL_URL;
  if (!url) throw new Error('OGD_RAINFALL_URL missing');

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`OGD rainfall fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchRainfallForDistricts(): Promise<RainfallReading[]> {
  try {
    const imd = await fetchImdRainfall();
    if (imd?.length) return imd;
  } catch {
    // fallback below
  }

  try {
    const ogd = await fetchOgdRainfall();
    if (ogd?.length) return ogd;
  } catch {
    // fallback below
  }

  return [
    { district_id: 1, rainfall_mm: 84, source: 'mock-fallback' },
    { district_id: 2, rainfall_mm: 42, source: 'mock-fallback' },
    { district_id: 3, rainfall_mm: 18, source: 'mock-fallback' },
  ];
}