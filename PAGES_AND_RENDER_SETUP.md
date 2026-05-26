# GitHub Pages + Render setup for nncckkrr.space

This project is a fresh start. The only pieces copied from the previous archive are deployment/network settings:

- `nncckkrr.space`
- `dengidermo-1.onrender.com`
- `CNAME`
- `.nojekyll`
- runtime `config.js`
- `render.yaml`

## Files that matter

```text
CNAME                         # root copy, useful if you ever publish from repo root
.nojekyll                     # root copy
client/public/CNAME           # copied into client/dist/CNAME by Vite
client/public/.nojekyll       # copied into client/dist/.nojekyll by Vite
client/public/config.js       # runtime backend URLs
.github/workflows/pages.yml   # GitHub Pages deployment
render.yaml                   # Render backend deployment
```

## GitHub Pages

In repository settings, set Pages source to **GitHub Actions**.

The workflow builds only the browser client and uploads `client/dist` to Pages.

The custom domain file is included in the build output:

```text
client/public/CNAME -> client/dist/CNAME
```

The CNAME value is:

```text
nncckkrr.space
```

## Render

Render runs the authoritative WebSocket server.

```text
HTTP health: https://dengidermo-1.onrender.com/health
WebSocket:   wss://dengidermo-1.onrender.com/ws
```

`render.yaml` sets:

```text
CLIENT_ORIGINS=https://nncckkrr.space,https://vsrbl.github.io,http://localhost:5173,http://127.0.0.1:5173
```

## Connection config

The client loads this before game code:

```html
<script src="./config.js"></script>
```

`config.js` defines:

```js
window.NN_BACKEND_HTTP_URL = "https://dengidermo-1.onrender.com";
window.NN_BACKEND_WS_URL = "wss://dengidermo-1.onrender.com/ws";
```

So later you can change backend URL without rebuilding the TypeScript bundle.

## Important

If `https://nncckkrr.space` says `There isn't a GitHub Pages site here`, that usually means Pages is not enabled/deployed yet, or the custom domain is pointing to GitHub before a Pages site exists. The files in this package make the repo ready, but GitHub Pages must still be enabled in repo settings and the Actions workflow must run successfully.
