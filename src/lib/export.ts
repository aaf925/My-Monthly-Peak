"use client";

/**
 * exportAsImage — Convierte un elemento DOM en una imagen PNG de alta calidad.
 *
 * Configuración para compartir en Instagram/Twitter:
 * - pixelRatio: 3  →  Triple resolución (e.g. 1200×1600 px para una card de 400×533)
 * - quality: 1     →  Máxima calidad sin compresión
 * - Se llama dos veces seguidas para evitar el bug de html-to-image con las
 *   fuentes externas (Google Fonts) que no carga correctamente en la primera pasada.
 */

import { toPng } from "html-to-image";

export const exportAsImage = async (
    elementId: string,
    fileName: string
): Promise<void> => {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element #${elementId} not found`);
        return;
    }

    const options = {
        cacheBust: true,
        backgroundColor: "#050505",
        pixelRatio: 3,
        quality: 1,
        includeQueryParams: true,
    };

    try {
        // Primera pasada: "calienta" la caché de fuentes dentro del canvas
        await toPng(element, options);
        // Segunda pasada: resultado final nítido con fuentes correctas
        const dataUrl = await toPng(element, options);

        const link = document.createElement("a");
        link.download = `${fileName}.png`;
        link.href = dataUrl;
        link.click();
    } catch (err) {
        console.error("Export failed:", err);
        alert("Hubo un error al exportar. Inténtalo de nuevo.");
    }
};
