/**
 * Récords personales — Escanea todo el histórico de Strava una vez y calcula
 * los mejores meses por distancia, desnivel, días activos y nº de actividades.
 */

export interface MonthTotals {
    year: number;
    month: number; // 0-11
    distance: number;
    elevation: number;
    activityCount: number;
    activeDays: number;
}

export interface PersonalRecords {
    bestDistanceMonth: MonthTotals | null;
    bestElevationMonth: MonthTotals | null;
    bestActiveDaysMonth: MonthTotals | null;
    bestActivityCountMonth: MonthTotals | null;
}

/**
 * Escanea TODAS las actividades (paginado de 200) y agrega totales por mes.
 * Reutiliza el mismo patrón que fetchAvailableDates en strava.ts.
 */
export async function scanAllMonthlyTotals(accessToken: string): Promise<MonthTotals[]> {
    const map = new Map<string, MonthTotals & { _days: Set<number> }>();

    let page = 1;
    while (true) {
        const res = await fetch(
            `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) break;

        const activities = await res.json();
        if (!activities || activities.length === 0) break;

        for (const act of activities) {
            if (!act.start_date) continue;
            const d = new Date(act.start_date_local || act.start_date);
            const key = `${d.getFullYear()}-${d.getMonth()}`;

            let entry = map.get(key);
            if (!entry) {
                entry = { year: d.getFullYear(), month: d.getMonth(), distance: 0, elevation: 0, activityCount: 0, activeDays: 0, _days: new Set<number>() };
                map.set(key, entry);
            }
            entry.distance += act.distance ?? 0;
            entry.elevation += act.total_elevation_gain ?? 0;
            entry.activityCount += 1;
            entry._days.add(d.getDate());
        }

        if (activities.length < 200) break;
        page++;
    }

    return Array.from(map.values())
        .map(({ _days, ...rest }) => ({ ...rest, activeDays: _days.size }))
        .sort((a, b) => (a.year - b.year) || (a.month - b.month));
}

export function computePersonalRecords(totals: MonthTotals[]): PersonalRecords {
    const best = (key: keyof Pick<MonthTotals, "distance" | "elevation" | "activeDays" | "activityCount">) =>
        totals.reduce<MonthTotals | null>((acc, m) => {
            if (!acc || m[key] > acc[key]) return m;
            return acc;
        }, null);

    return {
        bestDistanceMonth: best("distance"),
        bestElevationMonth: best("elevation"),
        bestActiveDaysMonth: best("activeDays"),
        bestActivityCountMonth: best("activityCount"),
    };
}