import { scanAllMonthlyTotals, type MonthTotals } from "@/lib/records";

/**
 * Insights PRO — Tendencias, meta anual y zonas de esfuerzo.
 * Reutiliza scanAllMonthlyTotals (una sola pasada sobre el histórico).
 */

export interface MonthPoint {
    year: number;
    month: number; // 0-11
    distanceKm: number;
    elevationM: number;
    label: string;
}

export interface EffortZones {
    z1: number; // minutos en zona 1 (recuperación)
    z2: number;
    z3: number;
    z4: number;
    z5: number;
    totalMin: number;
    distributionPct: number[]; // [z1..z5] en %
}

const HR_ZONE_THRESHOLDS = [0.6, 0.7, 0.8, 0.9]; // % de FC máx

/**
 * Últimos N meses con distancia/desnivel (excluye el mes actual si es parcial).
 */
export function getTrend(totals: MonthTotals[], months = 6): MonthPoint[] {
    const sorted = [...totals].sort((a, b) => a.year - b.year || a.month - b.month);
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${now.getMonth()}`;

    return sorted
        .filter((m) => `${m.year}-${m.month}` !== currentKey) // mes actual parcial
        .slice(-months)
        .map((m) => ({
            year: m.year,
            month: m.month,
            distanceKm: Math.round((m.distance / 1000) * 10) / 10,
            elevationM: Math.round(m.elevation),
            label: new Date(m.year, m.month, 1).toLocaleDateString("es-ES", { month: "short" }),
        }));
}

/**
 * Progreso del año: km acumulados hasta hoy + meta configurada.
 */
export function getYearProgress(
    totals: MonthTotals[],
    year: number,
    goalKm: number | null
): { year: number; currentKm: number; goalKm: number | null; percent: number | null } {
    const yearTotal = totals
        .filter((m) => m.year === year)
        .reduce((acc, m) => acc + m.distance, 0);
    const currentKm = Math.round((yearTotal / 1000) * 10) / 10;

    if (!goalKm || goalKm <= 0) {
        return { year, currentKm, goalKm: null, percent: null };
    }
    return {
        year,
        currentKm,
        goalKm,
        percent: Math.min(100, Math.round((currentKm / goalKm) * 100)),
    };
}

/**
 * Zonas de esfuerzo a partir de las actividades del mes.
 * Simplificación: asigna cada actividad a una zona según su pulsación media
 * respecto a la FC máxima del usuario (pasada como parámetro o estimada).
 */
export function computeEffortZones(
    activities: any[],
    maxHeartRate: number | null
): EffortZones {
    const hrmax = maxHeartRate ?? 190; // estimación por defecto
    const zones = [0, 0, 0, 0, 0];

    for (const act of activities) {
        const hr = act.average_heartrate ?? act.average_heartrate ?? null;
        const timeMin = (act.moving_time ?? 0) / 60;
        if (!hr || hr <= 0 || timeMin <= 0) continue;

        const ratio = hr / hrmax;
        let zone = 0; // z1
        for (let i = 0; i < HR_ZONE_THRESHOLDS.length; i++) {
            if (ratio >= HR_ZONE_THRESHOLDS[i]) zone = i + 1;
        }
        zones[zone] += timeMin;
    }

    const totalMin = zones.reduce((a, b) => a + b, 0);
    const distributionPct = totalMin > 0 ? zones.map((z) => Math.round((z / totalMin) * 100)) : [0, 0, 0, 0, 0];

    return { z1: Math.round(zones[0]), z2: Math.round(zones[1]), z3: Math.round(zones[2]), z4: Math.round(zones[3]), z5: Math.round(zones[4]), totalMin: Math.round(totalMin), distributionPct };
}