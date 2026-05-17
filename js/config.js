export const CONFIG = {
  signalingUrl:
    location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "ws://localhost:10000"
      : "wss://dengidermo-1.onrender.com"
};
