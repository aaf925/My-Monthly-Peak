/**
 * Strava Monthly Pulse — Core Library (Stateless)
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.NEXT_PUBLIC_STRAVA_CLIENT_SECRET ?? '';
export const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI ?? 'https://aaviles.dev/strava';

export interface StravaTokenResponse {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    athlete: {
        id: number;
        username: string;
        firstname: string;
        lastname: string;
        profile_medium: string;
    };
}

export interface ActivityStats {
    totalDistance: number;
    totalTime: number;
    totalElevation: number;
    activityCount: number;
    avgSpeed: number;

    topActivity: {
        name: string;
        distance: number;
        elevation: number;
        date: string;
        polyline: string;
    } | null;

    bestPaceActivity: {
        name: string;
        speed: number;
        duration: number;
        date: string;
        type: string;
    } | null;

    topElevationActivity: {
        name: string;
        elevation: number;
        date: string;
    } | null;

    activeDays: number[];
    activeDaysCount: number; // NUEVO: Cantidad real de días en los que hubo 1+ actividades
    mostActiveDay: {
        date: string;
        distance: number;
    } | null;
    dominantSport: string;
    monthName: string;
    year: number;
    daysInMonth: number;
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

export function redirectToStravaAuth() {
    const url = new URL('https://www.strava.com/oauth/authorize');
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('redirect_uri', REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'read,activity:read_all');
    url.searchParams.set('approval_prompt', 'force');
    window.location.href = url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<StravaTokenResponse> {
    const res = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
        }),
    });
    if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
    return res.json();
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

/**
 * Escanea TODAS las actividades del usuario en Strava (páginas de 200) para 
 * descubrir en qué años y meses exactos ha tenido actividad.
 * Retorna un mapa: { Año: [array de meses del 0 al 11] }
 */
export async function fetchAvailableDates(accessToken: string): Promise<Record<number, number[]>> {
    let page = 1;
    const available: Record<number, Set<number>> = {};

    while (true) {
        const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!res.ok) break;
        const activities = await res.json();
        if (!activities || activities.length === 0) break;

        for (const act of activities) {
            if (!act.start_date) continue;
            const d = new Date(act.start_date_local || act.start_date);
            const y = d.getFullYear();
            const m = d.getMonth();
            if (!available[y]) available[y] = new Set();
            available[y].add(m);
        }

        if (activities.length < 200) break;
        page++;
    }

    const result: Record<number, number[]> = {};
    for (const y in available) {
        result[Number(y)] = Array.from(available[y]).sort((a, b) => a - b);
    }
    return result;
}

export async function fetchMonthlyActivities(
    accessToken: string,
    year: number,
    month: number // 0-11
): Promise<any[]> {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59);

    const res = await fetch(
        `https://www.strava.com/api/v3/athlete/activities` +
        `?after=${Math.floor(start.getTime() / 1000)}` +
        `&before=${Math.floor(end.getTime() / 1000)}` +
        `&per_page=100`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error('Failed to fetch activities');
    return res.json();
}

// ─── SVG Polyline Decoder ─────────────────────────────────────────────────────

export function decodePolyline(encoded: string): [number, number][] {
    const points: [number, number][] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
        let result = 0, shift = 0, b: number;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        lat += (result & 1 ? ~(result >> 1) : (result >> 1));

        result = 0; shift = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        lng += (result & 1 ? ~(result >> 1) : (result >> 1));

        points.push([lat / 1e5, lng / 1e5]);
    }
    return points;
}

export function polylineToSvgPath(points: [number, number][]): string {
    if (points.length < 2) return '';
    const lats = points.map(p => p[0]);
    const lngs = points.map(p => p[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const rangeL = maxLat - minLat || 1;
    const rangeG = maxLng - minLng || 1;

    const scale = Math.min(100 / rangeL, 100 / rangeG);
    const offsetX = (100 - rangeG * scale) / 2;
    const offsetY = (100 - rangeL * scale) / 2;

    // Render SVG stroke (invirtiendo el eje Y)
    return points
        .map(([lat, lng], i) => {
            const x = (lng - minLng) * scale + offsetX;
            const y = 100 - ((lat - minLat) * scale + offsetY);
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ');
}

// ─── Stat Processors ──────────────────────────────────────────────────────────

export const MONTH_NAMES_ES = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export const MONTH_NAMES_LONG_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function processMonthlyStats(
    activities: any[],
    year: number,
    month: number
): ActivityStats {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const base = {
        monthName: MONTH_NAMES_LONG_ES[month],
        year,
        daysInMonth,
        activeDays: [] as number[],
        activeDaysCount: 0,
    };

    if (!activities?.length) {
        return {
            ...base,
            totalDistance: 0, totalTime: 0, totalElevation: 0,
            activityCount: 0, avgSpeed: 0,
            topActivity: null, bestPaceActivity: null, topElevationActivity: null,
            mostActiveDay: null,
            dominantSport: 'Ninguno',
        };
    }

    let totalDistance = 0, totalTime = 0, totalElevation = 0, totalSpeed = 0;
    let epicActivity = activities[0];
    let fastestActivity = activities[0];
    let highestElevActivity = activities[0];
    const sportsCount: Record<string, number> = {};
    const activeDaysSet = new Set<number>();
    const dailyDistances: Record<string, number> = {};

    for (const act of activities) {
        totalDistance += act.distance ?? 0;
        totalTime += act.moving_time ?? 0;
        totalElevation += act.total_elevation_gain ?? 0;
        totalSpeed += act.average_speed ?? 0;

        const day = new Date(act.start_date_local ?? act.start_date).getDate();
        activeDaysSet.add(day); // Set elimina duplicados automáticamente. Si hoy saliste 3 veces, solo añade "24" una vez.

        const dateStr = act.start_date_local ? act.start_date_local.split('T')[0] : act.start_date.split('T')[0];
        dailyDistances[dateStr] = (dailyDistances[dateStr] || 0) + (act.distance ?? 0);

        const score = act.distance + (act.total_elevation_gain ?? 0) * 10;
        const topScore = epicActivity.distance + (epicActivity.total_elevation_gain ?? 0) * 10;
        if (score > topScore) epicActivity = act;

        if ((act.average_speed ?? 0) > (fastestActivity.average_speed ?? 0)) {
            fastestActivity = act;
        }

        if ((act.total_elevation_gain ?? 0) > (highestElevActivity.total_elevation_gain ?? 0)) {
            highestElevActivity = act;
        }

        sportsCount[act.type] = (sportsCount[act.type] ?? 0) + 1;
    }

    const dominantSport = Object.entries(sportsCount)
        .sort((a, b) => b[1] - a[1])[0][0];

    const fmtDate = (d: string) =>
        new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

    let maxDistDay = '';
    let maxDist = 0;
    for (const [date, dist] of Object.entries(dailyDistances)) {
        if (dist > maxDist) {
            maxDist = dist;
            maxDistDay = date;
        }
    }

    const mostActiveDay = maxDistDay ? {
        date: fmtDate(maxDistDay),
        distance: maxDist
    } : null;

    const activeDaysArray = Array.from(activeDaysSet).sort((a, b) => a - b);

    return {
        ...base,
        totalDistance,
        totalTime,
        totalElevation,
        activityCount: activities.length, // Total de sesiones
        avgSpeed: totalSpeed / activities.length,
        dominantSport,
        activeDays: activeDaysArray,
        activeDaysCount: activeDaysArray.length, // TOTAL REAL DE DÍAS ÚNICOS (max 31)
        mostActiveDay,

        topActivity: {
            name: epicActivity.name,
            distance: epicActivity.distance,
            elevation: epicActivity.total_elevation_gain ?? 0,
            date: fmtDate(epicActivity.start_date_local ?? epicActivity.start_date),
            polyline: epicActivity.map?.summary_polyline ?? '',
        },

        bestPaceActivity: fastestActivity.average_speed
            ? {
                name: fastestActivity.name,
                speed: fastestActivity.average_speed,
                duration: fastestActivity.moving_time,
                date: fmtDate(fastestActivity.start_date_local ?? fastestActivity.start_date),
                type: fastestActivity.type,
            }
            : null,

        topElevationActivity: highestElevActivity.total_elevation_gain
            ? {
                name: highestElevActivity.name,
                elevation: highestElevActivity.total_elevation_gain,
                date: fmtDate(highestElevActivity.start_date_local ?? highestElevActivity.start_date),
            }
            : null,
    };
}

export const formatDistance = (m: number) => (m / 1000).toFixed(1) + ' km';

export const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// Convierte m/s a ritmo (min/km)
export const formatPace = (speedInMetersPerSecond: number) => {
    if (!speedInMetersPerSecond || speedInMetersPerSecond === 0) return "0'00\"/km";
    const speedInKmPerHour = speedInMetersPerSecond * 3.6;
    const paceInMinutes = 60 / speedInKmPerHour;
    const minutes = Math.floor(paceInMinutes);
    const seconds = Math.floor((paceInMinutes - minutes) * 60);
    return `${minutes}'${seconds.toString().padStart(2, '0')}"/km`;
};

const LANDMARKS = [
    { name: 'el Teide', height: 3718 },
    { name: 'Mont Blanc', height: 4808 },
    { name: 'el Everest', height: 8849 },
    { name: 'la Torre Eiffel', height: 330 },
    { name: 'el de Tibidabo', height: 512 },
];

export function getElevationEquivalence(totalMeters: number): string {
    if (totalMeters === 0) return '0 metros';
    const landmark = LANDMARKS.find(l => totalMeters / l.height >= 0.3)
        ?? LANDMARKS[LANDMARKS.length - 1];
    const times = (totalMeters / landmark.height).toFixed(1);
    return `Subiste ${times}× ${landmark.name}`;
}
