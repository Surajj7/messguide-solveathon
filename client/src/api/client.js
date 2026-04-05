import axios from "axios";

/**
 * Relative `/api` uses the Vite dev proxy. For a full URL, require `…/api` or we append `/api` to origin-only URLs
 * (e.g. `http://localhost:4000` → `http://localhost:4000/api`) so `/auth/login` is not sent to the wrong path.
 */
function resolveApiBase() {
  const raw = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");
  if (!raw) return "/api";
  const originOnly = /^https?:\/\/[^/]+$/i.test(raw);
  if (originOnly) return `${raw}/api`;
  return raw;
}

const api = axios.create({
  baseURL: resolveApiBase(),
});

// Default JSON header breaks FormData: axios would stringify multipart bodies. Let
// transformRequest set JSON only for plain objects; for FormData, omit Content-Type
// so the browser adds multipart boundary.
api.interceptors.request.use((config) => {
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    const h = config.headers;
    if (h && typeof h.delete === "function") {
      h.delete("Content-Type");
    } else if (h) {
      delete h["Content-Type"];
    }
  }
  return config;
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem("token", token);
  } else {
    delete api.defaults.headers.common.Authorization;
    localStorage.removeItem("token");
  }
}

export function loadStoredToken() {
  const t = localStorage.getItem("token");
  if (t) {
    api.defaults.headers.common.Authorization = `Bearer ${t}`;
  }
  return t;
}

export default api;
