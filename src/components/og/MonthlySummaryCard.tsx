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
    trend?: { label: string; distanceKm: number }[];
    goalPercent?: number | null;
    goalCurrentKm?: number | null;
    goalKm?: number | null;
    zones?: number[];
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
    trend,
    goalPercent,
    goalCurrentKm,
    goalKm,
    zones,
}: MonthlySummaryProps) {
    const isPro = plan === "PRO";
    const months = lang === "es" ? MONTHS_ES : MONTHS_EN;
    const displayMonth = months[monthIndex] ?? months[0];
    const sportLabel = (lang === "es" ? SPORTS_ES : SPORTS_EN)[dominantSport] ?? dominantSport;

    const W = 1080;
    const H = 1920;

    return (
        <div
            style={{
                width: `${W}px`,
                height: `${H}px`,
                background: BG,
                color: "#fff",
                fontFamily: "Inter",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "64px 56px",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Glow decorativo */}
            <div
                style={{
                    position: "absolute",
                    top: "-200px",
                    right: "-140px",
                    width: "520px",
                    height: "520px",
                    borderRadius: "9999px",
                    background: `radial-gradient(circle, ${STRAVA}44 0%, transparent 70%)`,
                }}
            />
            <div
                style={{
                    position: "absolute",
                    bottom: "-220px",
                    left: "-140px",
                    width: "560px",
                    height: "560px",
                    borderRadius: "9999px",
                    background: "radial-gradient(circle, #2563EB33 0%, transparent 70%)",
                }}
            />

            {/* ─── Header ─── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                    <div
                        style={{
                            width: "60px",
                            height: "60px",
                            borderRadius: "18px",
                            background: STRAVA,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "28px",
                            fontWeight: 900,
                        }}
                    >
                        MP
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "0.08em" }}>MY MONTHLY PEAK</span>
                        <span style={{ fontSize: "18px", fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.08em" }}>@{userName}</span>
                    </div>
                </div>

                {isPro && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "12px 22px",
                            borderRadius: "9999px",
                            border: `1.5px solid ${STRAVA}`,
                            fontSize: "18px",
                            fontWeight: 800,
                            color: STRAVA,
                            letterSpacing: "0.12em",
                        }}
                    >
                        PRO
                    </div>
                )}
            </div>

            {/* ─── Título central ─── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", position: "relative" }}>
                <span style={{ fontSize: "26px", fontWeight: 600, color: STRAVA, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {displayMonth} · {year}
                </span>
                <span style={{ fontSize: "84px", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
                    {isPro ? "Tu mejor mes," : "Resumen de"} {userName}
                </span>
                <span style={{ fontSize: "22px", fontWeight: 600, color: "#A3A3A3", marginTop: "8px" }}>
                    {sportLabel}
                </span>
            </div>

            {/* ─── Stats (2x2) ─── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", position: "relative" }}>
                <div style={{ display: "flex", gap: "20px" }}>
                    <div
                        style={{
                            flex: 1,
                            borderRadius: "28px",
                            border: "1px solid #262626",
                            background: "#111113",
                            padding: "28px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                        }}
                    >
                        <span style={{ fontSize: "58px", fontWeight: 900, color: STRAVA, letterSpacing: "-0.02em" }}>{formatKm(distanceKm * 1000)}</span>
                        <span style={{ fontSize: "18px", fontWeight: 600, color: "#A3A3A3", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                            {lang === "es" ? "Distancia" : "Distance"}
                        </span>
                    </div>
                    <div
                        style={{
                            flex: 1,
                            borderRadius: "28px",
                            border: "1px solid #262626",
                            background: "#111113",
                            padding: "28px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                        }}
                    >
                        <span style={{ fontSize: "58px", fontWeight: 900, color: "#10B981", letterSpacing: "-0.02em" }}>{elevationM.toFixed(0)} m</span>
                        <span style={{ fontSize: "18px", fontWeight: 600, color: "#A3A3A3", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                            {lang === "es" ? "Desnivel" : "Elevation"}
                        </span>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "20px" }}>
                    <div
                        style={{
                            flex: 1,
                            borderRadius: "28px",
                            border: "1px solid #262626",
                            background: "#111113",
                            padding: "28px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                        }}
                    >
                        <span style={{ fontSize: "58px", fontWeight: 900, color: "#60A5FA", letterSpacing: "-0.02em" }}>{formatHours(timeSeconds)}</span>
                        <span style={{ fontSize: "18px", fontWeight: 600, color: "#A3A3A3", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                            {lang === "es" ? "Tiempo" : "Time"}
                        </span>
                    </div>
                    <div
                        style={{
                            flex: 1,
                            borderRadius: "28px",
                            border: "1px solid #262626",
                            background: isPro ? `${STRAVA}1A` : "#111113",
                            padding: "28px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                        }}
                    >
                        <span style={{ fontSize: "58px", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>
                            {activeDays} <span style={{ fontSize: "32px", color: "#A3A3A3" }}>/{activityCount}</span>
                        </span>
                        <span style={{ fontSize: "18px", fontWeight: 600, color: "#A3A3A3", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                            {lang === "es" ? "Días / Actividades" : "Days / Activities"}
                        </span>
                    </div>
                </div>
            </div>

            {/* ─── PRO: Insights ─── */}
            {isPro && (trend || goalPercent !== null || zones) && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px", position: "relative" }}>
                    {trend && trend.length > 0 && (
                        <div
                            style={{
                                borderRadius: "24px",
                                border: "1px solid #262626",
                                background: "#111113",
                                padding: "22px 26px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "12px",
                            }}
                        >
                            <span style={{ fontSize: "16px", fontWeight: 700, color: "#A3A3A3", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                                {lang === "es" ? "Tendencias · 6 meses" : "Trends · 6 months"}
                            </span>
                            <div style={{ display: "flex", alignItems: "flex-end", gap: "14px", height: "72px" }}>
                                {trend.map((p) => {
                                    const max = Math.max(...trend.map((t) => t.distanceKm), 1);
                                    const h = Math.max(12, (p.distanceKm / max) * 60);
                                    return (
                                        <div key={p.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", flex: 1 }}>
                                            <div style={{ display: "flex", width: "22px", borderRadius: "6px", height: `${h}px`, background: STRAVA }} />
                                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#737373" }}>{p.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {goalPercent !== null && (
                        <div
                            style={{
                                borderRadius: "24px",
                                border: "1px solid #262626",
                                background: "#111113",
                                padding: "22px 26px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                            }}
                        >
                            <span style={{ fontSize: "16px", fontWeight: 700, color: "#A3A3A3", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                                {lang === "es" ? "Meta anual" : "Year goal"}
                            </span>
                            <span style={{ fontSize: "40px", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>{goalPercent}%</span>
                            <div style={{ display: "flex", width: "100%", height: "14px", borderRadius: "9999px", background: "#262626", overflow: "hidden" }}>
                                <div style={{ display: "flex", width: `${goalPercent}%`, height: "100%", borderRadius: "9999px", background: "#10B981" }} />
                            </div>
                            <span style={{ fontSize: "16px", fontWeight: 600, color: "#737373" }}>
                                {goalCurrentKm} / {goalKm} km
                            </span>
                        </div>
                    )}

                    {zones && zones.length >= 5 && (
                        <div
                            style={{
                                borderRadius: "24px",
                                border: "1px solid #262626",
                                background: "#111113",
                                padding: "22px 26px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "12px",
                            }}
                        >
                            <span style={{ fontSize: "16px", fontWeight: 700, color: "#A3A3A3", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                                {lang === "es" ? "Zonas de esfuerzo" : "Effort zones"}
                            </span>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {zones.map((pct, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <span style={{ fontSize: "15px", fontWeight: 800, color: "#A3A3A3", width: "28px" }}>Z{i + 1}</span>
                                        <div style={{ display: "flex", flex: 1, height: "12px", borderRadius: "9999px", background: "#262626", overflow: "hidden" }}>
                                            <div style={{ display: "flex", width: `${Math.max(4, pct)}%`, height: "100%", borderRadius: "9999px", background: ["#3B82F6", "#10B981", "#F59E0B", "#F97316", "#EF4444"][i] }} />
                                        </div>
                                        <span style={{ fontSize: "15px", fontWeight: 700, color: "#fff", width: "44px", textAlign: "right" }}>{pct}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

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
                            fontSize: "60px",
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
                        paddingTop: "24px",
                        borderTop: "1px solid #262626",
                    }}
                >
                    <span style={{ fontSize: "18px", fontWeight: 600, color: "#A3A3A3" }}>
                        {lang === "es" ? "Análisis avanzado con True Effort & IA" : "Advanced analysis with True Effort & AI"}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <span style={{ fontSize: "16px", fontWeight: 700, color: STRAVA, letterSpacing: "0.08em" }}>
                            @mymonthlypeak
                        </span>
                        <span style={{ fontSize: "18px", fontWeight: 800, color: "#fff", letterSpacing: "0.1em" }}>
                            @{userName}
                        </span>
                    </span>
                </div>
            )}
        </div>
    );
}