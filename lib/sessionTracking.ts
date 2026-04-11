/**
 * UTM-трекинг в Google Apps Script.
 * URL: `lib/trackingScriptUrl.ts` (TRACKING_SCRIPT_URL); опционально переопределение через аргумент startSessionTracking(url).
 * Активен при числовом utm_medium в ссылке или при открытии как Telegram Web App (user.id).
 * Первый пинг: в таблицу пишется случайное время 5–23 с; далее каждые 20 с POST с тем же sid —
 * в Google Sheets к длительности прибавляется случайное 20–29 с (см. Code.gs).
 *
 * Новый UUID и время входа: при первом startSessionTracking и при каждом restartTrackingSessionAfterResetGame (кнопка «Начать сначала»).
 *
 * В таблице: entry_datetime (A) — время первого захода; session_duration_sec (D) — обновляется скриптом; имя — лист «Профили» в GAS, не колонка K.
 * tg_name: если в таблице уже есть имя для этого uid — оно (и с сервера подтягивается при старте); иначе Telegram WebApp или tg_name в URL.
 */

import { fetchStoredTgName } from './recordsApi';
import { TRACKING_SCRIPT_URL } from './trackingScriptUrl';
import {
  getResolvedTgName,
  getResolvedTrackingUserId,
  isTelegramWebAppUser,
} from './telegramWebApp';

export { TRACKING_SCRIPT_URL } from './trackingScriptUrl';

let gameSessionMeta: { sessionId: string; entryIso: string } | null = null;
let trackingIntervalId: ReturnType<typeof window.setInterval> | null = null;

/** После успешного `stored_tg_name` / смены имени в рекордах: непустое — брать вместо URL/Telegram. */
let displayNameHydratedUid: string | null = null;
/** '' = в таблице имени ещё нет; непустая строка = сохранённое имя. */
let displayNameFromServer: string | undefined = undefined;

/**
 * Подтянуть имя из таблицы по uid. Если для id уже есть tg_name в любой строке — дальше оно же уходит в пинги.
 */
export async function hydrateStoredDisplayNameFromServer(): Promise<void> {
  const uid = getResolvedTrackingUserId();
  if (!uid) {
    displayNameHydratedUid = null;
    displayNameFromServer = undefined;
    return;
  }
  try {
    const s = await fetchStoredTgName(uid);
    displayNameHydratedUid = uid;
    displayNameFromServer = s;
  } catch {
    displayNameHydratedUid = uid;
    displayNameFromServer = '';
  }
}

/** После сохранения имени в рекордах — сразу обновить локальный кэш для пингов и game_results. */
export function setCachedDisplayNameFromUser(name: string): void {
  const uid = getResolvedTrackingUserId();
  if (!uid) return;
  const t = name.trim();
  if (!t) return;
  displayNameHydratedUid = uid;
  displayNameFromServer = t.length > 500 ? t.slice(0, 500) : t;
}

function getTgNameForTracking(): string {
  const uid = getResolvedTrackingUserId();
  if (!uid) return '';
  if (
    displayNameHydratedUid === uid &&
    displayNameFromServer != null &&
    displayNameFromServer !== ''
  ) {
    return displayNameFromServer;
  }
  return getResolvedTgName();
}

function clearTrackingPingLoop(): void {
  if (trackingIntervalId !== null) {
    window.clearInterval(trackingIntervalId);
    trackingIntervalId = null;
  }
}

function startTrackingPingLoop(
  sessionId: string,
  entryIso: string,
  trimmed: string,
  log: (line: string) => void
): void {
  clearTrackingPingLoop();
  const initialSec = randomInt(5, 23);
  let pingIndex = 0;
  const debugPing = isTrackingDebug();

  const send = (isFirst: boolean) => {
    const userId = getResolvedTrackingUserId();
    if (!userId) return;
    const tgName = getTgNameForTracking();
    pingIndex += 1;
    const sec = isFirst ? initialSec : 0;
    const body = buildTrackingPayload(entryIso, sessionId, userId, sec, tgName);
    log(
      `[track] ping #${pingIndex} ${new Date().toLocaleTimeString()} | initialSec=${isFirst ? initialSec : '—'} | POST JSON`
    );
    void fetch(trimmed, {
      method: 'POST',
      mode: 'cors',
      body,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      cache: 'no-store',
      keepalive: true,
    })
      .then(async (res) => {
        if (!debugPing) return;
        const t = await res.text();
        emitTrackDebug(`ping #${pingIndex} ← ${res.status} ${t.slice(0, 120)}`);
      })
      .catch((e: unknown) => {
        if (debugPing) emitTrackDebug(`ping #${pingIndex} error: ${e instanceof Error ? e.message : String(e)}`);
      });
  };

  send(true);
  trackingIntervalId = window.setInterval(() => {
    send(false);
  }, 20_000);
}

function ensureGameSessionMeta(): { sessionId: string; entryIso: string } {
  if (!gameSessionMeta) {
    gameSessionMeta = {
      sessionId: crypto.randomUUID(),
      entryIso: new Date().toISOString(),
    };
  }
  return gameSessionMeta;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Тело как в рабочих GAS-проектах: JSON в postData.contents */
function buildTrackingPayload(
  entryIso: string,
  sessionId: string,
  userId: string,
  durationSeconds: number,
  tgName: string
): string {
  return JSON.stringify({
    entry: entryIso,
    sid: sessionId,
    uid: userId,
    sec: durationSeconds,
    tg_name: tgName,
  });
}

export type SessionTrackingOptions = {
  onDebug?: (line: string) => void;
};

/** Включить подробные логи: добавьте в URL `&track_debug=1` (вместе с числовым utm_medium). */
export function isTrackingDebug(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('track_debug') === '1';
}

function emitTrackDebug(line: string): void {
  if (!isTrackingDebug()) return;
  const stamp = new Date().toISOString().slice(11, 23);
  const full = `[${stamp}] ${line}`;
  console.warn('[track-debug]', full);
  const w = window as Window & {
    __TRACK_DEBUG_LOG__?: Array<{ ts: number; line: string }>;
  };
  w.__TRACK_DEBUG_LOG__ = w.__TRACK_DEBUG_LOG__ ?? [];
  w.__TRACK_DEBUG_LOG__.push({ ts: Date.now(), line: full });
  if (w.__TRACK_DEBUG_LOG__.length > 100) {
    w.__TRACK_DEBUG_LOG__.splice(0, w.__TRACK_DEBUG_LOG__.length - 100);
  }
  window.dispatchEvent(new CustomEvent('track-debug', { detail: full }));
}

export type GameResultPayload = {
  score: number;
  tablets: number;
  trevoga: number;
  nervoznost: number;
  stress: number;
  vsego: number;
};

/** Есть отслеживаемая сессия (utm или Telegram WebApp и уже создан sid). */
export function getTrackingSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  if (!getResolvedTrackingUserId()) return null;
  return gameSessionMeta?.sessionId ?? null;
}

/** Запись итогов игры в строку с этим session_id (колонки E–J). Без utm / sid — no-op. */
export function submitGameResults(stats: GameResultPayload, scriptUrl?: string): void {
  if (typeof window === 'undefined') return;
  const userId = getResolvedTrackingUserId();
  const sid = gameSessionMeta?.sessionId;
  if (!userId || !sid) {
    if (isTrackingDebug()) {
      emitTrackDebug(
        `game_results пропуск: userId=${userId ?? '(нет)'} sid=${sid ? sid.slice(0, 8) + '…' : '(нет)'}`
      );
    }
    return;
  }

  const entry = gameSessionMeta?.entryIso ?? new Date().toISOString();
  const trimmed = (scriptUrl?.trim() || TRACKING_SCRIPT_URL).replace(/\/$/, '');
  const debugFlag = isTrackingDebug();
  const tgName = getTgNameForTracking();
  const body = JSON.stringify({
    cmd: 'game_results',
    sid,
    uid: userId,
    entry,
    tg_name: tgName,
    track_debug: debugFlag,
    score: stats.score,
    tablets: stats.tablets,
    trevoga: stats.trevoga,
    nervoznost: stats.nervoznost,
    stress: stats.stress,
    vsego: stats.vsego,
  });

  console.info('[game_results] отправка', {
    sid: `${sid.slice(0, 8)}…`,
    score: stats.score,
    tablets: stats.tablets,
    trevoga: stats.trevoga,
    nervoznost: stats.nervoznost,
    stress: stats.stress,
    vsego: stats.vsego,
  });
  emitTrackDebug(
    `game_results → POST score=${stats.score} tablets=${stats.tablets} sid=${sid.slice(0, 8)}…`
  );

  const opts: RequestInit = {
    method: 'POST',
    mode: 'cors',
    body,
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    cache: 'no-store',
    keepalive: true,
  };

  void fetch(trimmed, opts)
    .then(async (res) => {
      const text = await res.text();
      let parsed: { ok?: boolean; mode?: string; error?: string; row?: number; _trace?: string } = {};
      try {
        parsed = JSON.parse(text) as typeof parsed;
      } catch {
        /* empty */
      }
      const hint =
        parsed.mode && !String(parsed.mode).includes('game_results')
          ? ' Похоже, в Apps Script не задеплоена ветка cmd=game_results (ответ без mode game_results*).'
          : '';
      console.info(
        '[game_results] HTTP',
        res.status,
        '|',
        text.slice(0, 280),
        hint || ''
      );
      emitTrackDebug(`game_results ← HTTP ${res.status} body=${text.slice(0, 200)}${hint}`);
      if (!res.ok) {
        void fetch(trimmed, { ...opts, mode: 'no-cors' }).catch(() => {
          emitTrackDebug('game_results fallback no-cors тоже завершился (ответ недоступен)');
        });
      }
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.info('[game_results] fetch error (cors):', msg, '— пробуем no-cors');
      emitTrackDebug(`game_results fetch error: ${msg} → retry no-cors`);
      void fetch(trimmed, { ...opts, mode: 'no-cors' }).catch(() => {
        emitTrackDebug('game_results no-cors retry failed');
      });
    });
}

/**
 * После «Начать сначала»: новый session id и entry, новая строка в таблице (первый пинг), новый интервал пингов.
 * Без числового utm_medium — no-op.
 */
export function restartTrackingSessionAfterResetGame(
  scriptUrl?: string,
  options?: SessionTrackingOptions
): void {
  if (typeof window === 'undefined') return;

  const dbg = options?.onDebug;
  const log = (line: string) => {
    dbg?.(line);
    if (isTrackingDebug()) emitTrackDebug(line);
  };

  const trimmed = (scriptUrl?.trim() || TRACKING_SCRIPT_URL).replace(/\/$/, '');
  const userId = getResolvedTrackingUserId();
  if (!userId) return;

  gameSessionMeta = {
    sessionId: crypto.randomUUID(),
    entryIso: new Date().toISOString(),
  };
  const { sessionId, entryIso } = gameSessionMeta;

  log(
    `[track] новая сессия (reset) | uid=${userId} | sid=${sessionId.slice(0, 8)}… | entry=${entryIso}`
  );

  startTrackingPingLoop(sessionId, entryIso, trimmed, log);
}

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
    if (isTrackingDebug()) emitTrackDebug(line);
  };

  const trimmed = (scriptUrl?.trim() || TRACKING_SCRIPT_URL).replace(/\/$/, '');

  const userId = getResolvedTrackingUserId();
  if (!userId) {
    const raw = new URLSearchParams(window.location.search).get('utm_medium');
    log(
      `[track] нет user id: ни Telegram WebApp user, ни числовой utm_medium; utm_medium=${raw === null ? '(нет)' : JSON.stringify(raw)}`
    );
    return undefined;
  }

  const { sessionId, entryIso } = ensureGameSessionMeta();

  log(
    `[track] активен | uid=${userId} | src=${isTelegramWebAppUser() ? 'Telegram' : 'utm_medium'} | sid=${sessionId.slice(0, 8)}… | entry=${entryIso} | url=${trimmed.slice(0, 56)}…`
  );

  let cancelled = false;
  const start = () => {
    if (!cancelled) {
      startTrackingPingLoop(sessionId, entryIso, trimmed, log);
    }
  };
  void hydrateStoredDisplayNameFromServer().then(start).catch(start);

  return () => {
    cancelled = true;
    clearTrackingPingLoop();
  };
}
