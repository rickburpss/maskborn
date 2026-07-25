import { app } from "./app.js";
import { config } from "./config.js";
import { db } from "./db.js";

const server = app.listen(config.PORT, () => {
  console.log(`Maskborn API listening on http://localhost:${config.PORT}`);
});

const close = async (signal: string) => {
  console.log(`${signal}: shutting down`);
  server.close(async () => {
    await db.$disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", () => void close("SIGINT"));
process.on("SIGTERM", () => void close("SIGTERM"));
