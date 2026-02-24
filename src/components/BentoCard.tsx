"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
    ActivityStats,
    decodePolyline,
    polylineToSvgPath,
    formatDistance,
    formatTime,
    formatPace,
    getElevationEquivalence,
} from "@/lib/strava";
import {
    MapPin,
    Clock,
    Mountain,
    Zap,
    Flame,
    Activity,
    Medal,
    TrendingDown,
    TrendingUp
} from "lucide-react";

export interface CardConfig {
    showMap: boolean;
    showStory: boolean;
    showMostActiveDay: boolean;
    showCalendar: boolean;
    showPeaks: boolean;
    showComparison: boolean;
}

interface BentoCardProps {
    stats: ActivityStats;
    prevStats?: ActivityStats | null;
    userName: string;
    config: CardConfig;
    isLoading?: boolean;
}

const containerVars = {
    hidden: { opacity: 0, scale: 0.98 },
    show: {
        opacity: 1,
        scale: 1,
        transition: { staggerChildren: 0.05, delayChildren: 0.1 },
    },
};

const itemVars = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } },
};

const ComparisonBadge = ({ current, prev, show }: { current: number, prev?: number, show: boolean }) => {
    if (!show || typeof prev !== 'number' || prev === 0) return null;
    const rawPct = ((current - prev) / prev) * 100;
    if (!isFinite(rawPct) || rawPct === 0) return null;

    const pct = Math.abs(rawPct);
    const isUp = rawPct > 0;
    const colorClass = isUp ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10";
    const Icon = isUp ? TrendingUp : TrendingDown;

    return (
        <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md mt-1.5 w-max ${colorClass}`}>
            <Icon className="w-3 h-3" strokeWidth={3} />
            <span className="text-[10px] font-bold tracking-tight">{pct.toFixed(0)}%</span>
            <span className="text-[8px] font-semibold opacity-70 ml-0.5">vs ant.</span>
        </div>
    );
};

const BentoCard: React.FC<BentoCardProps> = ({ stats, prevStats, userName, config, isLoading }) => {
    const svgPath = useMemo(() => {
        if (config.showMap && stats.topActivity?.polyline) {
            const coords = decodePolyline(stats.topActivity.polyline);
            return polylineToSvgPath(coords);
        }
        return null;
    }, [config.showMap, stats.topActivity]);

    return (
        <motion.div
            id="recap-card"
            variants={containerVars}
            initial="hidden"
            animate="show"
            className="relative w-full max-w-[380px] min-h-[660px] bg-neutral-950 text-white rounded-[2.5rem] overflow-hidden border border-neutral-800 shadow-2xl p-6 flex flex-col gap-4"
        >
            <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
                <div className="absolute -top-32 -right-32 w-80 h-80 bg-strava/15 blur-[100px] rounded-full" />
                <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-blue-600/15 blur-[100px] rounded-full" />
            </div>

            {isLoading && (
                <div className="absolute inset-0 z-30 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4 text-neutral-400">
                        <Zap className="w-10 h-10 text-strava animate-pulse" />
                        <p className="text-sm tracking-widest uppercase font-bold animate-pulse">Analizando...</p>
                    </div>
                </div>
            )}

            {/* CABECERA */}
            <motion.div variants={itemVars} className="relative z-10 flex justify-between items-start shrink-0">
                <div>
                    <p className="text-neutral-400 text-[10px] font-bold tracking-[0.2em] uppercase">
                        Monthly Pulse · {stats.monthName} {stats.year}
                    </p>
                    <p className="text-3xl font-black mt-1 tracking-tight truncate max-w-[200px]">
                        @{userName}
                    </p>
                </div>
                <div className="bg-strava p-2.5 rounded-2xl shadow-lg shadow-strava/20 shrink-0">
                    <Zap className="w-6 h-6 fill-white stroke-none" />
                </div>
            </motion.div>

            <div className="relative z-10 flex-grow flex flex-col gap-3">
                {/* ROW 1: Distancia + Tiempo */}
                <div className="grid grid-cols-2 gap-3 shrink-0">
                    <motion.div variants={itemVars} className="bg-neutral-900/60 backdrop-blur-md border border-white/5 rounded-3xl p-4 flex flex-col justify-between min-h-[115px]">
                        <div className="w-8 h-8 rounded-xl bg-orange-500/15 flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-orange-500" />
                        </div>
                        <div>
                            <p className="text-3xl font-black tracking-tighter leading-none mt-2">
                                {formatDistance(stats.totalDistance)}
                            </p>
                            <ComparisonBadge current={stats.totalDistance} prev={prevStats?.totalDistance} show={config.showComparison} />
                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Distancia</p>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVars} className="bg-neutral-900/60 backdrop-blur-md border border-white/5 rounded-3xl p-4 flex flex-col justify-between min-h-[115px]">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-3xl font-black tracking-tighter leading-none mt-2">
                                {formatTime(stats.totalTime)}
                            </p>
                            <ComparisonBadge current={stats.totalTime} prev={prevStats?.totalTime} show={config.showComparison} />
                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Tiempo</p>
                        </div>
                    </motion.div>
                </div>

                {/* ROW: Mapa + Ritmo */}
                <motion.div variants={itemVars} className="flex gap-3 shrink-0">
                    {/* WIDGET: Mapa (Half Width) */}
                    {config.showMap && svgPath && (
                        <div className="bg-neutral-900/60 backdrop-blur-md border border-white/5 rounded-3xl p-3 flex-1 flex flex-col relative overflow-hidden group min-h-[110px]">
                            <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest mb-0.5 relative z-10 w-[80%]">La ruta del mes</p>
                            <p className="text-[12px] font-bold truncate z-10 relative mb-4 pr-2">{stats.topActivity?.name}</p>
                            <div className="absolute inset-x-0 bottom-0 top-10 flex items-center justify-center p-2 opacity-90 mix-blend-screen drop-shadow-[0_0_8px_rgba(252,76,2,0.6)] object-contain">
                                <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="w-full h-full object-contain">
                                    <path d={svgPath} fill="none" stroke="url(#gradientMap)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="svg-draw-animation" />
                                    <defs>
                                        <linearGradient id="gradientMap" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#FC4C02" />
                                            <stop offset="100%" stopColor="#FF8F00" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </div>
                    )}

                    {/* WIDGET: Ritmo Top (Half Width) */}
                    {config.showPeaks && stats.bestPaceActivity && (
                        <div className="bg-neutral-900/40 border border-white/5 rounded-3xl p-3 flex-1 flex flex-col justify-between overflow-hidden relative min-h-[110px]">
                            <div className="absolute -right-4 -top-4 w-20 h-20 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
                            <div>
                                <div className="flex items-center gap-1.5 mb-1.5 text-purple-400">
                                    <Flame className="w-3.5 h-3.5" />
                                    <span className="text-[9px] uppercase font-bold tracking-widest">Ritmo Top</span>
                                </div>
                                <p className="text-[11px] font-bold leading-tight line-clamp-1 text-neutral-300 pr-1">
                                    {stats.bestPaceActivity.name}
                                </p>
                            </div>
                            <div className="mt-1 flex items-end justify-between">
                                <div>
                                    <p className="text-[15px] font-black text-white leading-none tracking-tight">
                                        {formatPace(stats.bestPaceActivity.speed)}
                                    </p>
                                    <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest mt-1">Ritmo</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[13px] font-black leading-none tracking-tight text-purple-400">
                                        {formatTime(stats.bestPaceActivity.duration)}
                                    </p>
                                    <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest mt-1">Tiempo</p>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* ROW: Elevación full width */}
                {config.showStory && stats.totalElevation > 0 && (
                    <motion.div variants={itemVars} className="bg-neutral-900/60 backdrop-blur-md border border-white/5 rounded-3xl p-4 shrink-0 flex items-center justify-between z-20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                <Mountain className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-black leading-none">{stats.totalElevation.toFixed(0)}m</p>
                                <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mt-1 leading-tight">
                                    {getElevationEquivalence(stats.totalElevation)}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <ComparisonBadge current={stats.totalElevation} prev={prevStats?.totalElevation} show={config.showComparison} />
                        </div>
                    </motion.div>
                )}

                {/* ROW: Grid (Día Más Activo + Desnivel Top) */}
                <motion.div variants={itemVars} className="grid grid-cols-2 gap-3 shrink-0">
                    {/* Día Más Activo (Half width) */}
                    {config.showMostActiveDay && (
                        <div className="bg-neutral-900/40 border border-white/5 rounded-3xl p-3 flex flex-col justify-between relative overflow-hidden min-h-[90px] z-10">
                            <div className="absolute -left-4 -top-4 w-16 h-16 bg-orange-500/10 rounded-full blur-xl pointer-events-none" />
                            <div className="flex items-center gap-2 mb-2 relative z-10">
                                <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex flex-col items-center justify-center shrink-0 leading-none">
                                    <span className="text-[7px] font-bold text-orange-400 uppercase tracking-widest">Día</span>
                                    <span className="text-[11px] font-black text-white shadow-sm">{stats.mostActiveDay ? stats.mostActiveDay.date.split(' ')[0] : '-'}</span>
                                </div>
                                <span className="text-[8px] uppercase font-bold tracking-widest text-orange-400 leading-tight">El Día Más<br />Activo</span>
                            </div>
                            <div className="relative z-10">
                                <p className="text-sm font-black text-white leading-none">
                                    {stats.mostActiveDay ? formatDistance(stats.mostActiveDay.distance) : '0 km'}
                                </p>
                                <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">totales</p>
                            </div>
                        </div>
                    )}

                    {/* Desnivel Top (Half width) */}
                    {config.showPeaks && (
                        <div className="bg-neutral-900/40 border border-white/5 rounded-3xl p-3 flex flex-col justify-between relative overflow-hidden min-h-[90px] z-10">
                            <div className="absolute -right-4 -top-4 w-20 h-20 bg-yellow-500/10 rounded-full blur-xl pointer-events-none" />
                            <div>
                                <div className="flex items-center gap-1.5 mb-1.5 text-yellow-400">
                                    <Medal className="w-3.5 h-3.5 shrink-0 drop-shadow-sm" />
                                    <span className="text-[9px] uppercase font-bold tracking-widest leading-none drop-shadow-sm">Desnivel Top</span>
                                </div>
                                <p className="text-[11px] font-bold text-neutral-300 leading-tight line-clamp-2 pr-1">
                                    {stats.topElevationActivity?.name ?? "N/A"}
                                </p>
                            </div>
                            <div className="mt-1">
                                <p className="text-sm font-black text-white leading-none">
                                    {stats.topElevationActivity ? `${stats.topElevationActivity.elevation.toFixed(0)}m` : "0m"} <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest ml-0.5">gain</span>
                                </p>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* WIDGET: Calendario */}
                {config.showCalendar && (
                    <motion.div variants={itemVars} className="bg-neutral-900/60 backdrop-blur-md border border-white/5 rounded-3xl p-4 shrink-0 flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-black leading-none">{stats.activeDaysCount}</p>
                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Días activos</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex flex-wrap gap-1 w-[120px] justify-end">
                                {Array.from({ length: Math.min(stats.daysInMonth || 30, 28) }).map((_, i) => {
                                    const isActive = stats.activeDays?.includes(i + 1);
                                    return (
                                        <div key={i} className={`w-2 h-2 rounded-sm ${isActive ? 'bg-strava shadow-[0_0_4px_#FC4C02]' : 'bg-neutral-800'}`} />
                                    );
                                })}
                            </div>
                            <ComparisonBadge current={stats.activeDaysCount} prev={prevStats?.activeDaysCount} show={config.showComparison} />
                        </div>
                    </motion.div>
                )}
            </div>

            <motion.div variants={itemVars} className="relative z-10 pt-3 flex justify-between items-end shrink-0 mt-auto border-t border-white/5">
                <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-neutral-600" />
                    <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                        {stats.dominantSport} Dominant
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[8px] text-neutral-600 uppercase tracking-widest">Generated via</p>
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">aaviles.dev/strava</p>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default BentoCard;
