/**
 * Returns a debounced function that waits `ms` after the last call before invoking `fn`.
 * @template {unknown[]} A
 * @param {(...args: A) => void} fn
 * @param {number} ms
 */
export function debounce(fn, ms) {
  let timeoutId = 0;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      fn(...args);
    }, ms);
  };
}
