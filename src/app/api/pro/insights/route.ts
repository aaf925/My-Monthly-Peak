import { NextRequest, NextResponse } from "next/server";
import { findOrCreateUserFromCookie, ProRequiredError } from "@/lib/plans";
import { scanAllMonthlyTotals } from "@/lib/records";
import { getTrend, getYearProgress, computeEffortZones } from "@/lib/trends";
import { fetchMonthlyActivities } from "@/lib/strava";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("strava_session")?.value;
        const user = await findOrCreateUserFromCookie(sessionCookie);
        if (!user) throw new ProRequiredError("No autenticado", 401);

        // Feature PRO
        if (user.plan !== "PRO") {
            throw new ProRequiredError("Esta función requiere el plan PRO.");
        }
        if (!user.stravaAccessToken) throw new ProRequiredError("Sin token de Strava", 401);

        const { searchParams } = new URL(req.url);
        const year = Number(searchParams.get("year") ?? new Date().getFullYear());
        const month = Number(searchParams.get("month") ?? new Date().getMonth());
        const type = searchParams.get("type") ?? undefined;

        // 1. Tendencias (6 meses) y meta anual
        const totals = await scanAllMonthlyTotals(user.stravaAccessToken);
        const trend = getTrend(totals, 6);
        const progress = getYearProgress(totals, year, user.annualGoalKm);

        // 2. Zonas de esfuerzo del mes (filtradas por tipo si aplica)
        let activities = await fetchMonthlyActivities(user.stravaAccessToken, year, month);
        if (type) activities = activities.filter((a) => a.type === type);
        const zones = computeEffortZones(activities, user.maxHeartRate);

        return NextResponse.json({
            ok: true,
            trend,
            progress,
            zones,
        });
    } catch (err) {
        if (err instanceof ProRequiredError) {
            return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
        }
        console.error("insights error:", err);
        return NextResponse.json({ ok: false, error: "Error al generar insights" }, { status: 500 });
    }
}