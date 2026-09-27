import { pool } from './db';

export async function getCachedGeocode(lat: number, lng: number) {
  const { rows } = await pool.query(
    `SELECT * FROM geocode_cache WHERE lat = $1 AND lng = $2 LIMIT 1`,
    [lat.toFixed(5), lng.toFixed(5)]
  );
  return rows[0] ?? null;
}

export async function setCachedGeocode(
  lat: number,
  lng: number,
  placeName: string | null,
  address: string | null,
  rawResponse: unknown
) {
  await pool.query(
    `
    INSERT INTO geocode_cache (lat, lng, place_name, address, raw_response)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (lat, lng) DO UPDATE
    SET place_name = EXCLUDED.place_name,
        address = EXCLUDED.address,
        raw_response = EXCLUDED.raw_response,
        cached_at = now()
    `,
    [lat.toFixed(5), lng.toFixed(5), placeName, address, rawResponse]
  );
}