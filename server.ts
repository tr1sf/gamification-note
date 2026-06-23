import "dotenv/config";
import http from "http";
import { initSocket } from "./src/lib/socket/index";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function main() {
  let handler: http.RequestListener;

  try {
    const build = await import("./.output/server/index.mjs");
    handler = build.default || build.handler || build.listener;
    if (!handler) throw new Error("No handler export found");
  } catch (err) {
    console.error("[tavernotex] Failed to load build output:", (err as Error).message);
    console.error("[tavernotex] Make sure you ran 'npm run build' first.");
    process.exit(1);
  }

  const server = http.createServer(handler);
  initSocket(server);

  server.listen(PORT, () => {
    console.log(`[tavernotex] HTTP + WebSocket running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
