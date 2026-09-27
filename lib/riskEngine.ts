export type RiskInput = {
  rainfall_mm: number;
  river_level: number;
  historical_floods: number;
  alert_severity: number;
};

export function computeRiskScore(input: RiskInput) {
  const score =
    input.rainfall_mm * 0.35 +
    input.river_level * 22 +
    input.historical_floods * 8 +
    input.alert_severity * 12;

  const capped = Math.max(0, Math.min(100, Math.round(score)));
  const zone = capped >= 70 ? 'red' : capped >= 40 ? 'yellow' : 'green';

  return { score: capped, zone };
}