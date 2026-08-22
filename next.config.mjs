/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        domains: ['dgalywyr863hv.cloudfront.net'], // Strava activity images / maps
    },
    experimental: {
        // Evita que webpack bundlee @vercel/og (rompe import.meta.url en Windows).
        serverComponentsExternalPackages: ['@vercel/og'],
    },
    webpack: (config) => {
        // Next 14.1.0 aliasa @vercel/og a su copia compilada, que en Windows
        // rompe la resolución de fuentes (join(import.meta.url,...)). Forzamos
        // el paquete real instalado (usa new URL(), correcto en Win).
        config.resolve.alias['@vercel/og'] = '@vercel/og';
        config.resolve.alias['@vercel/og$'] = '@vercel/og';
        return config;
    },
};

export default nextConfig;
