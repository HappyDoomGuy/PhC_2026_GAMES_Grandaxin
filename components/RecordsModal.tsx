import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchLeaderboard,
  setDisplayNameAllRows,
  type LeaderboardCategory,
  type LeaderboardPayload,
} from '../lib/recordsApi';
import { isForbiddenDisplayName } from '../lib/forbiddenDisplayNames';
import {
  hydrateStoredDisplayNameFromServer,
  setCachedDisplayNameFromUser,
} from '../lib/sessionTracking';

type TabId = 'score' | 'symptoms' | 'tablets' | 'sessions' | 'time';

type TabDef = {
  id: TabId;
  label: string;
  title: string;
  description: string;
};

const TABS: TabDef[] = [
  {
    id: 'score',
    label: 'Очки',
    title: 'Очки',
    description:
      'Сумма набранных очков за все завершённые игровые сессии (после экрана со счётом). Чем выше сумма, тем выше место в рейтинге.',
  },
  {
    id: 'symptoms',
    label: 'Симптомы',
    title: 'Побеждённые симптомы',
    description:
      'Суммарное количество побеждённых симптомов по показателю «всего» из итога каждой завершённой игры. Учитываются только завершённые сессии.',
  },
  {
    id: 'tablets',
    label: 'Таблетки',
    title: 'Использованные таблетки',
    description:
      'Суммарное количество использованных таблеток по всем завершённым сессиям. Накопительный показатель за всё время.',
  },
  {
    id: 'sessions',
    label: 'Сессии',
    title: 'Игровые сессии',
    description:
      'Число всех заходов в игру по строкам учёта: и завершённых, и незавершённых (каждая строка с вашим id и номером сессии считается отдельно).',
  },
  {
    id: 'time',
    label: 'Время',
    title: 'Время в игре',
    description:
      'Суммарная длительность по колонке «длительность сессии» для всех ваших строк учёта — и завершённых, и незавершённых. Показано в удобном виде.',
  },
];

function tabMeta(id: TabId): TabDef {
  const found = TABS.find((t) => t.id === id);
  return found ?? TABS[0];
}

function formatDurationSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}\u00a0ч ${m}\u00a0мин`;
  if (m > 0) return `${m}\u00a0мин ${r}\u00a0с`;
  return `${r}\u00a0с`;
}

function formatValue(tab: TabId, v: number): string {
  if (tab === 'time') return formatDurationSec(v);
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 100) / 100);
}

function categoryForTab(data: LeaderboardPayload, tab: TabId): LeaderboardCategory {
  switch (tab) {
    case 'score':
      return data.score;
    case 'symptoms':
      return data.symptoms;
    case 'tablets':
      return data.tablets;
    case 'sessions':
      return data.sessions;
    default:
      return data.time;
  }
}

function gapFootnote(tab: TabId, cat: LeaderboardCategory, localDisplayName: string): string | null {
  const me = cat.me;
  if (!me) return null;
  const unit =
    tab === 'time'
      ? 'секунд'
      : tab === 'score'
        ? 'очков'
        : tab === 'symptoms'
          ? 'единиц «всего»'
          : tab === 'tablets'
            ? 'таблеток'
            : 'сессий';

  if (cat.playersTotal < 10) {
    return `В рейтинге по этому показателю пока меньше 10 участников (${cat.playersTotal}).`;
  }

  if (me.rank === null) {
    if (me.gapToTenth != null) {
      const noDataHint =
        tab === 'sessions' || tab === 'time'
          ? 'в таблице нет ни одной строки сессии с вашим id'
          : 'нет завершённых сессий с записью итога игры';
      return `Чтобы попасть в топ‑10 по этому показателю, наберите ещё не меньше ${me.gapToTenth} ${unit} (${noDataHint}).`;
    }
    return null;
  }

  if (!me.inTop10 && me.gapToTenth != null) {
    return `До 10‑го места по этому показателю не хватает не меньше ${me.gapToTenth} ${unit}.`;
  }

  if (me.inTop10 && me.rank != null && me.rank > 1 && me.gapToNextAbove != null) {
    return `До следующего места в топ‑10 не хватает не меньше ${me.gapToNextAbove} ${unit}.`;
  }

  if (me.inTop10 && me.rank === 1) {
    return `${localDisplayName || 'Вы'} на 1‑м месте по этому накопительному показателю.`;
  }

  return null;
}

type Props = {
  open: boolean;
  onClose: () => void;
  uid: string | null;
  localDisplayName: string;
};

const RecordsModal: React.FC<Props> = ({ open, onClose, uid, localDisplayName }) => {
  const [tab, setTab] = useState<TabId>('score');
  const [data, setData] = useState<LeaderboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameFeedback, setNameFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const payload = await fetchLeaderboard(uid);
      setData(payload);
    } catch (e) {
      setData(null);
      setErr(e instanceof Error ? e.message : 'Не удалось загрузить рекорды');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (!open) return;
    setTab('score');
    setNameFeedback(null);
    setData(null);
    void hydrateStoredDisplayNameFromServer();
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!data || !open) return;
    const fromTable = (data.score.me?.tgName || '').trim();
    setNameDraft(fromTable || localDisplayName.trim());
  }, [data, open, localDisplayName]);

  if (!open) return null;

  const saveDisplayName = async () => {
    if (!uid) return;
    const t = nameDraft.trim();
    if (!t) {
      setNameFeedback('Введите имя');
      return;
    }
    if (t.length < 4) {
      setNameFeedback('Имя не короче 4 символов');
      return;
    }
    if (t.length > 500) {
      setNameFeedback('Не более 500 символов');
      return;
    }
    if (isForbiddenDisplayName(t)) {
      setNameFeedback('Имя содержит недопустимые или оскорбительные выражения');
      return;
    }
    setNameSaving(true);
    setNameFeedback(null);
    try {
      await setDisplayNameAllRows(uid, t);
      setCachedDisplayNameFromUser(t);
      await hydrateStoredDisplayNameFromServer();
      await load();
      setNameFeedback('Сохранено: обновлён лист «Профили».');
    } catch (e) {
      setNameFeedback(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setNameSaving(false);
    }
  };

  const activeTab = tabMeta(tab);
  const cat = data ? categoryForTab(data, tab) : null;
  const me = cat?.me;
  const meLabel =
    me && (me.tgName?.trim() || localDisplayName?.trim() || (uid ? `id ${uid}` : 'Гость'));

  return (
    <div
      className="absolute inset-0 z-[60] flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #75C4E6 100%)' }}
      role="dialog"
      aria-modal
      aria-labelledby="records-title"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2 flex-shrink-0">
        <h2 id="records-title" className="text-lg font-black text-slate-800 uppercase tracking-tight">
          Рекорды
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-xl text-sm font-bold text-slate-700 bg-white/90 border border-slate-200 shadow-sm active:scale-95"
        >
          Закрыть
        </button>
      </div>

      <div className="px-3 pb-2 flex gap-1 overflow-x-auto flex-shrink-0 scrollbar-thin">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              tab === t.id
                ? 'bg-[#0083C1] text-white border-[#0083C1]'
                : 'bg-white/80 text-slate-700 border-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 relative min-h-[120px]">
        {loading && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(117,196,230,0.55) 100%)',
            }}
            aria-busy
            aria-live="polite"
          >
            <div className="relative h-14 w-14">
              <div
                className="absolute inset-0 rounded-full opacity-30"
                style={{ border: '4px solid #0083C1' }}
              />
              <div
                className="absolute inset-0 rounded-full animate-spin"
                style={{
                  border: '4px solid transparent',
                  borderTopColor: '#0083C1',
                  borderRightColor: '#0083C1',
                }}
              />
            </div>
            <p className="mt-5 text-sm font-bold text-slate-700 tracking-tight">Загрузка рекордов…</p>
            <p className="mt-1 text-xs text-slate-500">Подождите несколько секунд</p>
          </div>
        )}

        <div className="absolute inset-0 overflow-y-auto px-4 pb-4">
          <div className="mb-3 rounded-2xl bg-white/85 border border-slate-200/80 shadow-sm px-3 py-3">
            <h3 className="text-base font-black text-slate-800 leading-tight">{activeTab.title}</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{activeTab.description}</p>
          </div>

          {!uid && (
            <p className="text-sm text-slate-700 mb-3 rounded-xl bg-amber-50 border border-amber-200/80 px-3 py-2">
              Чтобы увидеть своё место в рейтинге, откройте игру из Telegram или по ссылке с параметром{' '}
              <span className="font-mono text-xs">utm_medium</span> (числовой id).
            </p>
          )}

          {uid && data && !loading && (
            <div className="mb-3 rounded-2xl bg-white/90 border border-slate-200/80 shadow-md px-3 py-3 space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Имя в рейтинге</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Имя в <span className="font-semibold text-slate-800">«Профили»</span> (одна запись на id): при первом
                пинге оно берётся из Telegram или ссылки <span className="font-semibold text-slate-800">как есть</span>.
                Смена здесь: не короче <span className="font-semibold text-slate-800">4 символов</span> и без мата и
                грубых оскорблений по словарю.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  maxLength={500}
                  placeholder={localDisplayName.trim() || 'Ваше имя'}
                  className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-inner focus:border-[#0083C1] focus:outline-none focus:ring-1 focus:ring-[#0083C1]"
                  disabled={nameSaving}
                  autoComplete="nickname"
                />
                <button
                  type="button"
                  onClick={() => void saveDisplayName()}
                  disabled={nameSaving}
                  className="flex-shrink-0 rounded-xl bg-[#0083C1] px-4 py-2 text-sm font-black text-white shadow-md transition active:scale-[0.98] disabled:opacity-50"
                  style={{ fontFamily: "'Comic CAT', sans-serif" }}
                >
                  {nameSaving ? '…' : 'Сохранить'}
                </button>
              </div>
              {nameFeedback && (
                <p
                  className={`text-xs ${nameFeedback.startsWith('Сохранено') ? 'text-emerald-700' : 'text-red-600'}`}
                >
                  {nameFeedback}
                </p>
              )}
            </div>
          )}

          {err && (
            <p className="text-red-700 text-sm rounded-xl bg-red-50 border border-red-200 px-3 py-2 mb-2">{err}</p>
          )}

          {data && cat && (
            <>
            <div className="rounded-2xl bg-white/90 border border-slate-200/80 shadow-md overflow-hidden mb-3">
              <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100">
                Топ‑10
              </div>
              {cat.top10.length === 0 ? (
                <p className="px-3 py-4 text-sm text-slate-600">Пока нет данных для этого рейтинга.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {cat.top10.map((row) => (
                    <li key={`${tab}-${row.rank}-${row.uid}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="w-7 font-black text-[#0083C1] tabular-nums">{row.rank}.</span>
                      <span className="flex-1 min-w-0 truncate text-slate-800 font-semibold">{row.tgName}</span>
                      <span className="font-mono text-slate-700 tabular-nums">{formatValue(tab, row.value)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl bg-white/90 border border-slate-200/80 shadow-md overflow-hidden mb-3">
              <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100">
                Вы
              </div>
              <div className="px-3 py-3 text-sm space-y-1">
                {!uid && <p className="text-slate-600">Идентификатор не задан — место не вычисляется.</p>}
                {uid && me && (
                  <>
                    <p className="text-slate-800">
                      <span className="font-semibold">{meLabel}</span>
                      {me.rank != null ? (
                        <>
                          {' '}
                          — место <span className="font-black text-[#0083C1]">{me.rank}</span> из{' '}
                          {cat.playersTotal}
                        </>
                      ) : (
                        <>
                          {' '}
                          — в таблице нет строк сессии с вашим id
                        </>
                      )}
                    </p>
                    <p className="font-mono text-slate-700">
                      Значение: {formatValue(tab, me.value)}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <p>
                * <span className="font-semibold text-slate-800">Очки, симптомы и таблетки</span> — только по{' '}
                <span className="font-semibold text-slate-800">завершённым</span> сессиям (после экрана со счётом), сумма
                за всё время. <span className="font-semibold text-slate-800">Сессии и время</span> — по всем строкам учёта
                с вашим id (включая незавершённые игры), накопительно.
              </p>
              {uid && me && <p>* {gapFootnote(tab, cat, localDisplayName)}</p>}
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordsModal;
