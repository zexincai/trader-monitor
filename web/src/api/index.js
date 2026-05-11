import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 15000,
});

export default api;

// GET 封装
export function get(url, params = {}) {
  return api.get(url, { params }).then((r) => r.data);
}

// ── API 方法 ──

export function fetchTraders() {
  return get("/traders");
}

export function fetchTraderDetail(id) {
  return get(`/traders/${id}`);
}

export function fetchLatestSnapshots() {
  return get("/snapshots/latest");
}

export function fetchSnapshots(traderId, days = 30) {
  return get("/snapshots", { traderId, days });
}

export function fetchLatestPositions() {
  return get("/positions/latest");
}

export function fetchPositions(traderId, date) {
  return get("/positions", { traderId, date });
}

export function fetchPreferences(traderId) {
  return get("/positions/preferences", { traderId });
}

// ── 代币监控 ──

export function fetchTokens() {
  return get("/tokens");
}

export function fetchTokensStatus() {
  return get("/tokens/status");
}

export function addToken(instId, label) {
  return api.post("/tokens", { instId, label }).then((r) => r.data);
}

export function deleteToken(instId) {
  return api.delete(`/tokens/${encodeURIComponent(instId)}`).then((r) => r.data);
}
