import { io, Socket } from "socket.io-client";
import { createSignal, onCleanup, onMount } from "solid-js";
import { authFetch } from "~/stores/auth";

let socket: Socket | null = null;
let initPromise: Promise<Socket> | null = null;

async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    const socketUrl = typeof window !== "undefined"
      ? `http://${window.location.hostname}:3001`
      : "";
    socket = io(socketUrl, {
      auth: { token: "" },
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 10,
    });

    const res = await authFetch("/api/auth/socket-token", { method: "POST" });
    const json = await res.json();
    const token = json.data?.token;
    if (token) {
      socket.auth = { token };
      socket.connect();
    }

    return new Promise<Socket>((resolve) => {
      const onConnect = () => {
        socket?.off("connect", onConnect);
        socket?.off("connect_error", onError);
        resolve(socket!);
      };
      const onError = () => {
        socket?.off("connect", onConnect);
        socket?.off("connect_error", onError);
        resolve(socket!);
      };
      if (socket?.connected) resolve(socket);
      else {
        socket?.on("connect", onConnect);
        socket?.on("connect_error", onError);
        socket?.connect();
      }
    });
  })();

  initPromise.then(() => { initPromise = null; });
  return initPromise;
}

export function useSocket() {
  const [connected, setConnected] = createSignal(false);

  onMount(() => {
    let s: Socket | undefined;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    getSocket().then((sock) => {
      s = sock;
      setConnected(sock.connected);
      sock.on("connect", onConnect);
      sock.on("disconnect", onDisconnect);
      sock.on("connect_error", onDisconnect);
    });

    // The socket is a module-level singleton; without removing these on unmount
    // every navigation permanently accrues listeners (MaxListenersExceededWarning).
    onCleanup(() => {
      s?.off("connect", onConnect);
      s?.off("disconnect", onDisconnect);
      s?.off("connect_error", onDisconnect);
    });
  });

  return {
    socket: () => socket,
    connected,
    emit: (event: string, data?: unknown) => {
      if (socket?.connected) {
        socket.emit(event, data);
      }
    },
    on: (event: string, handler: (...args: any[]) => void) => {
      socket?.on(event, handler);
    },
    off: (event: string, handler: (...args: any[]) => void) => {
      socket?.off(event, handler);
    },
  };
}
