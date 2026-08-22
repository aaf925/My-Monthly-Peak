import type { Plan } from "@/generated/prisma/enums";

export interface MonthlySummaryProps {
    plan: Plan;
    lang: "es" | "en";
    userName: string;
    monthIndex: number;
    year: number;
    distanceKm: number;
    elevationM: number;
    timeSeconds: number;
    activityCount: number;
    activeDays: number;
    dominantSport: string;
}

const STRAVA = "#FC4C02";
const BG = "#0A0A0A";

const MONTHS_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const SPORTS_ES: Record<string, string> = { Run: "Carrera", Ride: "Bici", VirtualRide: "Bici", Swim: "Natación", Walk: "Caminata", Hike: "Senderismo" };
const SPORTS_EN: Record<string, string> = { Run: "Run", Ride: "Ride", VirtualRide: "Ride", Swim: "Swim", Walk: "Walk", Hike: "Hike" };

export function formatKm(meters: number): string {
    return `${(meters / 1000).toFixed(1)} km`;
}

export function formatHours(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function MonthlySummaryCard({
    plan,
    lang,
    userName,
    monthIndex,
    year,
    distanceKm,
    elevationM,
    timeSeconds,
    activityCount,
    activeDays,
    dominantSport,
}: MonthlySummaryProps) {
    const isPro = plan === "PRO";
    const months = lang === "es" ? MONTHS_ES : MONTHS_EN;
    const displayMonth = months[monthIndex] ?? months[0];
    const sportLabel = (lang === "es" ? SPORTS_ES : SPORTS_EN)[dominantSport] ?? dominantSport;

    return (
        <div
            style={{
                width: "1200px",
                height: "630px",
                background: BG,
                color: "#fff",
                fontFamily: "Inter",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "56px 60px",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Glow decorativo */}
            <div
                style={{
                    position: "absolute",
                    top: "-160px",
                    right: "-120px",
                    width: "420px",
                    height: "420px",
                    borderRadius: "9999px",
                    background: `radial-gradient(circle, ${STRAVA}44 0%, transparent 70%)`,
                }}
            />
            <div
                style={{
                    position: "absolute",
                    bottom: "-180px",
                    left: "-120px",
                    width: "480px",
                    height: "480px",
                    borderRadius: "9999px",
                    background: "radial-gradient(circle, #2563EB33 0%, transparent 70%)",
                }}
            />

            {/* ─── Header ─── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div
                        style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "14px",
                            background: STRAVA,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "20px",
                            fontWeight: 900,
                        }}
                    >
                        MP
                    </div>
                    <span style={{ fontSize: "24px", fontWeight: 800, letterSpacing: "0.08em" }}>MY MONTHLY PEAK</span>
                </div>

                {isPro ? (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "10px 18px",
                            borderRadius: "9999px",
                            border: `1.5px solid ${STRAVA}`,
                            fontSize: "16px",
                            fontWeight: 800,
                            color: STRAVA,
                            letterSpacing: "0.12em",
                        }}
                    >
                        PRO
                    </div>
                ) : (
                    <span style={{ fontSize: "16px", fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.08em" }}>
                        @{userName}
                    </span>
                )}
            </div>

            {/* ─── Título central ─── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", position: "relative" }}>
                <span style={{ fontSize: "20px", fontWeight: 600, color: STRAVA, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {displayMonth} · {year}
                </span>
                <span style={{ fontSize: "76px", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
                    {isPro ? "Tu mejor mes," : "Resumen de"} {userName}
                </span>
            </div>

            {/* ─── Stats ─── */}
            <div style={{ display: "flex", gap: "20px", position: "relative" }}>
                {[
                    { value: formatKm(distanceKm * 1000), label: lang === "es" ? "Distancia" : "Distance", color: STRAVA },
                    { value: `${elevationM.toFixed(0)} m`, label: lang === "es" ? "Desnivel" : "Elevation", color: "#10B981" },
                    { value: formatHours(timeSeconds), label: lang === "es" ? "Tiempo" : "Time", color: "#60A5FA" },
                ].map((s) => (
                    <div
                        key={s.label}
                        style={{
                            flex: 1,
                            borderRadius: "24px",
                            border: "1px solid #262626",
                            background: "#111113",
                            padding: "24px 28px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                        }}
                    >
                        <span style={{ fontSize: "44px", fontWeight: 900, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</span>
                        <span style={{ fontSize: "16px", fontWeight: 600, color: "#A3A3A3", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                            {s.label}
                        </span>
                    </div>
                ))}

                <div
                    style={{
                        flex: 1,
                        borderRadius: "24px",
                        border: "1px solid #262626",
                        background: isPro ? `${STRAVA}1A` : "#111113",
                        padding: "24px 28px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                    }}
                >
                    <span style={{ fontSize: "44px", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>
                        {activeDays} <span style={{ fontSize: "24px", color: "#A3A3A3" }}>/{activityCount}</span>
                    </span>
                    <span style={{ fontSize: "16px", fontWeight: 600, color: "#A3A3A3", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                        {lang === "es" ? "Días / Actividades" : "Days / Activities"}
                    </span>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: STRAVA, marginTop: "4px" }}>
                        {sportLabel}
                    </span>
                </div>
            </div>

            {/* ─── Watermark FREE / Footer PRO ─── */}
            {!isPro ? (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                    }}
                >
                    <span
                        style={{
                            transform: "rotate(-18deg)",
                            fontSize: "52px",
                            fontWeight: 800,
                            color: "#ffffff14",
                            letterSpacing: "0.18em",
                            whiteSpace: "nowrap",
                            textTransform: "uppercase",
                        }}
                    >
                        Generado con My Monthly Peak
                    </span>
                </div>
            ) : (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        position: "relative",
                        
                        paddingTop: "20px",
                        borderTop: "1px solid #262626",
                    }}
                >
                    <span style={{ fontSize: "16px", fontWeight: 600, color: "#A3A3A3" }}>
                        {lang === "es" ? "Análisis avanzado con True Effort & IA" : "Advanced analysis with True Effort & AI"}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: STRAVA, letterSpacing: "0.08em" }}>
                            @mymonthlypeak
                        </span>
                        <span style={{ fontSize: "16px", fontWeight: 800, color: "#fff", letterSpacing: "0.1em" }}>
                            @{userName}
                        </span>
                    </span>
                </div>
            )}
        </div>
    );
}