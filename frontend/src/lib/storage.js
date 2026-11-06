const memory = new Map();

/**
 * localStorage that cannot throw. With site data blocked even reading window.localStorage raises
 * a SecurityError, and a full storage refuses writes. Values then live in memory until a reload.
 */
export const safeStorage = {
  getItem(key) {
    if (memory.has(key)) return memory.get(key);

    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
      memory.delete(key);
    } catch {
      memory.set(key, value);
    }
  },

  removeItem(key) {
    memory.delete(key);

    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing was stored there.
    }
  },
};
