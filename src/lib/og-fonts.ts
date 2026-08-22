import type { SatoriOptions } from "satori";

type FontOptions = NonNullable<SatoriOptions["fonts"]>[number];

const WEIGHTS = [400, 600, 700, 800, 900] as const;

/**
 * Carga Inter desde Google Fonts (con cache en memoria) para Satori.
 * Los parámetros cambian el cache-buster de Google, pero la URL css2 es estable.
 */
async function fetchFontData(weight: (typeof WEIGHTS)[number]): Promise<ArrayBuffer | null> {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&display=swap`;

    const css = await fetch(cssUrl, {
        headers: {
            // UA antiguo → Google sirve .ttf (Satori de @vercel/og 1.0.1 no parsea .woff2).
            "User-Agent": "Mozilla/4.0",
        },
    }).then((r) => r.text());

    const urlMatch = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/);
    if (!urlMatch) return null;

    const font = await fetch(urlMatch[1]);
    if (!font.ok) return null;
    return font.arrayBuffer();
}

let fontCache: FontOptions[] | null = null;

export async function getInterFonts(): Promise<FontOptions[]> {
    if (fontCache) return fontCache;

    const loaded: FontOptions[] = [];
    for (const weight of WEIGHTS) {
        const data = await fetchFontData(weight);
        if (data) loaded.push({ name: "Inter", data, weight });
    }

    // Si falla la red, Satori usa su fuente por defecto (sin cachear).
    fontCache = loaded.length > 0 ? loaded : [];
    return fontCache;
}