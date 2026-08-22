import OpenAI from "openai";

/**
 * IA — Generación de roast y resumen mensual vía OpenRouter (gpt-4o-mini).
 * OpenRouter es compatible con la API de OpenAI, solo cambia baseURL y clave.
 */

export type InsightKind = "roast" | "summary";

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
    avgPaceMinKm: number | null;
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

function buildSystemPrompt(lang: InsightKind extends never ? never : "es" | "en"): string {
    return lang === "es"
        ? "Eres 'My Monthly Peak', un entrenador sarcástico pero motivador. Habla en español. Máximo 2 frases. Usa emojis con moderación. Menciona números reales. Nunca inventes datos."
        : "You are 'My Monthly Peak', a sarcastic but motivating coach. Speak in English. Max 2 sentences. Use emojis sparingly. Mention real numbers. Never invent data.";
}

function buildUserPrompt(input: MonthlyInsightInput): string {
    const { kind } = input;
    const base = [
        `Mes: ${input.monthName} ${input.year}`,
        `Usuario: ${input.userName}`,
        `Actividades: ${input.activityCount} en ${input.activeDays} días activos`,
        `Distancia: ${input.distanceKm} km`,
        `Desnivel: ${input.elevationM} m`,
        `Ritmo medio: ${input.avgPaceMinKm ? `${input.avgPaceMinKm} min/km` : "n/d"}`,
        `Pulsaciones medias: ${input.avgHeartrate ? `${input.avgHeartrate} bpm` : "n/d"}`,
        `Deporte dominante: ${input.dominantSport}`,
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

    if (kind === "roast") {
        return `Vacila (con cariño) su rendimiento del mes. Datos:\n${base.join("\n")}`;
    }
    return `Escribe un resumen positivo y motivador de su evolución. Destaca logros y mejoras. Datos:\n${base.join("\n")}`;
}

export async function generateInsight(input: MonthlyInsightInput): Promise<string> {
    const openai = getOpenAI();

    const completion = await openai.chat.completions.create({
        model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
        messages: [
            { role: "system", content: buildSystemPrompt(input.lang) },
            { role: "user", content: buildUserPrompt(input) },
        ],
        temperature: 0.8,
        max_tokens: 120,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error("OpenAI no devolvió contenido");
    return text;
}