import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  SESSION_PEPPER: z.string().min(16).default("development-session-pepper-change-me"),
  SIGNAL_PEPPER: z.string().min(16).default("development-signal-pepper-change-me"),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_CALLBACK_URL: z.string().url().optional(),
  ALLOW_DEV_AUTH: z.enum(["true", "false"]).default("false"),
});

export const config = schema.parse(process.env);
