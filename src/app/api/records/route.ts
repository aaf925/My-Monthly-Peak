import { NextRequest, NextResponse } from "next/server";
import { findOrCreateUserFromCookie, ProRequiredError } from "@/lib/plans";
import { scanAllMonthlyTotals, computePersonalRecords, type MonthTotals } from "@/lib/records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("strava_session")?.value;
        const user = await findOrCreateUserFromCookie(sessionCookie);
        if (!user) throw new ProRequiredError("No autenticado", 401);

        if (!user.stravaAccessToken) {
            throw new ProRequiredError("Sin token de Strava", 401);
        }

        // Récords personales: feature FREE, disponible para todos los autenticados.
        const totals = await scanAllMonthlyTotals(user.stravaAccessToken);
        const records = computePersonalRecords(totals);

        const monthName = (m: MonthTotals) =>
            new Date(m.year, m.month, 1).toLocaleDateString("es-ES", { month: "long" });

        const fmt = (m: MonthTotals | null, unit: "km" | "m") =>
            m ? `${(m.distance / 1000).toFixed(1)} km` : null;

        return NextResponse.json({
            ok: true,
            totalMonths: totals.length,
            records: {
                distance: records.bestDistanceMonth
                    ? { month: monthName(records.bestDistanceMonth), year: records.bestDistanceMonth.year, value: fmt(records.bestDistanceMonth, "km") }
                    : null,
                elevation: records.bestElevationMonth
                    ? { month: monthName(records.bestElevationMonth), year: records.bestElevationMonth.year, value: `${records.bestElevationMonth.elevation.toFixed(0)} m` }
                    : null,
                activeDays: records.bestActiveDaysMonth
                    ? { month: monthName(records.bestActiveDaysMonth), year: records.bestActiveDaysMonth.year, value: records.bestActiveDaysMonth.activeDays }
                    : null,
                activityCount: records.bestActivityCountMonth
                    ? { month: monthName(records.bestActivityCountMonth), year: records.bestActivityCountMonth.year, value: records.bestActivityCountMonth.activityCount }
                    : null,
            },
        });
    } catch (err) {
        if (err instanceof ProRequiredError) {
            return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
        }
        console.error("records error:", err);
        return NextResponse.json({ ok: false, error: "Error al calcular los récords" }, { status: 500 });
    }
}