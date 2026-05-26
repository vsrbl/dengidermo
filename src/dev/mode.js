const DEV_TOKEN = "void-v33-test";
const DEV_FLAG_KEYS = ["nn_dev", "dev", "test"];

function readParam(params, keys) {
  for (const key of keys) {
    const value = params.get(key);
    if (value !== null) return value;
  }
  return null;
}

function boolParam(params, key, fallback = false) {
  const value = params.get(key);
  if (value === null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(normalized)) return false;
  if (["1", "true", "on", "yes", ""].includes(normalized)) return true;
  return fallback;
}

function urlParamsFromLocation(locationLike) {
  const href = typeof locationLike === "string"
    ? locationLike
    : locationLike?.href || "http://nncckkrr.space/";
  const url = new URL(href, "http://nncckkrr.space/");
  const params = new URLSearchParams(url.search);
  const hash = String(url.hash || "").replace(/^#/, "");
  const hashParams = new URLSearchParams(hash.includes("=") ? hash : "");
  for (const [key, value] of hashParams.entries()) params.set(key, value);
  return params;
}

export function readDevConfig(locationLike = globalThis.location) {
  const params = urlParamsFromLocation(locationLike);
  const token = readParam(params, DEV_FLAG_KEYS);
  const enabled = token === DEV_TOKEN;
  if (!enabled) return { enabled: false, tokenOk: false };

  return {
    enabled: true,
    tokenOk: true,
    access: "secret-link",
    profile: String(params.get("profile") || "calm").toLowerCase(),
    calm: boolParam(params, "calm", true),
    god: boolParam(params, "god", false),
    spawnsPaused: boolParam(params, "pause", false),
    showHud: boolParam(params, "devhud", true)
  };
}

export function devSecretHint() {
  return `#dev=${DEV_TOKEN}`;
}
