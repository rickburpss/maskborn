import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  BACKEND_PUBLIC_URL: z.string().url().default("http://localhost:4000"),
  DATABASE_URL: z.string().min(1),
  SESSION_PEPPER: z.string().min(16).default("development-session-pepper-change-me"),
  SIGNAL_PEPPER: z.string().min(16).default("development-signal-pepper-change-me"),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_CALLBACK_URL: z.string().url().optional(),
  ALLOW_DEV_AUTH: z.enum(["true", "false"]).default("false"),
  STORAGE_LOCAL_DIR: z.string().min(1).default(".local-storage"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_PRIVATE_BUCKET: z.string().optional(),
  R2_PUBLIC_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
}).superRefine((value, ctx) => {
  const r2Values = [
    value.R2_ACCOUNT_ID,
    value.R2_ACCESS_KEY_ID,
    value.R2_SECRET_ACCESS_KEY,
    value.R2_PRIVATE_BUCKET,
    value.R2_PUBLIC_BUCKET,
    value.R2_PUBLIC_BASE_URL,
  ];
  const configured = r2Values.filter(Boolean).length;
  if (configured > 0 && configured !== r2Values.length) {
    ctx.addIssue({
      code: "custom",
      message: "Configure every R2 variable or leave all of them empty for local object storage.",
      path: ["R2_ACCOUNT_ID"],
    });
  }
  if (value.NODE_ENV === "production" && configured !== r2Values.length) {
    ctx.addIssue({
      code: "custom",
      message: "R2 object storage is required in production.",
      path: ["R2_ACCOUNT_ID"],
    });
  }
});

export const config = schema.parse(process.env);
