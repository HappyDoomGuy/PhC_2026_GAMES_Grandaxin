import { TRACKING_SCRIPT_URL } from './trackingScriptUrl';

export type LeaderboardRow = {
  rank: number;
  uid: string;
  tgName: string;
  value: number;
};

export type LeaderboardMe = {
  rank: number | null;
  uid: string;
  tgName: string;
  value: number;
  inTop10: boolean;
  gapToTenth: number | null;
  gapToNextAbove: number | null;
};

export type LeaderboardCategory = {
  top10: LeaderboardRow[];
  me: LeaderboardMe;
  playersTotal: number;
};

export type LeaderboardPayload = {
  ok: boolean;
  error?: string;
  empty?: boolean;
  playersTotal?: number;
  score: LeaderboardCategory;
  symptoms: LeaderboardCategory;
  tablets: LeaderboardCategory;
  sessions: LeaderboardCategory;
  time: LeaderboardCategory;
};

function scriptExecBase(): string {
  return TRACKING_SCRIPT_URL.replace(/\/$/, '');
}

type StoredNamePayload = { ok: boolean; tgName?: string; error?: string };
type SetNamePayload = { ok: boolean; updated?: number; error?: string };

export async function fetchStoredTgName(uid: string): Promise<string> {
  const url = scriptExecBase();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ cmd: 'stored_tg_name', uid: uid.trim() }),
    mode: 'cors',
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text) as StoredNamePayload;
  } catch {
    throw new Error('Некорректный ответ при запросе имени');
  }
  const payload = data as StoredNamePayload;
  if (!payload.ok) {
    throw new Error(payload.error || 'Ошибка запроса имени');
  }
  return String(payload.tgName ?? '').trim();
}

export async function setDisplayNameAllRows(uid: string, tgName: string): Promise<number> {
  const url = scriptExecBase();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ cmd: 'set_display_name', uid: uid.trim(), tg_name: tgName.trim() }),
    mode: 'cors',
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text) as SetNamePayload;
  } catch {
    throw new Error('Некорректный ответ при сохранении имени');
  }
  const payload = data as SetNamePayload;
  if (!payload.ok) {
    throw new Error(payload.error || 'Не удалось сохранить имя');
  }
  return typeof payload.updated === 'number' ? payload.updated : 0;
}

export async function fetchLeaderboard(uid: string | null): Promise<LeaderboardPayload> {
  const url = scriptExecBase();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ cmd: 'leaderboard', uid: uid ?? '' }),
    mode: 'cors',
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text) as LeaderboardPayload;
  } catch {
    throw new Error('Некорректный ответ сервера рекордов');
  }
  const payload = data as LeaderboardPayload;
  if (!payload.ok) {
    throw new Error(payload.error || 'Ошибка загрузки рекордов');
  }
  return payload;
}
