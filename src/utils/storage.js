const PREFIX = 'deskhub:';

function namespaced(key) {
  return `${PREFIX}${key}`;
}

/** @param {string} key without prefix */
export function get(key) {
  return localStorage.getItem(namespaced(key));
}

/** @param {string} key without prefix */
export function set(key, value) {
  localStorage.setItem(namespaced(key), String(value));
}

/** @param {string} key without prefix */
export function remove(key) {
  localStorage.removeItem(namespaced(key));
}

/** Remove every key stored under the `deskhub:` prefix. */
export function clear() {
  const keys = Object.keys(localStorage);
  for (const k of keys) {
    if (k.startsWith(PREFIX)) {
      localStorage.removeItem(k);
    }
  }
}
