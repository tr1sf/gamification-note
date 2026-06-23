import "dotenv/config";
import http from "http";
import { initSocket } from "./src/lib/socket/index";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function main() {
  const build = await import("./.output/server/index.mjs");
  const handler = build.default || build.handler || build.listener;
  if (!handler) {
    console.error("Could not find handler export in build output");
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
