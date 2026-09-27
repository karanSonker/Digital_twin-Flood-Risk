export type AlertSourceItem = {
  id: number;
  level: string;
  message: string;
};

export async function fetchLatestAlerts(): Promise<AlertSourceItem[]> {
  const url = process.env.ALERTS_API_URL;

  if (!url) {
    return [
      { id: 1, level: 'high', message: 'Heavy rainfall warning in upstream basin' },
    ];
  }

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Alerts fetch failed: ${res.status}`);

  return res.json();
}