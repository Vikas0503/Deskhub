/** API origin, e.g. `http://localhost:3001`. Override in HTML: `window.DESKHUB_API_BASE = '…'` */
function apiBase() {
  if (typeof globalThis !== 'undefined' && globalThis.DESKHUB_API_BASE) {
    return String(globalThis.DESKHUB_API_BASE).replace(/\/$/, '');
  }
  return 'http://localhost:3001';
}

function joinUrl(path) {
  const base = apiBase().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status: number, body: unknown }} init
   */
  constructor(message, { status, body } = { status: 0, body: null }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * @param {string} method
 * @param {string} path absolute on API host, e.g. `/tickets`
 * @param {{ body?: unknown, headers?: Record<string, string> }} [options]
 */
export async function request(method, path, options = {}) {
  const { body, headers = {} } = options;
  const url = joinUrl(path);

  const init = {
    method,
    headers: { ...headers },
  };

  if (body !== undefined && body !== null) {
    if (typeof body === 'string' || body instanceof FormData || body instanceof Blob) {
      init.body = body;
    } else {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
  }

  const res = await fetch(url, init);

  const text = await res.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const msg =
      typeof parsed === 'object' && parsed !== null && 'message' in parsed
        ? String(/** @type {{ message: unknown }} */ (parsed).message)
        : `${res.status} ${res.statusText}`;
    throw new ApiError(msg || 'Request failed', { status: res.status, body: parsed });
  }

  return parsed;
}

/** @param {string} path @param {{ headers?: Record<string, string> }} [options] */
export function get(path, options = {}) {
  return request('GET', path, options);
}

/**
 * @param {string} path
 * @param {unknown} [body]
 * @param {{ headers?: Record<string, string> }} [options]
 */
export function post(path, body, options = {}) {
  return request('POST', path, { body, headers: options.headers });
}

/**
 * @param {string} path
 * @param {unknown} [body]
 * @param {{ headers?: Record<string, string> }} [options]
 */
export function patch(path, body, options = {}) {
  return request('PATCH', path, { body, headers: options.headers });
}
