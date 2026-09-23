import { IntegrationError } from "@/lib/integrations/types";

type AvitoFetchOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
  form?: Record<string, string>;
  retry401?: () => Promise<string | null>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const AVITO_API_HOST = "api.avito.ru";

/** Resolve Avito API URL. Absolute URLs must be https://api.avito.ru only (SSRF guard). */
export function resolveAvitoApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    let url: URL;
    try {
      url = new URL(path);
    } catch {
      throw new IntegrationError("Некорректный URL Авито.", "VALIDATION", 400);
    }
    if (url.protocol !== "https:" || url.hostname !== AVITO_API_HOST) {
      throw new IntegrationError("Разрешены только запросы к api.avito.ru.", "VALIDATION", 400);
    }
    return url.toString();
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `https://${AVITO_API_HOST}${normalized}`;
}

export async function avitoRequest<T>(path: string, options: AvitoFetchOptions = {}): Promise<T> {
  const url = resolveAvitoApiUrl(path);
  let token = options.token ?? null;
  let retriedAuth = false;
  let wait = 1000;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const headers: Record<string, string> = {};

    if (options.form) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    } else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.form
        ? new URLSearchParams(options.form).toString()
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
    });

    if (response.status === 401 && options.retry401 && !retriedAuth) {
      retriedAuth = true;
      token = await options.retry401();
      continue;
    }

    if (response.status === 429) {
      if (attempt >= 2) {
        throw new IntegrationError(publicError(429), "RATE_LIMIT", 429);
      }

      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : wait);
      wait *= 2;
      continue;
    }

    if (response.status >= 500 && attempt < 2) {
      await sleep(wait);
      wait *= 2;
      continue;
    }

    if (!response.ok) {
      throw new IntegrationError(publicError(response.status), codeFromStatus(response.status), response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  throw new IntegrationError("Авито временно недоступен. Попробуйте позже.", "UPSTREAM", 503);
}

function codeFromStatus(status: number): IntegrationError["code"] {
  if (status === 401 || status === 403) {
    return "AUTH";
  }

  if (status === 429) {
    return "RATE_LIMIT";
  }

  if (status === 409) {
    return "CONFLICT";
  }

  if (status === 400 || status === 422) {
    return "VALIDATION";
  }

  return "UPSTREAM";
}

function publicError(status: number) {
  if (status === 401) {
    return "Сессия Авито истекла. Подключите канал снова.";
  }

  if (status === 403) {
    return "Недостаточно прав для Авито.";
  }

  if (status === 404) {
    return "Объект Авито не найден.";
  }

  if (status === 409) {
    return "Конфликт дат с оплаченной бронью Авито.";
  }

  if (status === 429) {
    return "Слишком много запросов к Авито. Подождите и повторите.";
  }

  return "Не удалось выполнить запрос к Авито.";
}
