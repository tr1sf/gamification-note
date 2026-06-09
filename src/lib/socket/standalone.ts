import http from "http";
import { initSocket } from "./index";

const PORT = parseInt(process.env.SOCKET_PORT || "3001", 10);

const server = http.createServer();
initSocket(server);

server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});
