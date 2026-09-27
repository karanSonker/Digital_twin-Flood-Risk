export type RiskZone = 'red' | 'yellow' | 'green';

export type DistrictSummary = {
  id: number;
  name: string;
  state: string;
  score: number;
  zone: RiskZone;
  updated_at: string;
};

export type DistrictDetail = {
  id: number;
  name: string;
  state: string;
  score: number;
  zone: RiskZone;
  components: Record<string, number>;
  updated_at: string;
};

export type AlertItem = {
  id: number;
  level: string;
  message: string;
  created_at: string;
};