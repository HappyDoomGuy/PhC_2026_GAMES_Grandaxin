/**
 * UTM-трекинг в Google Apps Script.
 * URL веб-приложения зашит в TRACKING_SCRIPT_URL; опционально переопределение через аргумент startSessionTracking(url).
 * Активен только если в URL есть utm_medium с числовым id.
 * Первый пинг: в таблицу пишется случайное время 5–23 с; далее каждые 20 с POST с тем же sid —
 * в Google Sheets к длительности прибавляется случайное 20–29 с (см. Code.gs).
 *
 * Игровая сессия = загрузка страницы: новый UUID и время входа при каждом обновлении (без sessionStorage).
 * Один объект сессии на загрузку модуля — иначе React StrictMode дважды монтирует эффект и менялся бы sid между пингами.
 *
 * В таблице: entry_datetime (A) — время первого захода; session_duration_sec (D) — обновляется скриптом.
 */

/** Развёрнутое веб-приложение Google Apps Script (POST JSON). */
const TRACKING_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzKN_fQP9hDXU4jWRegTrYGRSu4-kao04qtNaDhjKiEDdCA5t5wHNWP2SXAlsqL8AVH4w/exec';

let gameSessionMeta: { sessionId: string; entryIso: string } | null = null;

function ensureGameSessionMeta(): { sessionId: string; entryIso: string } {
  if (!gameSessionMeta) {
    gameSessionMeta = {
      sessionId: crypto.randomUUID(),
      entryIso: new Date().toISOString(),
    };
  }
  return gameSessionMeta;
}

function parseUtmMediumUserId(): string | null {
  const raw = new URLSearchParams(window.location.search).get('utm_medium');
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return trimmed;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Тело как в рабочих GAS-проектах: JSON в postData.contents */
function buildTrackingPayload(
  entryIso: string,
  sessionId: string,
  userId: string,
  durationSeconds: number
): string {
  return JSON.stringify({
    entry: entryIso,
    sid: sessionId,
    uid: userId,
    sec: durationSeconds,
  });
}

export type SessionTrackingOptions = {
  onDebug?: (line: string) => void;
};

/**
 * @returns cleanup для useEffect или undefined, если трекинг не запущен
 */
export function startSessionTracking(
  scriptUrl?: string,
  options?: SessionTrackingOptions
): (() => void) | undefined {
  const dbg = options?.onDebug;
  const log = (line: string) => {
    dbg?.(line);
  };

  const trimmed = (scriptUrl?.trim() || TRACKING_SCRIPT_URL).replace(/\/$/, '');

  const userId = parseUtmMediumUserId();
  if (!userId) {
    const raw = new URLSearchParams(window.location.search).get('utm_medium');
    log(
      `[track] нужен числовой utm_medium; сейчас: ${raw === null ? '(нет параметра)' : JSON.stringify(raw)}`
    );
    return undefined;
  }

  const { sessionId, entryIso } = ensureGameSessionMeta();
  /** Только первый пинг передаёт начальные секунды; дальше скрипт сам прибавляет 20–29 к строке с sid */
  const initialSec = randomInt(5, 23);
  let pingIndex = 0;

  log(
    `[track] активен | uid=${userId} | sid=${sessionId.slice(0, 8)}… | entry=${entryIso} | url=${trimmed.slice(0, 56)}…`
  );

  const send = (isFirst: boolean) => {
    pingIndex += 1;
    const sec = isFirst ? initialSec : 0;
    const body = buildTrackingPayload(entryIso, sessionId, userId, sec);
    log(
      `[track] ping #${pingIndex} ${new Date().toLocaleTimeString()} | initialSec=${isFirst ? initialSec : '—'} | POST JSON`
    );
    void fetch(trimmed, {
      method: 'POST',
      mode: 'no-cors',
      body,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      cache: 'no-store',
      keepalive: true,
    }).catch(() => {});
  };

  send(true);

  const intervalId = window.setInterval(() => {
    send(false);
  }, 20_000);

  return () => clearInterval(intervalId);
}
