export type BoundaryFeature = {
  type: 'Feature';
  properties: {
    id: number;
    name: string;
    state: string;
  };
  geometry: {
    type: string;
    coordinates: any;
  };
};

export async function fetchBoundaryFeed() {
  const url =
    process.env.DISTRICT_BOUNDARY_URL ||
    'https://raw.githubusercontent.com/datameet/maps/master/Districts/districts.geojson';

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Boundary fetch failed: ${res.status}`);

  return res.json();
}