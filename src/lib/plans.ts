import { getPrisma } from "@/lib/db";
import type { User } from "@/generated/prisma/client";

export class ProRequiredError extends Error {
    status: number;
    constructor(message: string, status = 403) {
        super(message);
        this.name = "ProRequiredError";
        this.status = status;
    }
}

/**
 * Extrae el athleteId de Strava desde la cookie de sesión (strava_session).
 */
export function getAthleteIdFromCookie(cookieValue?: string): number | null {
    if (!cookieValue) return null;
    try {
        const data = JSON.parse(decodeURIComponent(cookieValue));
        const id = data?.athlete?.id;
        return typeof id === "number" ? id : null;
    } catch {
        return null;
    }
}

/**
 * Busca (o crea en el primer login) el User en la base de datos a partir de la
 * cookie de sesión. Devuelve null si no hay sesión.
 */
export async function findOrCreateUserFromCookie(cookieValue?: string): Promise<User | null> {
    const athleteId = getAthleteIdFromCookie(cookieValue);
    if (!athleteId) return null;

    const prisma = getPrisma();

    let user = await prisma.user.findUnique({ where: { stravaAthleteId: athleteId } });

    if (!user) {
        user = await prisma.user.create({
            data: {
                stravaAthleteId: athleteId,
                plan: "FREE",
            },
        });
    }

    return user;
}

/**
 * Verifica que el usuario tenga una suscripción PRO activa.
 * Lanza ProRequiredError (403) si no la tiene; devuelve el User si es PRO.
 */
export async function requireProPlan(userId: string): Promise<User> {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new ProRequiredError("Usuario no encontrado", 404);
    if (user.plan !== "PRO") {
        throw new ProRequiredError("Esta función requiere el plan PRO. Suscríbete para desbloquearla.");
    }

    return user;
}

/**
 * Comprueba si una suscripción de Stripe sigue activa (más fiable que solo `plan`).
 * Si Stripe no está configurado (modo test sin keys), confía en el plan de la DB.
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;
    if (user.plan !== "PRO") return false;
    if (!user.stripeSubscriptionId) return false;

    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) return true; // Sin Stripe configurado → confiar en la DB (modo dev/test)

    try {
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(apiKey);
        const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        return sub.status === "active" || sub.status === "trialing";
    } catch {
        return true;
    }
}