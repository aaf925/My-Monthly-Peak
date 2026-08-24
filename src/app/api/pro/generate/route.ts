import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { findOrCreateUserFromCookie, ProRequiredError } from "@/lib/plans";
import { fetchMonthlyActivities } from "@/lib/strava";
import { getValidStravaToken } from "@/lib/strava-session";
import { computeTrueEffortForActivity } from "@/lib/true-effort";
import { generateInsight, type InsightKind } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("strava_session")?.value;
        const user = await findOrCreateUserFromCookie(sessionCookie);
        if (!user) throw new ProRequiredError("No autenticado", 401);

        // ── Requiere plan PRO ──
        if (user.plan !== "PRO") {
            throw new ProRequiredError("Esta función requiere el plan PRO.");
        }

        const body = (await req.json().catch(() => ({}))) as {
            year?: number;
            month?: number; // 0-11
            kind?: InsightKind;
            type?: string; // tipo de actividad: "Run", "Ride", "Swim", etc.
        };

        const year = body.year ?? new Date().getFullYear();
        const month = body.month ?? new Date().getMonth();
        if (month < 0 || month > 11) throw new ProRequiredError("Mes inválido", 400);

        const prisma = getPrisma();
        // Token válido (refresca automáticamente si caducó)
        const accessToken = await getValidStravaToken(user.id);

        // 1. Traer actividades del mes desde Strava
        let activities = await fetchMonthlyActivities(accessToken, year, month);

        // 1b. Filtrar por tipo de actividad si se especifica (Run/Ride/Swim/...).
        //     No mezclar disciplinas: si no se indica tipo, usamos el dominante.
        let selectedType = body.type;
        if (!selectedType && activities.length > 0) {
            const counts: Record<string, number> = {};
            for (const a of activities) counts[a.type] = (counts[a.type] ?? 0) + 1;
            selectedType = Object.entries(counts).sort((x, y) => y[1] - x[1])[0][0];
        }
        if (selectedType) {
            activities = activities.filter((a) => a.type === selectedType);
        }
        if (activities.length === 0) {
            return NextResponse.json({
                ok: true,
                trueEffortPace: null,
                insight: "No hay actividades de este tipo en el mes seleccionado.",
                cachedActivities: 0,
            });
        }

        // 2. Cachearlas en CachedActivity (upsert por stravaActivityId)
        const cachedIds: string[] = [];
        for (const act of activities) {
            const saved = await prisma.cachedActivity.upsert({
                where: { stravaActivityId: BigInt(act.id) },
                create: {
                    userId: user.id,
                    stravaActivityId: BigInt(act.id),
                    name: act.name ?? "Actividad",
                    type: act.type ?? "Run",
                    distance: act.distance ?? 0,
                    movingTime: act.moving_time ?? 0,
                    totalElevationGain: act.total_elevation_gain ?? 0,
                    averageSpeed: act.average_speed ?? 0,
                    startDate: new Date(act.start_date_local ?? act.start_date),
                    startDateLocal: act.start_date_local ? new Date(act.start_date_local) : null,
                    summaryPolyline: act.map?.summary_polyline ?? null,
                    startLat: act.start_latlng?.[0] ?? null,
                    startLng: act.start_latlng?.[1] ?? null,
                    averageHeartrate: act.average_heartrate ?? null,
                },
                update: {
                    name: act.name ?? undefined,
                    type: act.type ?? undefined,
                    distance: act.distance ?? undefined,
                    movingTime: act.moving_time ?? undefined,
                    totalElevationGain: act.total_elevation_gain ?? undefined,
                    averageSpeed: act.average_speed ?? undefined,
                    startDate: new Date(act.start_date_local ?? act.start_date),
                    startDateLocal: act.start_date_local ? new Date(act.start_date_local) : null,
                    summaryPolyline: act.map?.summary_polyline ?? undefined,
                    startLat: act.start_latlng?.[0] ?? undefined,
                    startLng: act.start_latlng?.[1] ?? undefined,
                    averageHeartrate: act.average_heartrate ?? undefined,
                },
            });
            cachedIds.push(saved.id);
        }

        // 3. True Effort: calcular el ritmo ajustado de la primera actividad con coordenadas
        let trueEffortPace: number | null = null;
        for (const id of cachedIds) {
            try {
                const result = await computeTrueEffortForActivity(id);
                if (result !== null) {
                    trueEffortPace = result;
                    break;
                }
            } catch {
                // sigue con la siguiente actividad
            }
        }

        // 4. IA: roast o resumen mensual
        const monthName = new Date(year, month, 1).toLocaleDateString("es-ES", { month: "long" });
        const totals = activities.reduce(
            (acc, a) => {
                acc.distance += a.distance ?? 0;
                acc.elevation += a.total_elevation_gain ?? 0;
                acc.speed += a.average_speed ?? 0;
                acc.hr += a.average_heartrate ?? 0;
                acc.hrCount += a.average_heartrate ? 1 : 0;
                return acc;
            },
            { distance: 0, elevation: 0, speed: 0, hr: 0, hrCount: 0 }
        );

        const kind = body.kind ?? "summary";
        const avgSpeedMps = totals.speed / Math.max(activities.length, 1);
        // average_speed de Strava viene en m/s → ritmo en seg por unidad de distancia
        const isSwim = selectedType === "Swim";
        const paceUnit = isSwim ? 100 : 1000; // natación: /100m · resto: /km
        const avgPaceSec = avgSpeedMps > 0 ? paceUnit / avgSpeedMps : null;
        // Formato "MM:SS" (ej. 5:42 min/km · 1:50 min/100m en natación)
        const formatPace = (sec: number | null) => {
            if (!sec) return null;
            const m = Math.floor(sec / 60);
            const s = Math.round(sec % 60);
            return `${m}:${s.toString().padStart(2, "0")}`;
        };
        const insight = await generateInsight({
            kind,
            lang: "es",
            userName: user.name ?? "Atleta",
            monthName,
            year,
            activityCount: activities.length,
            activeDays: new Set(
                activities.map((a) => new Date(a.start_date_local ?? a.start_date).getDate())
            ).size,
            distanceKm: Math.round((totals.distance / 1000) * 10) / 10,
            elevationM: Math.round(totals.elevation),
            avgPace: formatPace(avgPaceSec),
            avgHeartrate: totals.hrCount ? Math.round(totals.hr / totals.hrCount) : null,
            dominantSport: selectedType ?? "Run",
            paceUnit: isSwim ? "min/100m" : "min/km",
            hasTrueEffort: trueEffortPace !== null,
        });

        // Guardar roastText en las actividades cacheadas
        if (kind === "summary") {
            await prisma.cachedActivity.updateMany({
                where: { id: { in: cachedIds } },
                data: { roastText: insight },
            });
        }

        return NextResponse.json({
            ok: true,
            trueEffortPace,
            insight,
            cachedActivities: cachedIds.length,
        });
    } catch (err) {
        if (err instanceof ProRequiredError) {
            return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
        }
        console.error("generatePro error:", err);
        return NextResponse.json(
            { ok: false, error: "Error interno al generar contenido PRO" },
            { status: 500 }
        );
    }
}