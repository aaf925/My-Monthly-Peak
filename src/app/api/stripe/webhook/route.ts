import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripe(): Stripe {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY no está configurada");
    return new Stripe(key);
}

async function getUserIdFromEvent(event: Stripe.Event): Promise<string | null> {
    const obj = event.data.object as any;
    return obj?.metadata?.userId ?? obj?.customer ? null : null;
}

export async function POST(req: NextRequest) {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        return NextResponse.json(
            { ok: false, error: "STRIPE_WEBHOOK_SECRET no configurada" },
            { status: 500 }
        );
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
        return NextResponse.json({ ok: false, error: "Falta firma" }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
        const rawBody = await req.text();
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return NextResponse.json({ ok: false, error: "Firma inválida" }, { status: 400 });
    }

    const prisma = getPrisma();

    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = session.metadata?.userId;
            const subscriptionId = session.subscription as string;

            if (userId) {
                // Localizar el customer en el user
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (user && session.customer) {
                    await prisma.user.update({
                        where: { id: userId },
                        data: {
                            plan: "PRO",
                            stripeCustomerId: String(session.customer),
                            stripeSubscriptionId: subscriptionId || user.stripeSubscriptionId,
                        },
                    });
                }
            }
            break;
        }

        case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;
            const userId = subscription.metadata?.userId;
            if (!userId) break;

            const active = subscription.status === "active" || subscription.status === "trialing";
            await prisma.user.update({
                where: { id: userId },
                data: {
                    plan: active ? "PRO" : "FREE",
                    stripeSubscriptionId: subscription.id,
                },
            });
            break;
        }

        case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            const userId = subscription.metadata?.userId;
            if (!userId) break;

            await prisma.user.update({
                where: { id: userId },
                data: { plan: "FREE" },
            });
            break;
        }
    }

    return NextResponse.json({ received: true });
}