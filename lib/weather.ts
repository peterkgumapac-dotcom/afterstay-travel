import type { WeatherDay } from './types';

const WEATHER_BASE = 'https://api.weatherapi.com/v1';

export async function getForecast(
  destination: string,
  days: number = 5
): Promise<WeatherDay[]> {
  const key = process.env.EXPO_PUBLIC_WEATHER_API_KEY;
  if (!key) throw new Error('Weather API key missing.');
  const url = `${WEATHER_BASE}/forecast.json?key=${key}&q=${encodeURIComponent(destination)}&days=${days}&aqi=no&alerts=no`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.forecast?.forecastday ?? []).map((d: any): WeatherDay => ({
    date: d.date,
    maxTemp: d.day.maxtemp_c,
    minTemp: d.day.mintemp_c,
    condition: d.day.condition.text,
    icon: d.day.condition.icon.startsWith('//') ? `https:${d.day.condition.icon}` : d.day.condition.icon,
    chanceOfRain: d.day.daily_chance_of_rain,
  }));
}
