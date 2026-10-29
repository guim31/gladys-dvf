// -----------------------------------------------------------------------------
// The one HTTP helper of the integration: GET a public document with a timeout
// and an identifying User-Agent. Every source is keyless: no header ever
// carries a secret. Redirects are followed (files.data.gouv.fr answers 302 to
// its object storage).
// -----------------------------------------------------------------------------

export const USER_AGENT =
  'gladys-dvf (Gladys Assistant integration; +https://github.com/guim31/gladys-dvf)';

export class HttpError extends Error {
  /**
   * @param {string} message
   * @param {number|null} status HTTP status, null for a network error or a bad body
   */
  constructor(message, status = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * GET `url` and resolve its body as text, or `null` for a 404 (a commune
 * without any sale in a year has no file).
 * @param {Function} fetchImpl fetch
 * @param {string} url
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 * @param {string} [options.accept]
 * @returns {Promise<string|null>}
 */
export async function getText(fetchImpl, url, { timeoutMs = 60000, accept = '*/*' } = {}) {
  const host = new URL(url).host;
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: accept, 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const reason =
      err?.name === 'TimeoutError' ? `no answer in ${timeoutMs / 1000} s` : err.message;
    throw new HttpError(`${host}: ${reason}`);
  }
  if (response.status === 404) {
    return null;
  }
  if (response.status !== 200) {
    throw new HttpError(`${host}: HTTP ${response.status}`, response.status);
  }
  try {
    return await response.text();
  } catch (err) {
    throw new HttpError(`${host}: ${err.message}`, response.status);
  }
}

/** GET `url` and parse its JSON body (`null` for a 404). */
export async function getJson(fetchImpl, url, options = {}) {
  const body = await getText(fetchImpl, url, {
    timeoutMs: 20000,
    ...options,
    accept: 'application/json',
  });
  if (body === null) {
    return null;
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(`${new URL(url).host}: the answer is not JSON`, 200);
  }
}
