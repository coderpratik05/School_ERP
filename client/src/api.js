// All communication with the Node server.
// In development Vite proxies /api to http://localhost:4000 (see vite.config.js).
// In production set VITE_API_URL, e.g. https://your-api.onrender.com/api
const BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const TOKEN_KEY = "erp_token";

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY));

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function req(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: "Bearer " + getToken() } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach the server. Check your internet connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/auth/login") { onUnauthorized(); throw new Error(data.error || "Please sign in again."); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (role, username, password) => req("POST", "/auth/login", { role, username, password }),
  me: () => req("GET", "/auth/me"),
  changePassword: (current, next) => req("POST", "/auth/change-password", { current, next }),
  loadAll: () => req("GET", "/data"),
  batch: (name, upserts, deletes) => req("POST", `/data/${name}/batch`, { upserts, deletes }),
  users: () => req("GET", "/users"),
  createUser: (u) => req("POST", "/users", u),
  updateUser: (id, u) => req("PUT", `/users/${id}`, u),
  deleteUser: (id) => req("DELETE", `/users/${id}`),
};

// Work out which records changed between two versions of a list
export function diff(before, after) {
  const old = new Map(before.map((r) => [r.id, JSON.stringify(r)]));
  const now = new Set(after.map((r) => r.id));
  return {
    upserts: after.filter((r) => old.get(r.id) !== JSON.stringify(r)),
    deletes: before.filter((r) => !now.has(r.id)).map((r) => r.id),
  };
}

// Changes are sent one after another so the order is always preserved
let chain = Promise.resolve();
export function queueSave(name, before, after, onError) {
  const { upserts, deletes } = diff(before, after);
  if (!upserts.length && !deletes.length) return;
  chain = chain.then(() => api.batch(name, upserts, deletes)).catch(onError);
}
