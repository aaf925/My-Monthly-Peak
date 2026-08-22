import "dotenv/config";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js carga .env.local; el CLI de Prisma necesita que se lo indiquemos.
dotenv.config({ path: ".env.local" });
dotenv.config();

export default defineConfig({
    schema: "prisma/schema.prisma",
    datasource: {
        url: process.env.DATABASE_URL,
    },
});