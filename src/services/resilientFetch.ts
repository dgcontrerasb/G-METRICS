/**
 * Resilient Fetch con Timeout Estricto (AbortController)
 * Diseñado para Vercel Serverless Functions ($0 Free Tier / 10s Execution Limit)
 * Corta cualquier llamada upstream a los 4.5s para evitar Timeouts 504.
 */

export interface ResilientFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export async function fetchWithStrictTimeout<T = any>(
  url: string,
  options: ResilientFetchOptions = {}
): Promise<{ ok: boolean; status: number; json: () => Promise<T>; text: () => Promise<string> }> {
  const { timeoutMs = 4500, headers, ...restOptions } = options;
  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        ...(headers || {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutTimer);

    return {
      ok: response.ok,
      status: response.status,
      json: () => response.json() as Promise<T>,
      text: () => response.text(),
    };
  } catch (err: any) {
    clearTimeout(timeoutTimer);
    if (err.name === 'AbortError' || err.code === 20) {
      console.warn(`[Upstream Timeout 4.5s]: Petición a ${url.slice(0, 70)}... abortada para proteger Vercel Lambda.`);
      throw new Error(`UPSTREAM_TIMEOUT: La API externa superó los ${timeoutMs}ms.`);
    }
    throw err;
  }
}
