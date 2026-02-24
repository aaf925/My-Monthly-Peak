import { NextRequest, NextResponse } from "next/server";

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

        // Redirigir al dashboard
        const response = NextResponse.redirect(new URL("/", req.url));

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
