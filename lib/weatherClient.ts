export async function fetchWeather(lat: number, lng: number) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set('hourly', 'rain');
  url.searchParams.set('forecast_days', '1');

  const res = await fetch(url.toString());
  return res.json();
}