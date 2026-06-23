import { io, Socket } from "socket.io-client";
import { createSignal, onCleanup, onMount } from "solid-js";
import { authFetch } from "~/stores/auth";

let socket: Socket | null = null;
let initPromise: Promise<Socket> | null = null;

async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  if (initPromise) return initPromise;

  // Socket was created before but is currently disconnected (e.g. the socket
  // server started after the page loaded and the client exhausted its retries).
  // Reuse the existing instance and kick off a reconnect rather than building a
  // second socket, which would orphan the listeners registered on the first.
  if (socket) {
    socket.connect();
    return socket;
  }

  initPromise = (async () => {
    const isLocalDev = typeof window !== "undefined" && (
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    );
    const socketUrl = typeof window !== "undefined"
      ? (isLocalDev ? `http://${window.location.hostname}:3001` : window.location.origin)
      : "";
    socket = io(socketUrl, {
      auth: { token: "" },
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnectionDelayMax: 10000,
      // Keep retrying indefinitely so a socket server that comes up *after* the
      // page loaded is eventually picked up (common in local dev).
      reconnectionAttempts: Infinity,
    });

    // When the access token expires while the socket is disconnected,
    // automatic reconnect attempts will be rejected with an auth error. Fetch
    // a fresh socket token and retry with the new credentials.
    let refreshTokenPromise: Promise<void> | null = null;

    socket.on("connect_error", async (err) => {
      const message = err?.message ?? "";
      if (message !== "Invalid token" && message !== "Unauthorized") return;
      if (refreshTokenPromise) return;

      refreshTokenPromise = (async () => {
        try {
          const res = await authFetch("/api/auth/socket-token", { method: "POST" });
          const json = await res.json();
          const newToken = json.data?.token;
          if (newToken && socket) {
            socket.auth = { token: newToken };
            socket.disconnect().connect();
          }
        } catch {
          // If refreshing fails, the next automatic reconnect attempt will hit
          // this handler again and retry — same resilience as authFetch itself.
        }
      })();

      try {
        await refreshTokenPromise;
      } finally {
        refreshTokenPromise = null;
      }
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

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
  }
  socket = null;
  initPromise = null;
}

export function useSocket() {
  const [connected, setConnected] = createSignal(false);

  onMount(() => {
    // Guard against registration after unmount: getSocket() is async, and if
    // the component unmounts before it resolves (immediate auth redirect,
    // hot navigation, etc.) the .then() would register listeners on the
    // module-level singleton owned by nobody — a permanent leak.
    let cancelled = false;
    let s: Socket | undefined;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    getSocket().then((sock) => {
      if (cancelled) return;
      s = sock;
      setConnected(sock.connected);
      sock.on("connect", onConnect);
      sock.on("disconnect", onDisconnect);
      sock.on("connect_error", onDisconnect);
    });

    // The socket is a module-level singleton; without removing these on unmount
    // every navigation permanently accrues listeners (MaxListenersExceededWarning).
    onCleanup(() => {
      cancelled = true;
      s?.off("connect", onConnect);
      s?.off("disconnect", onDisconnect);
      s?.off("connect_error", onDisconnect);
    });
  });

  return {
    socket: () => socket,
    connected,
    // Ensure the socket exists and a (re)connection is in flight, then resolve
    // with the live connection state. Lets callers await connectivity before a
    // critical emit instead of dropping it.
    ensureConnected: async (): Promise<boolean> => {
      const s = await getSocket();
      return !!s?.connected;
    },
    // No `connected` guard: socket.io buffers emits made while disconnected and
    // flushes them on (re)connect, so a message sent during a brief reconnect
    // is delivered rather than silently dropped.
    emit: (event: string, data?: unknown) => {
      socket?.emit(event, data);
    },
    on: (event: string, handler: (...args: any[]) => void) => {
      socket?.on(event, handler);
    },
    off: (event: string, handler: (...args: any[]) => void) => {
      socket?.off(event, handler);
    },
  };
}
