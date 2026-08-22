import { getPrisma } from "@/lib/db";

/**
 * True Effort — Ajusta el ritmo real de una actividad según el clima del día.
 *
 * Fuente de clima: Open-Meteo (gratis, sin API key).
 * - Archive API: datos históricos por coordenadas y fecha.
 * - Corregimos el ritmo con viento y temperatura (modelo simplificado basado
 *   en la literatura de rendimiento en running).
 */

export interface WeatherData {
    temperatureC: number | null;
    windSpeedKmh: number | null;
    windDirectionDeg: number | null;
}

interface OpenMeteoArchiveResponse {
    hourly?: {
        time: string[];
        temperature_2m: (number | null)[];
        wind_speed_10m: (number | null)[];
        wind_direction_10m?: (number | null)[];
    };
}

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

export async function fetchWeather(
    lat: number,
    lng: number,
    startDate: string,
    endDate: string
): Promise<WeatherData> {
    const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lng),
        start_date: startDate,
        end_date: endDate,
        hourly: "temperature_2m,wind_speed_10m,wind_direction_10m",
    });

    const res = await fetch(`${ARCHIVE_URL}?${params.toString()}`, {
        headers: { Accept: "application/json" },
    });

    if (!res.ok) {
        throw new Error(`Open-Meteo error: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as OpenMeteoArchiveResponse;
    const hourly = json.hourly;

    if (!hourly?.time?.length) {
        throw new Error("Open-Meteo no devolvió datos horarios");
    }

    // Media de todo el rango (simplificación razonable para un resumen mensual)
    const temps = hourly.temperature_2m.filter((v): v is number => v !== null && v !== undefined);
    const winds = hourly.wind_speed_10m.filter((v): v is number => v !== null && v !== undefined);
    const dirs = hourly.wind_direction_10m?.filter((v): v is number => v !== null && v !== undefined);

    return {
        temperatureC: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null,
        windSpeedKmh: winds.length ? winds.reduce((a, b) => a + b, 0) / winds.length : null,
        windDirectionDeg: dirs?.length ? dirs.reduce((a, b) => a + b, 0) / dirs.length : null,
    };
}

/**
 * Ritmo ajustado (pace en seg/km) a partir del ritmo real y el clima.
 *
 * Modelo simplificado:
 * - Temperatura: penalización no lineal (a partir de ~15°C empieza a costar).
 * - Viento: penalización si el viento es de cara (~10km/h o más); ligera ayuda si es a favor.
 * Devuelve null si no hay datos suficientes de clima.
 */
export function computeTrueEffortPaceSecPerKm(
    realPaceSecPerKm: number,
    weather: WeatherData
): number | null {
    if (weather.temperatureC === null && weather.windSpeedKmh === null) return null;

    let factor = 1.0;

    // Temperatura
    if (weather.temperatureC !== null) {
        const t = weather.temperatureC;
        if (t > 15) factor *= 1 + (t - 15) * 0.012; // +1.2% por cada °C sobre 15°C
        else if (t < 5) factor *= 1 + (5 - t) * 0.008; // frío extremo también penaliza
    }

    // Viento (asumimos que sopla en contra como peor caso, sin rumbo del atleta)
    if (weather.windSpeedKmh !== null) {
        const w = weather.windSpeedKmh;
        if (w >= 15) factor *= 1 + (w - 15) * 0.006; // +0.6% por cada km/h sobre 15 km/h
        else if (w >= 10) factor *= 1.02;
        // vientos suaves no penalizan
    }

    return Math.round(realPaceSecPerKm * factor);
}

/**
 * Calcula el True Effort de una actividad cacheada:
 * - Obtiene lat/lng y fecha de la actividad.
 * - Consulta el clima del día en Open-Meteo.
 * - Ajusta el ritmo y lo guarda en `CachedActivity.trueEffortPace`.
 */
export async function computeTrueEffortForActivity(cachedActivityId: string): Promise<number | null> {
    const prisma = getPrisma();
    const activity = await prisma.cachedActivity.findUnique({
        where: { id: cachedActivityId },
    });

    if (!activity) throw new Error("Actividad no encontrada");
    if (!activity.startDate) throw new Error("La actividad no tiene fecha");
    if (!activity.startLat || !activity.startLng) {
        throw new Error("La actividad no tiene coordenadas de inicio");
    }

    const d = activity.startDate;
    const startDate = d.toISOString().slice(0, 10);
    const endDate = startDate;

    const weather = await fetchWeather(activity.startLat, activity.startLng, startDate, endDate);

    // Ritmo real: average_speed (m/s) → pace (s/km)
    const realPace = activity.averageSpeed > 0 ? 1000 / activity.averageSpeed : 0;
    if (realPace === 0) return null;

    const trueEffort = computeTrueEffortPaceSecPerKm(realPace, weather);

    if (trueEffort !== null) {
        await prisma.cachedActivity.update({
            where: { id: cachedActivityId },
            data: { trueEffortPace: trueEffort },
        });
    }

    return trueEffort;
}