INSERT INTO districts (name, state, geom)
VALUES
('District 1', 'State 1', ST_Multi(ST_GeomFromText('POLYGON((77 28,77.5 28,77.5 28.5,77 28.5,77 28))', 4326))),
('District 2', 'State 2', ST_Multi(ST_GeomFromText('POLYGON((72 19,72.4 19,72.4 19.4,72 19.4,72 19))', 4326))),
('District 3', 'State 3', ST_Multi(ST_GeomFromText('POLYGON((85 23,85.4 23,85.4 23.4,85 23.4,85 23))', 4326)))
ON CONFLICT DO NOTHING;

INSERT INTO alerts (level, message)
VALUES ('high', 'Heavy rainfall warning in upstream basin');

INSERT INTO risk_scores (district_id, score, zone, components)
VALUES
(1, 88, 'red', '{"rainfall_mm":84,"river_level":2.8,"historical_floods":3,"alert_severity":3}'),
(2, 56, 'yellow', '{"rainfall_mm":42,"river_level":1.9,"historical_floods":2,"alert_severity":2}'),
(3, 24, 'green', '{"rainfall_mm":18,"river_level":0.7,"historical_floods":1,"alert_severity":0}');