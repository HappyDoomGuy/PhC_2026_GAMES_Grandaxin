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
    description: 'Сумма очков за все завершённые игровые сессии.',
  },
  {
    id: 'symptoms',
    label: 'Симптомы',
    title: 'Побеждённые симптомы',
    description: 'Количество побеждённых симптомов за все завершённые игровые сессии.',
  },
  {
    id: 'tablets',
    label: 'Таблетки',
    title: 'Таблетки',
    description: 'Количество использованных таблеток за все завершённые игровые сессии.',
  },
  {
    id: 'sessions',
    label: 'Сессии',
    title: 'Сессии',
    description: 'Общее количество игровых сессий.',
  },
  {
    id: 'time',
    label: 'Время',
    title: 'Время',
    description: 'Общая продолжительность всех игровых сессий.',
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
  const [nameEditOpen, setNameEditOpen] = useState(false);

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
    setNameEditOpen(false);
    setData(null);
    void hydrateStoredDisplayNameFromServer();
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!data || !open || nameEditOpen) return;
    const fromTable = (data.score.me?.tgName || '').trim();
    setNameDraft(fromTable || localDisplayName.trim());
  }, [data, open, localDisplayName, nameEditOpen]);

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
      setNameEditOpen(false);
      setNameFeedback('Сохранено.');
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

  const resolvedDisplayName = uid
    ? loading && !data
      ? localDisplayName.trim() || '…'
      : (data?.score.me?.tgName || '').trim() || localDisplayName.trim() || `id ${uid}`
    : '';

  const openNameEditor = () => {
    const fromTable = (data?.score.me?.tgName || '').trim();
    setNameDraft(fromTable || localDisplayName.trim() || '');
    setNameFeedback(null);
    setNameEditOpen(true);
  };

  const cancelNameEdit = () => {
    const fromTable = (data?.score.me?.tgName || '').trim();
    setNameDraft(fromTable || localDisplayName.trim());
    setNameFeedback(null);
    setNameEditOpen(false);
  };

  const gapLine = data && cat && uid && me ? gapFootnote(tab, cat, localDisplayName) : null;

  return (
    <div
      className="absolute inset-0 z-[60] flex flex-col overflow-hidden text-slate-800"
      style={{
        background: 'linear-gradient(168deg, #f8fafc 0%, #e8f4fc 38%, #b8dff0 72%, #89c9e8 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)',
      }}
      role="dialog"
      aria-modal
      aria-labelledby="records-title"
    >
      <header className="flex-shrink-0 px-4 pt-3 pb-3 border-b border-slate-200/60 bg-white/70 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <h2
            id="records-title"
            className="text-xl font-black tracking-tight text-slate-900"
            style={{ fontFamily: "'Comic CAT', sans-serif" }}
          >
            Рекорды
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200/90 shadow-sm hover:bg-slate-50 active:scale-[0.98] transition"
          >
            Назад
          </button>
        </div>

        {uid && (
          <div className="mt-3 rounded-xl bg-slate-50/90 border border-slate-200/80 px-3 py-2.5">
            {!nameEditOpen ? (
              <div className="flex items-center justify-between gap-3 min-w-0">
                <p className="text-[15px] font-semibold text-slate-900 truncate min-w-0">{resolvedDisplayName}</p>
                <button
                  type="button"
                  onClick={openNameEditor}
                  disabled={loading || !data}
                  className="shrink-0 text-sm font-bold text-[#0083C1] hover:text-[#006fa3] disabled:opacity-40 disabled:pointer-events-none underline-offset-2 hover:underline"
                >
                  Сменить имя
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  maxLength={500}
                  placeholder="Имя"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-[#0083C1] focus:outline-none focus:ring-2 focus:ring-[#0083C1]/25"
                  style={{ caretColor: '#0083C1' }}
                  disabled={nameSaving}
                  autoComplete="nickname"
                  autoFocus
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void saveDisplayName()}
                    disabled={nameSaving}
                    className="rounded-lg bg-[#0083C1] px-4 py-2 text-sm font-black text-white shadow-md hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
                    style={{ fontFamily: "'Comic CAT', sans-serif" }}
                  >
                    {nameSaving ? '…' : 'Сохранить'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelNameEdit}
                    disabled={nameSaving}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Отмена
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
          </div>
        )}
      </header>

      <nav className="flex-shrink-0 px-3 pt-2 pb-2">
        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-thin rounded-xl bg-white/50 p-1 border border-slate-200/60">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                tab === t.id
                  ? 'bg-[#0083C1] text-white shadow-md'
                  : 'text-slate-600 hover:bg-white/80'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="flex-1 min-h-0 relative min-h-[120px]">
        {loading && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 bg-white/75 backdrop-blur-[3px]"
            aria-busy
            aria-live="polite"
          >
            <div className="relative h-12 w-12">
              <div
                className="absolute inset-0 rounded-full opacity-25"
                style={{ border: '3px solid #0083C1' }}
              />
              <div
                className="absolute inset-0 rounded-full animate-spin"
                style={{
                  border: '3px solid transparent',
                  borderTopColor: '#0083C1',
                  borderRightColor: '#0083C1',
                }}
              />
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-700">Загрузка рекордов…</p>
          </div>
        )}

        <div className="absolute inset-0 overflow-y-auto px-4 pb-6">
          <div className="mb-4 rounded-2xl border border-slate-200/70 bg-white/90 shadow-sm overflow-hidden">
            <div className="border-l-4 border-[#0083C1] px-4 py-3">
              <h3 className="text-[15px] font-black text-slate-900 leading-snug">{activeTab.title}</h3>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{activeTab.description}</p>
            </div>
          </div>

          {!uid && (
            <p className="text-sm text-slate-700 mb-4 rounded-xl bg-amber-50/95 border border-amber-200/80 px-4 py-3 leading-relaxed">
              Чтобы увидеть своё место в рейтинге, откройте игру из Telegram или по ссылке с параметром{' '}
              <span className="font-mono text-xs">utm_medium</span> (числовой id).
            </p>
          )}

          {err && (
            <p className="text-red-800 text-sm rounded-xl bg-red-50 border border-red-200/90 px-4 py-3 mb-4">
              {err}
            </p>
          )}

          {data && cat && (
            <>
              <section className="mb-4 rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Топ‑10</span>
                </div>
                {cat.top10.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-500">Пока нет данных для этого рейтинга.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {cat.top10.map((row) => {
                      return (
                        <li
                          key={`${tab}-${row.rank}-${row.uid}`}
                          className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50/60 transition-colors"
                        >
                          <span
                            className={`flex w-8 shrink-0 justify-end font-black tabular-nums ${
                              row.rank <= 3 ? 'text-[#0083C1]' : 'text-slate-400'
                            }`}
                          >
                            {row.rank}.
                          </span>
                          <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{row.tgName}</span>
                          <span className="shrink-0 tabular-nums font-mono text-[13px] font-medium text-slate-600">
                            {formatValue(tab, row.value)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="mb-4 rounded-2xl border border-[#0083C1]/25 bg-gradient-to-br from-white to-sky-50/50 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-sky-200/80 bg-sky-50/80">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#006299]">Вы</span>
                </div>
                <div className="px-4 py-4 text-sm space-y-2">
                  {!uid && <p className="text-slate-600">Идентификатор не задан — место не вычисляется.</p>}
                  {uid && me && (
                    <>
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="font-semibold text-slate-900">{meLabel}</span>
                        {me.rank != null ? (
                          <span className="text-slate-600">
                            место{' '}
                            <span className="font-black text-[#0083C1] tabular-nums">{me.rank}</span>
                            <span className="text-slate-400"> / </span>
                            <span className="tabular-nums">{cat.playersTotal}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">нет строк сессии с вашим id</span>
                        )}
                      </div>
                      <p className="text-[13px] font-mono text-slate-700 tabular-nums">
                        {formatValue(tab, me.value)}
                      </p>
                    </>
                  )}
                </div>
              </section>

              <footer className="space-y-2 rounded-xl border border-slate-200/60 bg-white/60 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
                <p>
                  Очки, симптомы и таблетки — по <span className="font-semibold text-slate-700">завершённым</span>{' '}
                  сессиям (итог на экране счёта). Сессии и время — по всем сессиям с вашим id.
                </p>
                {gapLine ? <p className="text-slate-600">{gapLine}</p> : null}
              </footer>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordsModal;
