// Small helpers. The data itself now lives on the server (see api.js).
export const today = () => new Date().toISOString().slice(0, 10);
export const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
