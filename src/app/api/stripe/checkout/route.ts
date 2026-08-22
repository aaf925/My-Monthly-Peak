import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { findOrCreateUserFromCookie, ProRequiredError } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripe(): Stripe {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new ProRequiredError("Stripe no está configurado", 500);
    return new Stripe(key);
}

export async function POST(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("strava_session")?.value;
        const user = await findOrCreateUserFromCookie(sessionCookie);
        if (!user) throw new ProRequiredError("No autenticado", 401);

        const stripe = getStripe();
        const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;
        if (!priceId) throw new ProRequiredError("Precio de Stripe no configurado", 500);

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

        // Crear/actualizar el Customer de Stripe vinculado a nuestro User
        let customerId = user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                metadata: { userId: user.id, stravaAthleteId: String(user.stravaAthleteId) },
            });
            customerId = customer.id;
            await getPrisma().user.update({
                where: { id: user.id },
                data: { stripeCustomerId: customerId },
            });
        }

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${baseUrl}/?checkout=success`,
            cancel_url: `${baseUrl}/?checkout=cancelled`,
            metadata: { userId: user.id },
            subscription_data: {
                metadata: { userId: user.id },
            },
        });

        return NextResponse.json({ ok: true, url: session.url });
    } catch (err) {
        if (err instanceof ProRequiredError) {
            return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
        }
        console.error("stripe checkout error:", err);
        return NextResponse.json({ ok: false, error: "Error al crear la sesión de pago" }, { status: 500 });
    }
}