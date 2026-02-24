"use client";

import React, { useState, useEffect, useCallback } from "react";
import BentoCard, { CardConfig } from "@/components/BentoCard";
import {
    ActivityStats,
    StravaTokenResponse,
    redirectToStravaAuth,
    exchangeCodeForToken,
    fetchAvailableDates,
    fetchMonthlyActivities,
    processMonthlyStats,
    MONTH_NAMES_ES
} from "@/lib/strava";
import { exportAsImage } from "@/lib/export";
import { Share2, Zap, ArrowRight, LogOut, Loader2, AlertCircle, Settings2, Check, CalendarDays } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DEMO_STATS: ActivityStats = {
    totalDistance: 154200,
    totalTime: 42300,
    totalElevation: 2450,
    activityCount: 14,
    avgSpeed: 4.2,
    dominantSport: "Ride",
    monthName: "Febrero",
    year: 2026,
    daysInMonth: 28,
    activeDays: [2, 4, 5, 8, 10, 11, 14, 15, 18, 20, 22, 25, 26, 28],
    activeDaysCount: 14,
    mostActiveDay: {
        date: "14 feb",
        distance: 42000
    },
    topActivity: {
        name: "Subida al Moncayo 🏔️",
        distance: 42000,
        elevation: 1200,
        date: "14 feb",
        polyline: "ky`yFn}n|@a@q@_@cA`AcBvB",
    },
    bestPaceActivity: {
        name: "10' calentamiento + 15' a tope + 5' soltar",
        speed: 5.5,
        duration: 1800,
        date: "22 feb",
        type: "Run"
    },
    topElevationActivity: {
        name: "Subida al Moncayo 🏔️",
        elevation: 1200,
        date: "14 feb",
    }
};

const DEMO_PREV_STATS: ActivityStats = {
    ...DEMO_STATS,
    year: 2025,
    totalDistance: 120000,
    totalTime: 38000,
    totalElevation: 1800,
    activityCount: 10,
};

type AppState = "idle" | "loading" | "demo" | "authenticated" | "error";

export default function Home() {
    const [appState, setAppState] = useState<AppState>("idle");
    const [tokenData, setTokenData] = useState<StravaTokenResponse | null>(null);

    const [stats, setStats] = useState<ActivityStats>(DEMO_STATS);
    const [prevStats, setPrevStats] = useState<ActivityStats | null>(DEMO_PREV_STATS);

    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const [targetYear, setTargetYear] = useState(new Date().getFullYear());
    const [targetMonth, setTargetMonth] = useState(new Date().getMonth());
    const [availableDates, setAvailableDates] = useState<Record<number, number[]> | null>(null);

    const [cardConfig, setCardConfig] = useState<CardConfig>({
        showMap: true,
        showStory: true,
        showMostActiveDay: true,
        showCalendar: true,
        showPeaks: true,
        showComparison: true,
    });

    const toggleConfig = (key: keyof CardConfig) => {
        setCardConfig(prev => ({ ...prev, [key]: !prev[key] }));
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const oauthError = params.get("error");
        if (oauthError) {
            setError("Conexión cancelada por el usuario.");
            setAppState("error");
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }
        if (code) {
            window.history.replaceState({}, document.title, window.location.pathname);
            handleTokenExchange(code);
        }
        // eslint-disable-next-deps
    }, []);

    const handleTokenExchange = async (code: string) => {
        setAppState("loading");
        setError(null);
        try {
            const data = await exchangeCodeForToken(code);
            setTokenData(data);

            const dates = await fetchAvailableDates(data.access_token);
            setAvailableDates(dates);

            const years = Object.keys(dates).map(Number).sort((a, b) => b - a);
            if (years.length > 0) {
                const latestYear = years[0];
                const latestMonths = dates[latestYear];
                const latestMonth = latestMonths[latestMonths.length - 1]; // el mes más alto de ese año

                setTargetYear(latestYear);
                setTargetMonth(latestMonth);
                await loadActivities(data.access_token, latestYear, latestMonth, dates);
            } else {
                setError("No tienes actividades registradas en tu cuenta de Strava.");
                setAppState("error");
            }
        } catch (err) {
            setError("Fallo al intercambiar el token de Strava.");
            setAppState("error");
        }
    };

    const loadActivities = useCallback(
        async (accessToken: string, year: number, month: number, dates: Record<number, number[]>) => {
            setAppState("loading");
            try {
                const prevYear = year - 1;
                // Solo intentaremos traer datos del año anterior si existen en nuestra base cacheada `dates`
                const hasPrevYearData = dates[prevYear] && dates[prevYear].includes(month);

                const currActivities = await fetchMonthlyActivities(accessToken, year, month);
                const currStats = processMonthlyStats(currActivities, year, month);

                let pStats: ActivityStats | null = null;
                if (hasPrevYearData) {
                    const prevActivities = await fetchMonthlyActivities(accessToken, prevYear, month);
                    pStats = processMonthlyStats(prevActivities, prevYear, month);
                }

                setStats(currStats);
                setPrevStats(pStats?.activityCount ? pStats : null);
                setAppState("authenticated");
            } catch (err) {
                setError("Error de permisos o rate limit con Strava.");
                setAppState("error");
            }
        },
        []
    );

    const applyNewDate = (year: number, month: number) => {
        setTargetYear(year);
        setTargetMonth(month);
        if (tokenData && availableDates) {
            loadActivities(tokenData.access_token, year, month, availableDates);
        }
    };

    const handleLogout = () => {
        setTokenData(null);
        setAvailableDates(null);
        setStats(DEMO_STATS);
        setPrevStats(DEMO_PREV_STATS);
        setAppState("idle");
        setError(null);
    };

    const toggleDemo = () => {
        if (appState === "demo") {
            setAppState("idle");
        } else {
            setStats(DEMO_STATS);
            setPrevStats(DEMO_PREV_STATS);
            setTargetYear(2026);
            setTargetMonth(1);
            setAvailableDates({
                2026: [1],      // Febrero 2026
                2025: [0, 1, 2] // Ene, Feb, Mar 2025
            });
            setAppState("demo");
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        await exportAsImage("recap-card", `Story_Strava_${stats.year}_${stats.monthName}`);
        setIsExporting(false);
    };

    const isAuthenticated = appState === "authenticated";
    const isLoading = appState === "loading";
    const isDemoOrAuth = appState === "demo" || isAuthenticated;

    // Render variables para los Selectores de Máquina del Tiempo
    const activeYears = availableDates ? Object.keys(availableDates).map(Number).sort((a, b) => b - a) : [];
    const activeMonthsInTargetYear = availableDates && availableDates[targetYear] ? availableDates[targetYear] : [];

    return (
        <main className="min-h-screen relative flex flex-col md:flex-row items-center justify-center p-4 lg:p-12 bg-[#050505] overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -left-64 top-0 w-[800px] h-[800px] bg-strava/5 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 w-full max-w-6xl flex flex-col md:flex-row gap-12 lg:gap-24 items-center md:items-start justify-center">

                <div className="flex-1 w-full max-w-md mt-4 md:mt-16 text-center md:text-left flex flex-col">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 mb-6 text-[10px] font-bold tracking-[0.2em] uppercase bg-strava/10 text-strava rounded">
                            <Zap className="w-3 h-3 fill-strava" /> Diario de Progreso Anual
                        </span>

                        <h1 className="text-5xl md:text-6xl font-black mb-4 tracking-tight leading-tight">
                            Tus Logros,<br />
                            <span className="text-strava underline decoration-strava/30 underline-offset-8">A Tu Medida.</span>
                        </h1>

                        <p className="text-neutral-400 text-base mb-8 max-w-sm mx-auto md:mx-0">
                            Conecta Strava, elige cualquier mes y año en los que hayas entrenado, y compárate con el pasado.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                            <AnimatePresence mode="wait">
                                {isLoading ? (
                                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-6 py-3 bg-strava/20 text-strava font-bold rounded-xl flex items-center justify-center gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin" /> Escaneando todo Strava...
                                    </motion.div>
                                ) : isAuthenticated ? (
                                    <motion.button key="export" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={handleExport} disabled={isExporting} className="group px-6 py-3 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-200 transition-colors disabled:opacity-50">
                                        <Share2 className="w-4 h-4" />
                                        {isExporting ? "Generando..." : "Exportar Story"}
                                    </motion.button>
                                ) : (
                                    <motion.button key="connect" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={redirectToStravaAuth} className="group relative px-6 py-3 bg-strava text-white font-bold rounded-xl flex items-center justify-center gap-2 overflow-hidden transition-transform hover:scale-105 active:scale-95">
                                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                        <span className="relative flex items-center gap-2">
                                            Conectar Strava <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </span>
                                    </motion.button>
                                )}
                            </AnimatePresence>

                            {isAuthenticated ? (
                                <button onClick={handleLogout} className="px-5 py-3 bg-red-500/10 text-red-400 font-bold rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2">
                                    <LogOut className="w-4 h-4" /> Salir
                                </button>
                            ) : (
                                <button onClick={toggleDemo} className="px-6 py-3 bg-neutral-900 text-white font-bold rounded-xl border border-neutral-800 hover:bg-neutral-800 transition-colors">
                                    {appState === "demo" ? "Ocultar Demo" : "Explorar Demo"}
                                </button>
                            )}
                        </div>

                        {appState === "error" && error && (
                            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm max-w-sm mx-auto md:mx-0 text-left">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
                            </motion.div>
                        )}

                        <AnimatePresence>
                            {isDemoOrAuth && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="mt-8 overflow-hidden"
                                >
                                    <div className="p-5 bg-neutral-900/50 backdrop-blur-md rounded-2xl border border-white/5 text-left max-w-sm mx-auto md:mx-0">
                                        <div className="flex items-center gap-2 mb-4 justify-between">
                                            <div className="flex items-center gap-2">
                                                <Settings2 className="w-4 h-4 text-neutral-400" />
                                                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-300">Selector Inteligente</h3>
                                            </div>
                                        </div>

                                        {/* ─── SELECTORES CON SOLAMENTE FECHAS VÁLIDAS ─── */}
                                        {activeYears.length > 0 && (
                                            <div className="mb-6 space-y-3">
                                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                                    {activeYears.map(yr => (
                                                        <button key={yr} onClick={() => applyNewDate(yr, activeMonthsInTargetYear.includes(targetMonth) ? targetMonth : availableDates![yr][0])}
                                                            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${targetYear === yr ? "bg-strava text-white border-strava" : "bg-neutral-950 text-neutral-500 border-neutral-800 hover:text-white"
                                                                }`}>
                                                            {yr}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                                    {activeMonthsInTargetYear.map((monthIndex) => (
                                                        <button key={monthIndex} onClick={() => applyNewDate(targetYear, monthIndex)}
                                                            className={`py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border ${targetMonth === monthIndex ? "bg-white text-black border-white" : "bg-neutral-950 text-neutral-500 border-neutral-800 hover:text-white"
                                                                }`}>
                                                            {MONTH_NAMES_ES[monthIndex]}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Toggles (Interruptores) */}
                                        <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
                                            {Object.entries({
                                                showComparison: "Comparativa Anual (vs ant.)",
                                                showMap: "Silueta de Ruta Épica",
                                                showStory: "Storytelling de Desnivel",
                                                showMostActiveDay: "Día Más Activo",
                                                showPeaks: "Los Picos del Mes",
                                                showCalendar: "Constancia (Días activos)",
                                            }).map(([key, label]) => {
                                                const confKey = key as keyof CardConfig;
                                                const isActive = cardConfig[confKey];
                                                return (
                                                    <button
                                                        key={key}
                                                        onClick={() => toggleConfig(confKey)}
                                                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-colors ${isActive ? "bg-white/5 border-white/10 text-white" : "bg-transparent border-transparent text-neutral-500 hover:bg-white/5"
                                                            }`}
                                                    >
                                                        <span className="text-xs font-semibold">{label}</span>
                                                        <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${isActive ? "bg-strava border-strava" : "border-neutral-700"
                                                            }`}>
                                                            {isActive && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                    </motion.div>
                </div>

                <div className="flex-1 w-full flex justify-center perspective-[1200px] pb-10">
                    <AnimatePresence mode="wait">
                        {isDemoOrAuth || isLoading ? (
                            <motion.div
                                key="rendered-card"
                                initial={{ opacity: 0, rotateY: 10, x: 50 }}
                                animate={{ opacity: 1, rotateY: 0, x: 0 }}
                                transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
                            >
                                <BentoCard
                                    stats={stats}
                                    prevStats={prevStats}
                                    config={cardConfig}
                                    userName={isAuthenticated ? tokenData?.athlete?.firstname ?? "Atleta" : "DemoAthlete"}
                                    isLoading={isLoading}
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="placeholder"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="w-full max-w-[380px] min-h-[660px] rounded-[2.5rem] border border-neutral-800 border-dashed flex flex-col items-center justify-center gap-4 text-neutral-700 mt-12 bg-neutral-900/20 backdrop-blur-sm"
                            >
                                <CalendarDays className="w-10 h-10 stroke-[1.5]" />
                                <p className="text-xs font-semibold tracking-widest uppercase text-center px-8 leading-relaxed">
                                    Compara tu progreso.<br />Conecta tu Strava.
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

            </div>
        </main>
    );
}
