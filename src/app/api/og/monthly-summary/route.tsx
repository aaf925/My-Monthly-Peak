import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "@vercel/og";
import { getInterFonts } from "@/lib/og-fonts";
import MonthlySummaryCard from "@/components/og/MonthlySummaryCard";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);

    const distanceKm = Number(searchParams.get("distance") ?? 0);
    const elevationM = Number(searchParams.get("elevation") ?? 0);
    const timeSeconds = Number(searchParams.get("time") ?? 0);
    const monthIndex = Number(searchParams.get("month") ?? new Date().getMonth());
    const year = Number(searchParams.get("year") ?? new Date().getFullYear());
    const userName = searchParams.get("name") ?? "Atleta";
    const lang = searchParams.get("lang") === "en" ? "en" : "es";
    const activityCount = Number(searchParams.get("activities") ?? 0);
    const activeDays = Number(searchParams.get("activeDays") ?? 0);
    const dominantSport = searchParams.get("sport") ?? "Run";

    // Plan resuelto en el SERVIDOR: nunca por query param (evita manipulación).
    let plan: "FREE" | "PRO" = "FREE";
    try {
        const session = req.cookies.get("strava_session")?.value;
        if (session) {
            const data = JSON.parse(decodeURIComponent(session));
            const athleteId = data?.athlete?.id;
            if (athleteId) {
                const user = await getPrisma().user.findUnique({
                    where: { stravaAthleteId: Number(athleteId) },
                    select: { plan: true },
                });
                if (user) plan = user.plan;
            }
        }
    } catch {
        plan = "FREE";
    }

    const fonts = await getInterFonts();

    return new ImageResponse(
        (
            <MonthlySummaryCard
                plan={plan}
                lang={lang}
                userName={userName}
                monthIndex={monthIndex}
                year={year}
                distanceKm={distanceKm}
                elevationM={elevationM}
                timeSeconds={timeSeconds}
                activityCount={activityCount}
                activeDays={activeDays}
                dominantSport={dominantSport}
            />
        ),
        {
            width: 1200,
            height: 630,
            fonts,
            headers: {
                "Cache-Control": "public, max-age=0, must-revalidate",
            },
        }
    );
}

export async function OPTIONS() {
    return NextResponse.json({ ok: true });
}