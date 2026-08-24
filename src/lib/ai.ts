import OpenAI from "openai";

/**
 * IA — Generación del resumen mensual vía OpenRouter (gpt-4o-mini).
 * OpenRouter es compatible con la API de OpenAI, solo cambia baseURL y clave.
 */

export type InsightKind = "summary";

export interface MonthlyInsightInput {
    kind: InsightKind;
    lang: "es" | "en";
    userName: string;
    monthName: string;
    year: number;
    activityCount: number;
    activeDays: number;
    distanceKm: number;
    elevationM: number;
    avgPace: string | null; // formato "MM:SS" (min/km o min/100m según deporte)
    paceUnit?: string; // "min/km" | "min/100m"
    avgHeartrate: number | null;
    dominantSport: string;
    hasTrueEffort: boolean;
    recordsBroken?: string[];
    prevStats?: {
        distanceKm: number;
        activityCount: number;
    };
}

function getOpenAI(): OpenAI {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY no está configurada");
    return new OpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
    });
}

function buildSystemPrompt(lang: "es" | "en"): string {
    return lang === "es"
        ? "Eres 'My Monthly Peak', un entrenador motivador y analítico. Habla en español. Máximo 3 frases. Usa emojis con moderación. Menciona números reales. El ritmo siempre en formato MM:SS con su unidad exacta (por ejemplo 5:42 min/km o 1:50 min/100m en natación). Nunca inventes datos."
        : "You are 'My Monthly Peak', a motivating and analytical coach. Speak in English. Max 3 sentences. Use emojis sparingly. Mention real numbers. Always format pace as MM:SS with its exact unit (e.g. 5:42 min/km or 1:50 min/100m for swimming). Never invent data.";
}

function buildUserPrompt(input: MonthlyInsightInput): string {
    const base = [
        `Mes: ${input.monthName} ${input.year}`,
        `Usuario: ${input.userName}`,
        `Actividades: ${input.activityCount} en ${input.activeDays} días activos`,
        `Tipo de actividad: ${input.dominantSport}`,
        `Distancia: ${input.distanceKm} km`,
        `Desnivel: ${input.elevationM} m`,
        `Ritmo medio: ${input.avgPace ? `${input.avgPace} ${input.paceUnit ?? "min/km"}` : "n/d"}`,
        `Pulsaciones medias: ${input.avgHeartrate ? `${input.avgHeartrate} bpm` : "n/d"}`,
    ];

    if (input.recordsBroken?.length) {
        base.push(`Récords batidos: ${input.recordsBroken.join(", ")}`);
    }
    if (input.prevStats) {
        const d = input.distanceKm - input.prevStats.distanceKm;
        const sign = d >= 0 ? "+" : "";
        base.push(`Comparado con el mes anterior: distancia ${sign}${d.toFixed(1)} km`);
    }
    if (input.hasTrueEffort) {
        base.push("Nota: el usuario usa True Effort (ritmos ajustados por clima).");
    }

    return `Escribe un resumen positivo y motivador de su evolución, centrado SOLO en ${input.dominantSport}. Destaca logros y mejoras. Datos:\n${base.join("\n")}`;
}

export async function generateInsight(input: MonthlyInsightInput): Promise<string> {
    const openai = getOpenAI();

    const completion = await openai.chat.completions.create({
        model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
        messages: [
            { role: "system", content: buildSystemPrompt(input.lang) },
            { role: "user", content: buildUserPrompt(input) },
        ],
        temperature: 0.7,
        max_tokens: 150,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error("OpenAI no devolvió contenido");
    return text;
}