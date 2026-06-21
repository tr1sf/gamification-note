import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
    shadowDatabaseUrl: "postgresql://tavernote:tavernote_dev@localhost:5432/tavernotex_shadow",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
