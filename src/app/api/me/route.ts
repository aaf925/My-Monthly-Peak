import { NextRequest, NextResponse } from "next/server";
import { findOrCreateUserFromCookie } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("strava_session")?.value;
        const user = await findOrCreateUserFromCookie(sessionCookie);

        if (!user) {
            return NextResponse.json({ ok: true, plan: "FREE", authenticated: false });
        }

        return NextResponse.json({
            ok: true,
            authenticated: true,
            plan: user.plan,
            name: user.name,
            stravaAthleteId: user.stravaAthleteId,
        });
    } catch (err) {
        console.error("me error:", err);
        return NextResponse.json({ ok: false, error: "Error al leer el plan" }, { status: 500 });
    }
}