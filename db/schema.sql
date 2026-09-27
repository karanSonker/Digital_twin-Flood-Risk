CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS districts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  centroid geometry(Point, 4326),
  area_sqkm NUMERIC(12,2),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rainfall_readings (
  id SERIAL PRIMARY KEY,
  district_id INT REFERENCES districts(id),
  rainfall_mm NUMERIC(10,2) NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS river_levels (
  id SERIAL PRIMARY KEY,
  district_id INT REFERENCES districts(id),
  level_m NUMERIC(10,2) NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS risk_scores (
  id SERIAL PRIMARY KEY,
  district_id INT REFERENCES districts(id),
  score INT NOT NULL,
  zone TEXT NOT NULL,
  components JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT now()
);




CREATE INDEX IF NOT EXISTS idx_districts_geom ON districts USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_risk_scores_district_time ON risk_scores (district_id, timestamp DESC);