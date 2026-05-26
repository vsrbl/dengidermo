// Runtime deployment config.
// This file is copied into GitHub Pages build output by Vite.
// Keep game code clean: change URLs here instead of editing bundled JS.

window.NN_PUBLIC_SITE_URL = "https://nncckkrr.space";
window.NN_BACKEND_HTTP_URL = "https://dengidermo-1.onrender.com";
window.NN_BACKEND_WS_URL = "wss://dengidermo-1.onrender.com/ws";

// Legacy names kept only so future experiments or old bookmarks do not break.
// New code reads NN_BACKEND_WS_URL first.
window.NN_SIGNALING_URL = window.NN_BACKEND_HTTP_URL;
window.NN_COLYSEUS_URL = window.NN_BACKEND_HTTP_URL;
