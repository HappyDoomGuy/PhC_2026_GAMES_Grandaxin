/**
 * Данные пользователя из Telegram Web Apps (initDataUnsafe).
 * Доступны, если игра открыта как Web App у бота; у обычной «серой» url-кнопки в чате
 * часто открывается браузер без WebApp — тогда смотрите utm_medium / tg_name в ссылке.
 *
 * @see https://core.telegram.org/bots/webapps
 */

export type TelegramWebAppUserLite = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

function getTelegramWebAppUser(): TelegramWebAppUserLite | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    Telegram?: { WebApp?: { initDataUnsafe?: { user?: TelegramWebAppUserLite } } };
  };
  const u = w.Telegram?.WebApp?.initDataUnsafe?.user;
  if (u == null || typeof u.id !== 'number' || !Number.isFinite(u.id)) return null;
  return u;
}

function parseUtmMediumFromUrl(): string | null {
  const raw = new URLSearchParams(window.location.search).get('utm_medium');
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return trimmed;
}

function parseTgNameFromUrlOnly(): string {
  const raw = new URLSearchParams(window.location.search).get('tg_name');
  if (raw == null) return '';
  const s = raw.trim();
  if (!s) return '';
  return s.length > 500 ? s.slice(0, 500) : s;
}

function buildTelegramDisplayName(user: TelegramWebAppUserLite): string {
  const parts = [user.first_name, user.last_name].filter(Boolean) as string[];
  const full = parts.join(' ').trim();
  if (full) return full.length > 500 ? full.slice(0, 500) : full;
  const un = user.username?.trim();
  if (un) return un.length > 500 ? un.slice(0, 500) : un;
  return '';
}

/** Вызвать после загрузки telegram-web-app.js (например из index.tsx). */
export function initTelegramWebAppIfPresent(): void {
  try {
    const w = window as Window & { Telegram?: { WebApp?: { ready: () => void } } };
    w.Telegram?.WebApp?.ready();
  } catch {
    /* empty */
  }
}

/**
 * user_id для трекинга (колонка C): сначала Telegram user.id из WebApp, иначе числовой utm_medium из URL.
 */
export function getResolvedTrackingUserId(): string | null {
  if (typeof window === 'undefined') return null;
  const tg = getTelegramWebAppUser();
  if (tg) return String(Math.trunc(tg.id));
  return parseUtmMediumFromUrl();
}

/**
 * tg_name (колонка K): сначала имя из WebApp (first + last или username), иначе параметр tg_name в ссылке.
 */
export function getResolvedTgName(): string {
  if (typeof window === 'undefined') return '';
  const tg = getTelegramWebAppUser();
  if (tg) {
    const fromTg = buildTelegramDisplayName(tg);
    if (fromTg) return fromTg;
  }
  return parseTgNameFromUrlOnly();
}

/** true, если в контексте есть пользователь Telegram WebApp */
export function isTelegramWebAppUser(): boolean {
  return getTelegramWebAppUser() != null;
}
