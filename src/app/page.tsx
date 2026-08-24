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
} from "@/lib/strava";
import { translations, Language } from "@/lib/translations";
import { exportAsImage } from "@/lib/export";
import { Share2, Zap, ArrowRight, LogOut, Loader2, AlertCircle, Settings2, Check, CalendarDays, Crown, Sparkles, Wand2, Thermometer, Bell, Medal, TrendingUp, Target, HeartPulse, Footprints, Bike, Waves, Trees } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DEMO_STATS: ActivityStats = {
    totalDistance: 154200,
    totalTime: 42300,
    totalElevation: 2450,
    activityCount: 14,
    avgSpeed: 4.2,
    dominantSport: "Ride",
    monthName: "Febrero",
    monthIndex: 1,
    year: 2026,
    daysInMonth: 28,
    activeDays: [2, 4, 5, 8, 10, 11, 14, 15, 18, 20, 22, 25, 26, 28],
    activeDaysCount: 14,
    mostActiveDay: {
        date: "14 Feb",
        distance: 42000
    },
    topActivity: {
        name: "Moncayo climb 🏔️",
        distance: 42000,
        elevation: 1200,
        date: "14 Feb",
        polyline: "ky`yFn}n|@a@q@_@cA`AcBvB",
    },
    bestPaceActivity: {
        name: "10' warmup + 15' all-out + 5' cooldown",
        speed: 5.5,
        duration: 1800,
        date: "22 Feb",
        type: "Run"
    },
    topElevationActivity: {
        name: "Moncayo climb 🏔️",
        elevation: 1200,
        date: "14 Feb",
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
    const [lang, setLang] = useState<Language>("es");
    const t = translations[lang];

    const [stats, setStats] = useState<ActivityStats>(DEMO_STATS);
    const [prevStats, setPrevStats] = useState<ActivityStats | null>(DEMO_PREV_STATS);

    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const [plan, setPlan] = useState<"FREE" | "PRO">("FREE");
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [isGeneratingPro, setIsGeneratingPro] = useState(false);
    const [proInsight, setProInsight] = useState<string | null>(null);
    const [selectedSport, setSelectedSport] = useState<string>("all");

    const [userEmail, setUserEmail] = useState<string>("");
    const [emailRemindersEnabled, setEmailRemindersEnabled] = useState(false);
    const [emailInput, setEmailInput] = useState("");
    const [isSavingEmail, setIsSavingEmail] = useState(false);

    const [records, setRecords] = useState<{
        distance: { month: string; year: number; value: string } | null;
        elevation: { month: string; year: number; value: string } | null;
        activeDays: { month: string; year: number; value: number } | null;
        activityCount: { month: string; year: number; value: number } | null;
    } | null>(null);

    const [annualGoalKm, setAnnualGoalKm] = useState<number | null>(null);
    const [annualGoalInput, setAnnualGoalInput] = useState("");
    const [annualGoalProgress, setAnnualGoalProgress] = useState(0);
    const [yearDistanceKm, setYearDistanceKm] = useState<number | null>(null);
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [panelTab, setPanelTab] = useState<"data" | "records" | "pro">("data");

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
        const errorParam = params.get("error");
        if (errorParam) {
            setError(`Error de autorización: ${errorParam}`);
            setAppState("error");
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        const getCookie = (name: string) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop()?.split(';').shift();
            return null;
        };

        const cookieSession = getCookie("strava_session");

        if (cookieSession) {
            try {
                // Strava session objects are URL-encoded strings in cookies
                const data = JSON.parse(decodeURIComponent(cookieSession));
                startWithTokenData(data);
                // Cargar el plan del usuario desde el servidor
                fetch("/api/me")
                    .then((r) => r.json())
                    .then((me) => {
                        if (me?.ok && me.plan) setPlan(me.plan);
                    })
                    .catch(() => {});
                // Cargar perfil (email + recordatorios)
                fetch("/api/profile")
                    .then((r) => r.json())
                    .then((p) => {
                        if (p?.ok) {
                            setUserEmail(p.email ?? "");
                            setEmailInput(p.email ?? "");
                            setEmailRemindersEnabled(!!p.emailRemindersEnabled);
                            setAnnualGoalKm(p.annualGoalKm ?? null);
                            setAnnualGoalInput(p.annualGoalKm ? String(p.annualGoalKm) : "");
                        }
                    })
                    .catch(() => {});
                // Cargar récords personales (FREE)
                fetch("/api/records")
                    .then((r) => r.json())
                    .then((rec) => {
                        if (rec?.ok) {
                            if (rec.records) setRecords(rec.records);
                            if (typeof rec.yearTotalKm === "number") setYearDistanceKm(rec.yearTotalKm);
                        }
                    })
                    .catch(() => {});
            } catch (err) {
                console.error("No se pudo decodificar la cookie strava_session:", err);
            }
        }
        // eslint-disable-next-deps
    }, []);

    const startWithTokenData = async (data: any) => {
        setAppState("loading");
        setError(null);
        try {
            setTokenData(data);

            const dates = await fetchAvailableDates(data.access_token);
            setAvailableDates(dates);

            const years = Object.keys(dates).map(Number).sort((a, b) => b - a);
            if (years.length > 0) {
                const latestYear = years[0];
                const latestMonths = dates[latestYear];
                const latestMonth = latestMonths[latestMonths.length - 1];

                setTargetYear(latestYear);
                setTargetMonth(latestMonth);
                await loadActivities(data.access_token, latestYear, latestMonth, dates);
            } else {
                setError("No tienes actividades registradas en tu cuenta de Strava.");
                setAppState("error");
            }
        } catch (err) {
            setError("Fallo al cargar tus datos desde Strava. Tu sesión podría haber expirado.");
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
                setError("Error.");
                setAppState("error");
            }
        },
        [lang] // need to pass it if we were to depend on it, but we won't
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
        document.cookie = "strava_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
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
        try {
            const params = new URLSearchParams({
                distance: String(stats.totalDistance),
                elevation: String(stats.totalElevation),
                time: String(stats.totalTime),
                month: String(stats.monthIndex),
                year: String(stats.year),
                name: isAuthenticated ? tokenData?.athlete?.firstname ?? "Atleta" : "DemoAthlete",
                activities: String(stats.activityCount),
                activeDays: String(stats.activeDaysCount),
                sport: stats.dominantSport,
                lang,
            });

            // PRO: añadir insights (tendencias 6 meses, meta anual, zonas de esfuerzo)
            if (plan === "PRO") {
                try {
                    const insRes = await fetch(
                        `/api/pro/insights?year=${stats.year}&month=${stats.monthIndex}${
                            selectedSport !== "all" ? `&type=${selectedSport}` : ""
                        }`,
                        { credentials: "include" }
                    );
                    if (insRes.ok) {
                        const ins = await insRes.json();
                        if (ins?.ok) {
                            if (ins.trend?.length) {
                                params.set(
                                    "trend",
                                    ins.trend.map((p: { label: string; distanceKm: number }) => `${p.label}=${p.distanceKm}`).join(",")
                                );
                            }
                            if (ins.progress?.percent !== null && ins.progress?.percent !== undefined) {
                                params.set("goalPercent", String(ins.progress.percent));
                                params.set("goalCurrentKm", String(ins.progress.currentKm));
                                params.set("goalKm", String(ins.progress.goalKm ?? ""));
                            }
                            if (ins.zones?.distributionPct?.length) {
                                params.set("zones", ins.zones.distributionPct.join(","));
                            }
                        }
                    }
                } catch (err) {
                    console.error("No se pudieron cargar insights para la exportación:", err);
                }
            }

            // Exportación server-side con @vercel/og: FREE → marca de agua, PRO → limpia.
            const res = await fetch(`/api/og/monthly-summary?${params.toString()}`, {
                credentials: "include",
            });
            if (!res.ok) throw new Error(`OG ${res.status}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `Story_Strava_${stats.year}_${stats.monthIndex + 1}.png`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Export server-side falló, usando fallback local:", err);
            try {
                await exportAsImage("recap-card", `Story_Strava_${stats.year}_${stats.monthName}`);
            } catch (err2) {
                alert("Hubo un error al exportar. Inténtalo de nuevo.");
            }
        } finally {
            setIsExporting(false);
        }
    };

    const handleUpgrade = async () => {
        setIsUpgrading(true);
        try {
            const res = await fetch("/api/stripe/checkout", { method: "POST" });
            const data = await res.json();
            if (data?.url) {
                window.location.href = data.url;
            } else {
                setError(data?.error ?? "Error al iniciar el pago");
            }
        } catch {
            setError("Error al iniciar el pago");
            setIsUpgrading(false);
        }
    };

    const handleGeneratePro = async (kind: "roast" | "summary") => {
        setIsGeneratingPro(true);
        setProInsight(null);
        try {
            const res = await fetch("/api/pro/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    year: stats.year,
                    month: stats.monthIndex,
                    kind,
                    type: selectedSport === "all" ? undefined : selectedSport,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data?.error ?? t.proOnly);
                // Si el pago ya se procesó pero la cookie no, reintentar cargar plan
                if (data?.error?.includes("PRO")) {
                    const me = await fetch("/api/me").then((r) => r.json());
                    if (me?.plan === "PRO") setPlan("PRO");
                }
            } else {
                setProInsight(data.insight ?? "");
            }
        } catch {
            setError("Error al generar contenido");
        } finally {
            setIsGeneratingPro(false);
        }
    };

    const handleSaveEmail = async () => {
        setIsSavingEmail(true);
        try {
            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailInput, emailRemindersEnabled }),
            });
            const data = await res.json();
            if (data?.ok) {
                setUserEmail(data.email ?? "");
                setEmailInput(data.email ?? "");
                setEmailRemindersEnabled(!!data.emailRemindersEnabled);
            } else {
                setError(data?.error ?? "Error al guardar el email");
            }
        } catch {
            setError("Error al guardar el email");
        } finally {
            setIsSavingEmail(false);
        }
    };

    const toggleReminders = async () => {
        const next = !emailRemindersEnabled;
        setEmailRemindersEnabled(next);
        try {
            await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emailRemindersEnabled: next }),
            });
        } catch {
            setError("Error al actualizar los recordatorios");
        }
    };

    const handleSaveGoal = async () => {
        const km = Number(annualGoalInput);
        if (!annualGoalInput || isNaN(km) || km <= 0) return;
        try {
            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ annualGoalKm: km }),
            });
            const data = await res.json();
            if (data?.ok) {
                setAnnualGoalKm(data.annualGoalKm ?? km);
                setIsEditingGoal(false);
            } else {
                setError(data?.error ?? "Error al guardar la meta");
            }
        } catch {
            setError("Error al guardar la meta");
        }
    };

    useEffect(() => {
        if (annualGoalKm && yearDistanceKm !== null) {
            setAnnualGoalProgress(Math.round((yearDistanceKm / annualGoalKm) * 100));
        } else {
            setAnnualGoalProgress(0);
        }
    }, [annualGoalKm, yearDistanceKm]);

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
                        <div className="flex items-center justify-between mb-6">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-[0.2em] uppercase bg-strava/10 text-strava rounded">
                                <Zap className="w-3 h-3 fill-strava" /> {t.titleDiary}
                            </span>
                            <button
                                onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
                                className="px-3 py-1 text-xs font-bold border border-white/10 rounded-lg hover:bg-white/5 transition-colors uppercase"
                            >
                                {lang === 'es' ? 'EN' : 'ES'}
                            </button>
                            {isAuthenticated && (
                                <span className={`px-3 py-1 text-xs font-black rounded-lg uppercase flex items-center gap-1.5 ${plan === "PRO" ? "bg-strava/15 text-strava border border-strava/40" : "bg-white/5 text-neutral-400 border border-white/10"}`}>
                                    {plan === "PRO" ? <Crown className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                                    {plan === "PRO" ? t.proBadge : t.freeBadge}
                                </span>
                            )}
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black mb-4 tracking-tight leading-tight">
                            {t.title1}<br />
                            <span className="text-strava underline decoration-strava/30 underline-offset-8">{t.title2}</span>
                        </h1>

                        <p className="text-neutral-400 text-base mb-8 max-w-sm mx-auto md:mx-0">
                            {t.subtitle}
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                            <AnimatePresence mode="wait">
                                {isLoading ? (
                                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-6 py-3 bg-strava/20 text-strava font-bold rounded-xl flex items-center justify-center gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin" /> {t.scanning}
                                    </motion.div>
                                ) : isAuthenticated ? (
                                    <motion.button key="export" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={handleExport} disabled={isExporting} className="group px-6 py-3 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-200 transition-colors disabled:opacity-50">
                                        <Share2 className="w-4 h-4" />
                                        {isExporting ? t.exportingBtn : t.exportBtn}
                                    </motion.button>
                                ) : (
                                    <motion.button key="connect" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={redirectToStravaAuth} className="group relative px-6 py-3 bg-strava text-white font-bold rounded-xl flex items-center justify-center gap-2 overflow-hidden transition-transform hover:scale-105 active:scale-95">
                                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                        <span className="relative flex items-center gap-2">
                                            {t.connectBtn} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </span>
                                    </motion.button>
                                )}
                            </AnimatePresence>

                            {isAuthenticated ? (
                                <button onClick={handleLogout} className="px-5 py-3 bg-red-500/10 text-red-400 font-bold rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2">
                                    <LogOut className="w-4 h-4" /> {t.logoutBtn}
                                </button>
                            ) : (
                                <button onClick={toggleDemo} className="px-6 py-3 bg-neutral-900 text-white font-bold rounded-xl border border-neutral-800 hover:bg-neutral-800 transition-colors">
                                    {appState === "demo" ? t.hideDemoBtn : t.exploreDemoBtn}
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
                                    <div className="p-5 bg-neutral-900/50 backdrop-blur-md rounded-2xl border border-white/5 text-left max-w-[19rem] mx-auto md:mx-0">
                                        {/* ─── TABS ─── */}
                                        <div className="flex gap-1 mb-4 p-1 bg-neutral-950/80 border border-white/5 rounded-xl">
                                            {([
                                                ["data", t.tabData],
                                                ["records", t.tabRecords],
                                                ["pro", t.tabPro],
                                            ] as const).map(([value, label]) => (
                                                <button
                                                    key={value}
                                                    onClick={() => setPanelTab(value)}
                                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${panelTab === value ? "bg-strava text-white shadow" : "text-neutral-500 hover:text-white"}`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>

                                        {panelTab === "data" && (
                                            <>
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
                                                            {t.monthsShort[monthIndex]}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Toggles (Interruptores) */}
                                        <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
                                            {Object.entries({
                                                showComparison: t.toggles.showComparison,
                                                showMap: t.toggles.showMap,
                                                showStory: t.toggles.showStory,
                                                showMostActiveDay: t.toggles.showMostActiveDay,
                                                showPeaks: t.toggles.showPeaks,
                                                showCalendar: t.toggles.showCalendar,
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
                                        </>
                                        )}

                                        {panelTab === "records" && (
                                            <>
                                        {/* ─── RECORDATORIO MENSUAL ─── */}
                                        {isAuthenticated && (
                                            <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Bell className="w-4 h-4 text-neutral-400" />
                                                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-300">{t.remindersTitle}</h3>
                                                </div>
                                                <p className="text-xs text-neutral-500 leading-relaxed">{t.remindersSubtitle}</p>
                                                {!userEmail && (
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="email"
                                                            value={emailInput}
                                                            onChange={(e) => setEmailInput(e.target.value)}
                                                            placeholder={t.emailPlaceholder}
                                                            className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-strava"
                                                        />
                                                        <button
                                                            onClick={handleSaveEmail}
                                                            disabled={isSavingEmail || !emailInput}
                                                            className="px-4 py-2 bg-white text-black text-xs font-bold rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-40"
                                                        >
                                                            {isSavingEmail ? t.generating : t.saveEmail}
                                                        </button>
                                                    </div>
                                                )}
                                                {userEmail && (
                                                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/5">
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-white truncate">{userEmail}</p>
                                                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">{t.emailSaved}</p>
                                                        </div>
                                                        <button
                                                            onClick={toggleReminders}
                                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-colors ${emailRemindersEnabled ? "bg-strava/15 border-strava/40 text-strava" : "bg-neutral-950 border-neutral-800 text-neutral-500 hover:text-white"}`}
                                                        >
                                                            <Bell className="w-3.5 h-3.5" />
                                                            {emailRemindersEnabled ? t.remindersOn : t.remindersOff}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* ─── RÉCORDS PERSONALES (FREE) ─── */}
                                        {records && (
                                            <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Medal className="w-4 h-4 text-yellow-500" />
                                                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-300">{t.recordsTitle}</h3>
                                                </div>
                                                <p className="text-xs text-neutral-500 mb-2">{t.recordsSubtitle}</p>
                                                {([
                                                    ["distance", t.recordDistance, records.distance?.value],
                                                    ["elevation", t.recordElevation, records.elevation?.value],
                                                    ["activeDays", t.recordActiveDays, records.activeDays ? String(records.activeDays.value) : null],
                                                    ["activityCount", t.recordActivityCount, records.activityCount ? String(records.activityCount.value) : null],
                                                ] as const).map(([key, label, value]) => {
                                                    const rec = records[key];
                                                    if (!rec || !value) return null;
                                                    return (
                                                        <div key={key} className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/5">
                                                            <div>
                                                                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{label}</p>
                                                                <p className="text-xs font-bold text-white">{value}</p>
                                                            </div>
                                                            <span className="text-[10px] font-semibold text-yellow-500">
                                                                {rec.month} {rec.year}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        </>
                                        )}

                                        {panelTab === "pro" && (
                                            <>
                                        {/* ─── PLAN PRO ─── */}
                                        <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                                            {plan === "PRO" ? (
                                                <>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Crown className="w-4 h-4 text-strava" />
                                                        <h3 className="text-sm font-bold uppercase tracking-widest text-strava">{t.proBadge}</h3>
                                                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-auto">{t.managePlanBtn}</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">{t.summaryFor}</p>
                                                        <div className="grid grid-cols-3 gap-1.5">
                                                            {([
                                                                ["all", t.sportAll, CalendarDays],
                                                                ["Run", t.sportRun, Footprints],
                                                                ["Ride", t.sportRide, Bike],
                                                                ["Swim", t.sportSwim, Waves],
                                                                ["Walk", t.sportWalk, Footprints],
                                                                ["Hike", t.sportHike, Trees],
                                                            ] as const).map(([value, label, Icon]) => (
                                                                <button
                                                                    key={value}
                                                                    onClick={() => setSelectedSport(value)}
                                                                    className={`flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border text-center leading-tight ${selectedSport === value ? "bg-white text-black border-white shadow-lg shadow-white/10" : "bg-neutral-950 text-neutral-500 border-neutral-800 hover:text-white hover:border-neutral-600"}`}
                                                                >
                                                                    <Icon className={`w-5 h-5 shrink-0 ${selectedSport === value ? "text-black" : ""}`} />
                                                                    <span className="w-full truncate">{label}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleGeneratePro("summary")}
                                                        disabled={isGeneratingPro}
                                                        className="group relative w-full flex items-center justify-center gap-2 p-3.5 bg-gradient-to-r from-strava to-orange-500 text-white font-black rounded-xl overflow-hidden transition-all hover:shadow-lg hover:shadow-strava/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                                                    >
                                                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                                        <span className="relative flex items-center gap-2">
                                                            {isGeneratingPro ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                                            {isGeneratingPro ? t.generating : t.generateBtnLabel}
                                                        </span>
                                                    </button>
                                                    {proInsight && (
                                                        <div className="relative p-3.5 bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl text-sm text-neutral-100 leading-relaxed">
                                                            <div className="absolute -top-1.5 left-3 px-2 py-0.5 bg-strava rounded-md text-[9px] font-black uppercase tracking-widest text-white">
                                                                IA
                                                            </div>
                                                            {proInsight}
                                                        </div>
                                                    )}
                                                    {/* ─── Meta anual con progreso ─── */}
                                                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-2.5">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                                                                <Target className="w-3.5 h-3.5 text-strava" /> {t.annualGoalTitle}
                                                            </p>
                                                            {annualGoalKm && !isEditingGoal && (
                                                                <button
                                                                    onClick={() => {
                                                                        setAnnualGoalInput(String(annualGoalKm));
                                                                        setIsEditingGoal(true);
                                                                    }}
                                                                    className="text-[10px] font-bold text-strava hover:text-orange-400 uppercase tracking-widest transition-colors"
                                                                >
                                                                    {t.annualGoalEdit}
                                                                </button>
                                                            )}
                                                        </div>
                                                        {isEditingGoal || !annualGoalKm ? (
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="number"
                                                                    inputMode="numeric"
                                                                    value={annualGoalInput}
                                                                    onChange={(e) => setAnnualGoalInput(e.target.value)}
                                                                    placeholder={t.annualGoalPlaceholder}
                                                                    className="goal-input flex-1 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-strava"
                                                                />
                                                                <button
                                                                    onClick={handleSaveGoal}
                                                                    disabled={!annualGoalInput}
                                                                    className="px-3.5 py-2 bg-strava text-white text-xs font-black rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
                                                                >
                                                                    {t.annualGoalSave}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-baseline justify-between">
                                                                    <span className="text-sm font-black text-white">{annualGoalKm} km</span>
                                                                    <span className="text-[10px] text-neutral-500 font-semibold">{yearDistanceKm ?? 0} / {annualGoalKm} km</span>
                                                                </div>
                                                                <div className="w-full h-2 rounded-full bg-neutral-900 border border-white/5 overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all duration-700 ${annualGoalProgress >= 100 ? "bg-gradient-to-r from-emerald-500 to-green-400" : "bg-gradient-to-r from-strava to-orange-500"}`}
                                                                        style={{ width: `${Math.min(100, annualGoalProgress)}%` }}
                                                                    />
                                                                </div>
                                                                <p className="text-[10px] font-semibold text-neutral-500">
                                                                    {annualGoalProgress >= 100 ? t.goalReached : `${annualGoalProgress}% · ${t.progressLabel}`}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Crown className="w-4 h-4 text-strava" />
                                                        <h3 className="text-sm font-bold uppercase tracking-widest text-strava">{t.proPanelTitle}</h3>
                                                        <span className="ml-auto flex items-baseline gap-1">
                                                            <span className="text-lg font-black text-white">{t.proPrice}</span>
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-neutral-500 leading-relaxed">{t.proPanelSubtitle}</p>
                                                    <div className="space-y-2 text-xs font-semibold text-neutral-300">
                                                        <p className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-strava shrink-0" /> {t.proFeatureSummary}</p>
                                                        <p className="flex items-center gap-2"><Thermometer className="w-3.5 h-3.5 text-strava shrink-0" /> {t.proFeatureTrueEffortLong}</p>
                                                        <p className="flex items-center gap-2"><Wand2 className="w-3.5 h-3.5 text-strava shrink-0" /> {t.proFeatureCleanImageLong}</p>
                                                        <p className="flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-strava shrink-0" /> {t.proFeatureTrends}</p>
                                                        <p className="flex items-center gap-2"><Target className="w-3.5 h-3.5 text-strava shrink-0" /> {t.proFeatureGoal}</p>
                                                        <p className="flex items-center gap-2"><HeartPulse className="w-3.5 h-3.5 text-strava shrink-0" /> {t.proFeatureZones}</p>
                                                    </div>
                                                    <button
                                                        onClick={handleUpgrade}
                                                        disabled={isUpgrading}
                                                        className="group relative w-full flex items-center justify-center gap-2 p-3.5 bg-gradient-to-r from-strava to-orange-500 text-white font-black rounded-xl overflow-hidden transition-all hover:shadow-lg hover:shadow-strava/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                                                    >
                                                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                                        <span className="relative flex items-center gap-2">
                                                            {isUpgrading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crown className="w-5 h-5" />}
                                                            {isUpgrading ? t.proUpgrading : t.upgradeBtn}
                                                        </span>
                                                    </button>
                                                    <p className="text-center text-[10px] text-neutral-600">{t.proCancelAnyTime}</p>
                                                </>
                                            )}
                                        </div>
                                        </>
                                        )}
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
                                    lang={lang}
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
                                    {t.placeholder1}<br />{t.placeholder2}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

            </div>
        </main>
    );
}
