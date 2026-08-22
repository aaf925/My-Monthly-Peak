import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { findOrCreateUserFromCookie, ProRequiredError } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("strava_session")?.value;
        const user = await findOrCreateUserFromCookie(sessionCookie);
        if (!user) throw new ProRequiredError("No autenticado", 401);

        return NextResponse.json({
            ok: true,
            email: user.email,
            emailRemindersEnabled: user.emailRemindersEnabled,
            plan: user.plan,
        });
    } catch (err) {
        if (err instanceof ProRequiredError) {
            return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
        }
        return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("strava_session")?.value;
        const user = await findOrCreateUserFromCookie(sessionCookie);
        if (!user) throw new ProRequiredError("No autenticado", 401);

        const body = (await req.json().catch(() => ({}))) as {
            email?: string;
            emailRemindersEnabled?: boolean;
        };

        const data: { email?: string | null; emailRemindersEnabled?: boolean } = {};
        if (typeof body.email === "string") {
            const email = body.email.trim().toLowerCase();
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return NextResponse.json({ ok: false, error: "Email inválido" }, { status: 400 });
            }
            data.email = email || null;
        }
        if (typeof body.emailRemindersEnabled === "boolean") {
            data.emailRemindersEnabled = body.emailRemindersEnabled;
        }

        if (Object.keys(data).length > 0) {
            await getPrisma().user.update({ where: { id: user.id }, data });
        }

        const updated = await getPrisma().user.findUnique({ where: { id: user.id } });
        return NextResponse.json({
            ok: true,
            email: updated?.email,
            emailRemindersEnabled: updated?.emailRemindersEnabled,
            plan: updated?.plan,
        });
    } catch (err) {
        if (err instanceof ProRequiredError) {
            return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
        }
        return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
    }
}