import "dotenv/config";
import http from "http";
import { initSocket } from "./src/lib/socket/index";

// Import Nitro runtime directly from chunks (bypasses auto-starting entry module)
// The entry .output/server/index.mjs creates AND auto-starts its own server,
// causing EADDRINUSE when server.ts also tries to listen on the same port.
import {
  t as toNodeListener,
  b as useNitroApp,
  a as trapUnhandledNodeErrors,
  s as setupGracefulShutdown,
} from "./.output/server/chunks/_/nitro.mjs";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function main() {
  try {
    const cert = process.env.NITRO_SSL_CERT;
    const key = process.env.NITRO_SSL_KEY;
    const nitroApp = useNitroApp();
    const handler = toNodeListener(nitroApp.h3App);

    const server = cert && key
      ? new (await import("node:https")).Server({ key, cert }, handler)
      : new http.Server(handler);

    initSocket(server);

    const listener = server.listen(PORT, () => {
      console.log(`[tavernotex] HTTP + WebSocket running on port ${PORT}`);
    });

    trapUnhandledNodeErrors();
    setupGracefulShutdown(listener, nitroApp);
  } catch (err) {
    console.error("[tavernotex] Failed to start:", (err as Error).message);
    process.exit(1);
  }
}

main();
