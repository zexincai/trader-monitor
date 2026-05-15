import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = import.meta.env.VITE_API_TOKEN || localStorage.getItem("apiToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
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

// ── 系统设置 ──

export function fetchSettings() {
  return get("/settings");
}

export function updateSettings(section, data) {
  return api.put("/settings", { section, data }).then((r) => r.data);
}

export function testFeishu() {
  return api.post("/settings/test-feishu").then((r) => r.data);
}

// ── 每日报告 ──

export function fetchDailyReport() {
  return get("/daily-report");
}
