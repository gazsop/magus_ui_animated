export const RUNTIME_CONFIG = {
  protocol: __PROTOCOL__,
  serverUri: __SERVER_URI__,
} as const;

const BUILD_TIME_API_BASE = `${RUNTIME_CONFIG.protocol}${RUNTIME_CONFIG.serverUri}`;

export const API_BASE_URL =
  import.meta.env.DEV
    ? BUILD_TIME_API_BASE
    : typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : BUILD_TIME_API_BASE;
