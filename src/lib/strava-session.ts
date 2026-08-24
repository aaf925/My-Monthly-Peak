import { getPrisma } from "@/lib/db";
import { refreshStravaToken } from "@/lib/strava";

/**
 * Devuelve un access token de Strava válido para el usuario, refrescándolo
 * desde la DB si ha caducado. El refresh token de Strava rota: hay que
 * guardar SIEMPRE el refresh_token nuevo que devuelve la API.
 */
export async function getValidStravaToken(userId: string): Promise<string> {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user?.stravaAccessToken || !user.stravaRefreshToken) {
        throw new Error("El usuario no tiene tokens de Strava");
    }

    const now = Date.now();
    const expiresAt = user.stravaTokenExpiresAt ? user.stravaTokenExpiresAt.getTime() : 0;

    // Si falta < 30 min o ya expiró, refrescamos
    if (!expiresAt || now >= expiresAt - 30 * 60 * 1000) {
        try {
            const refreshed = await refreshStravaToken(user.stravaRefreshToken);
            await prisma.user.update({
                where: { id: userId },
                data: {
                    stravaAccessToken: refreshed.access_token,
                    stravaRefreshToken: refreshed.refresh_token,
                    stravaTokenExpiresAt: new Date(refreshed.expires_at * 1000),
                },
            });
            return refreshed.access_token;
        } catch (err) {
            throw new Error(`No se pudo refrescar el token de Strava: ${(err as Error).message}`);
        }
    }

    return user.stravaAccessToken;
}