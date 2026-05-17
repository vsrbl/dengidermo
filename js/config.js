export const CONFIG = {
  // После деплоя Render замени на свой адрес, например:
  // signalingUrl: "wss://dengidermo-signaling.onrender.com"
  signalingUrl:
    location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "ws://localhost:10000"
      : "wss://dengidermo-signaling.onrender.com"
};
