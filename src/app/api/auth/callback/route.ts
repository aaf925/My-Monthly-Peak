import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
        return NextResponse.redirect(new URL(`/?error=${error}`, req.url));
    }

    if (!code) {
        return NextResponse.redirect(new URL(`/?error=no_code`, req.url));
    }

    try {
        const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
        // Puede que lo tengas con o sin el prefijo NEXT_PUBLIC_
        const clientSecret = process.env.STRAVA_CLIENT_SECRET || process.env.NEXT_PUBLIC_STRAVA_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            console.error("Faltan variables de entorno de Strava");
            return NextResponse.redirect(new URL("/?error=missing_env", req.url));
        }

        // Intercambio de código por token (Server-Side)
        const res = await fetch("https://www.strava.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                grant_type: "authorization_code",
            }),
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("Fallo el intercambio de token:", errorText);
            return NextResponse.redirect(new URL("/?error=token_exchange_failed", req.url));
        }

        const data = await res.json();

        // El email NO viene en la respuesta del token: hay que pedirlo al
        // endpoint /athlete (requiere scope profile:read_all).
        let athleteDetail = data.athlete;
        try {
            const profileRes = await fetch("https://www.strava.com/api/v3/athlete", {
                headers: { Authorization: `Bearer ${data.access_token}` },
            });
            if (profileRes.ok) {
                athleteDetail = await profileRes.json();
            }
        } catch (err) {
            console.error("No se pudo obtener el perfil completo de Strava:", err);
        }

        // Redirigir al dashboard
        const response = NextResponse.redirect(new URL("/", req.url));

        // Persistir/actualizar el User en PostgreSQL (plan FREE por defecto).
        try {
            const prisma = getPrisma();
            await prisma.user.upsert({
                where: { stravaAthleteId: data.athlete.id },
                create: {
                    stravaAthleteId: data.athlete.id,
                    stravaAccessToken: data.access_token,
                    stravaRefreshToken: data.refresh_token,
                    stravaTokenExpiresAt: new Date(data.expires_at * 1000),
                    name: data.athlete.firstname
                        ? `${data.athlete.firstname} ${data.athlete.lastname ?? ""}`.trim()
                        : null,
                    email: athleteDetail.email ?? null,
                    avatarUrl: data.athlete.profile_medium ?? athleteDetail.profile_medium ?? null,
                    plan: "FREE",
                },
                update: {
                    stravaAccessToken: data.access_token,
                    stravaRefreshToken: data.refresh_token,
                    stravaTokenExpiresAt: new Date(data.expires_at * 1000),
                    name: data.athlete.firstname
                        ? `${data.athlete.firstname} ${data.athlete.lastname ?? ""}`.trim()
                        : undefined,
                    email: athleteDetail.email ?? undefined,
                    avatarUrl: data.athlete.profile_medium ?? athleteDetail.profile_medium ?? undefined,
                },
            });
        } catch (err) {
            console.error("No se pudo persistir el usuario en DB:", err);
        }

        // Guardar la sesión en cookies para evitar base de datos.
        // Se pone httpOnly en false para poder leerlo desde page.tsx
        response.cookies.set("strava_session", JSON.stringify(data), {
            path: "/",
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 30, // 30 días
            sameSite: "lax",
        });

        return response;

    } catch (err) {
        console.error("Error en la ruta de callback:", err);
        return NextResponse.redirect(new URL("/?error=server_error", req.url));
    }
}
