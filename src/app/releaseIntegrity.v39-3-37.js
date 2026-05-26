import { BUILD_ID, RELEASE_CHANNEL, SIGNALING_PROTOCOL_VERSION, VERSION } from "../core/constants.js";

const RELEASE_CHECK_TIMEOUT_MS = 4500;

function withTrailingSlash(url) {
  return url.endsWith("/") ? url : `${url}/`;
}

export function healthUrlFor(signalingUrl) {
  try {
    const base = String(signalingUrl || "").trim();
    if (!base) return "";
    const url = new URL("health", withTrailingSlash(base));
    if (url.protocol === "ws:") url.protocol = "http:";
    if (url.protocol === "wss:") url.protocol = "https:";
    return url.toString();
  } catch {
    return "";
  }
}

export function initialReleaseState(signalingUrl) {
  return {
    status: "checking",
    message: `CLIENT ${VERSION.toUpperCase()} BUILD ${BUILD_ID}`,
    blockConnection: false,
    clientVersion: VERSION,
    clientBuildId: BUILD_ID,
    channel: RELEASE_CHANNEL,
    protocol: SIGNALING_PROTOCOL_VERSION,
    signalingUrl: String(signalingUrl || ""),
    healthUrl: healthUrlFor(signalingUrl),
    serverVersion: null,
    serverBuildId: null,
    serverProtocol: null,
    checkedAt: 0
  };
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, timer };
}

export async function checkReleaseIntegrity(signalingUrl, options = {}) {
  const healthUrl = healthUrlFor(signalingUrl);
  const base = initialReleaseState(signalingUrl);
  if (!healthUrl) {
    return {
      ...base,
      status: "invalid_config",
      message: "BAD SIGNALING URL",
      blockConnection: false,
      checkedAt: Date.now()
    };
  }

  const { controller, timer } = timeoutSignal(Number(options.timeoutMs) || RELEASE_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(healthUrl, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`health ${response.status}`);
    const health = await response.json();
    const serverProtocol = Number(health.protocol || 0);
    const serverVersion = String(health.version || "unknown");
    const serverBuildId = String(health.buildId || health.build || "unknown");
    const common = {
      ...base,
      serverVersion,
      serverBuildId,
      serverProtocol,
      raw: health,
      checkedAt: Date.now()
    };

    if (serverProtocol !== SIGNALING_PROTOCOL_VERSION) {
      return {
        ...common,
        status: "protocol_mismatch",
        message: `SERVER PROTOCOL ${serverProtocol || "?"} != ${SIGNALING_PROTOCOL_VERSION}`,
        blockConnection: true
      };
    }

    if (serverVersion !== VERSION || serverBuildId !== BUILD_ID) {
      return {
        ...common,
        status: "deploy_mismatch",
        message: `DEPLOY MISMATCH CLIENT ${VERSION.toUpperCase()} / SERVER ${serverVersion.toUpperCase()}`,
        blockConnection: false
      };
    }

    return {
      ...common,
      status: "ok",
      message: `SERVER OK ${serverVersion.toUpperCase()}`,
      blockConnection: false
    };
  } catch (err) {
    return {
      ...base,
      status: "health_unreachable",
      message: "SERVER CHECK FAILED",
      blockConnection: false,
      error: err?.message || String(err),
      checkedAt: Date.now()
    };
  } finally {
    clearTimeout(timer);
  }
}
