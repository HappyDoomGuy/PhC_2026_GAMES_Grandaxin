import React, { useState, useEffect } from 'react';
import { startSessionTracking } from './lib/sessionTracking';
import { getResolvedTrackingUserId, getResolvedTgName } from './lib/telegramWebApp';
import GameContainer from './components/GameContainer';
import RecordsModal from './components/RecordsModal';
import blueImage from './blue.png';
import greenImage from './green.png';
import redImage from './red.png';
import targetImage from './target.png';

/** Кнопка «Рекорды» на стартовом экране. Поставьте `true`, чтобы снова показать. */
const SHOW_START_SCREEN_RECORDS_BUTTON = false;

const GameTitle: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <h1
    className={`font-black tracking-tighter bg-clip-text text-transparent leading-tight overflow-visible text-center ${
      compact ? 'text-[1.65rem]' : 'text-[2.6rem]'
    }`}
    style={{
      fontFamily: 'Inter, system-ui, sans-serif',
      backgroundImage: 'linear-gradient(to bottom, rgb(30, 41, 59), #0083C1)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
    }}
  >
    <span className="whitespace-nowrap">
      ГРАНДАКСИН
      <span
        className={`align-super pl-0.5 pr-1 ${compact ? 'text-lg' : 'text-3xl'}`}
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        ®
      </span>
    </span>
    <br />
    МОЖЕТ
  </h1>
);

const App: React.FC = () => {
  const [isStarted, setIsStarted] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [checkbox1, setCheckbox1] = useState(false);
  const [checkbox2, setCheckbox2] = useState(false);
  const [disclaimerInfoPage, setDisclaimerInfoPage] = useState(0);
  const [sightTarget, setSightTarget] = useState(0);
  const [trackDebugLines, setTrackDebugLines] = useState<string[]>([]);
  const [showRecords, setShowRecords] = useState(false);
  const [startExiting, setStartExiting] = useState(false);
  const [disclaimerExiting, setDisclaimerExiting] = useState(false);
  const [disclaimerFromStart, setDisclaimerFromStart] = useState(false);

  const SCREEN_TRANSITION_MS = 580;
  const SCREEN_CROSSFADE_MS = 120;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('track_debug') !== '1') return;
    setTrackDebugLines(['[track_debug=1] отладка трекинга; см. также консоль и window.__TRACK_DEBUG_LOG__']);
    const onLine = (ev: Event) => {
      const ce = ev as CustomEvent<string>;
      setTrackDebugLines((prev) => [...prev.slice(-24), ce.detail]);
    };
    window.addEventListener('track-debug', onLine);
    return () => window.removeEventListener('track-debug', onLine);
  }, []);

  useEffect(() => {
    return startSessionTracking() ?? undefined;
  }, []);

  useEffect(() => {
    if (isStarted || showDisclaimer || startExiting) return;
    const id = setInterval(() => {
      setSightTarget((prev) => {
        const others = [0, 1, 2].filter((i) => i !== prev);
        return others[Math.floor(Math.random() * others.length)];
      });
    }, 1200 + Math.random() * 800);
    return () => clearInterval(id);
  }, [isStarted, showDisclaimer, startExiting]);

  const handleStartClick = () => {
    if (startExiting) return;
    setDisclaimerInfoPage(0);
    setDisclaimerFromStart(false);
    setStartExiting(true);
    window.setTimeout(() => {
      setShowDisclaimer(true);
      setDisclaimerFromStart(true);
    }, SCREEN_TRANSITION_MS - SCREEN_CROSSFADE_MS);
    window.setTimeout(() => {
      setStartExiting(false);
    }, SCREEN_TRANSITION_MS);
  };

  const handleDisclaimerAccept = () => {
    if (!canAccept || disclaimerExiting) return;
    setDisclaimerExiting(true);
    window.setTimeout(() => {
      setShowDisclaimer(false);
      setDisclaimerInfoPage(0);
      setCheckbox1(false);
      setCheckbox2(false);
      setIsStarted(true);
      setDisclaimerExiting(false);
    }, SCREEN_TRANSITION_MS);
  };

  const canAccept = checkbox1 && checkbox2;

  const goToDisclaimerPage = (page: 0 | 1) => {
    setDisclaimerInfoPage(page);
  };

  return (
    <div className="w-full h-full overflow-hidden bg-[#05070a] text-slate-100 flex items-center justify-center" style={{ height: 'calc(var(--vh, 1vh) * 100)', minHeight: 0 }}>
      {trackDebugLines.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[100] max-h-[30vh] overflow-y-auto p-2 text-[10px] font-mono text-left bg-black/85 text-amber-200 border-t border-amber-700/50 whitespace-pre-wrap break-all pointer-events-none"
          aria-hidden
        >
          {trackDebugLines.join('\n')}
        </div>
      )}
      {/* Mobile-first Container: Forces portrait aspect ratio on desktop */}
      <div className="relative h-full w-full max-w-[500px] aspect-[9/16] bg-[#0a0f1e] shadow-2xl overflow-hidden shadow-blue-900/20">
        <style>{`
          @keyframes attention-pulse {
            0%, 100% { transform: scale(1); box-shadow: 0 10px 25px -5px rgba(0, 131, 193, 0.4); }
            50% { transform: scale(1.04); box-shadow: 0 10px 40px -5px rgba(0, 131, 193, 0.6); }
          }
          @keyframes shimmer {
            0% { transform: translateX(-100%) skewX(-15deg); }
            100% { transform: translateX(200%) skewX(-15deg); }
          }
          .attention-pulse { animation: attention-pulse 2s ease-in-out infinite; }
          .shimmer-run { animation: shimmer 2.5s ease-in-out infinite; }
          .disclaimer-flip-viewport {
            perspective: 1400px;
            perspective-origin: center center;
          }
          .disclaimer-flip-book {
            position: relative;
            width: 100%;
            transform-style: preserve-3d;
            transform-origin: center center;
            transition: transform 0.72s cubic-bezier(0.45, 0.05, 0.55, 0.95);
            will-change: transform;
          }
          .disclaimer-flip-book.is-flipped {
            transform: rotateY(-180deg);
          }
          .disclaimer-flip-page {
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            width: 100%;
            background: rgba(255, 255, 255, 0.92);
          }
          .disclaimer-flip-page--front {
            position: relative;
            transform: rotateY(0deg) translateZ(1px);
          }
          .disclaimer-flip-page--back {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            min-height: 100%;
            transform: rotateY(180deg) translateZ(1px);
          }
          @media (prefers-reduced-motion: reduce) {
            .disclaimer-flip-book {
              transition-duration: 0.01ms;
            }
          }
          @keyframes start-screen-exit {
            0% { transform: scale(1); filter: blur(0); }
            100% { transform: scale(1.05); filter: blur(5px); }
          }
          @keyframes start-screen-light-wash {
            0% { opacity: 0; }
            35% { opacity: 0.4; }
            100% { opacity: 1; }
          }
          @keyframes screen-exit-fade {
            0% { opacity: 1; transform: scale(1); filter: blur(0); }
            100% { opacity: 0; transform: scale(1.06); filter: blur(10px); }
          }
          @keyframes symptom-exit-left {
            to { transform: translate(-120%, 40%) scale(0.2) rotate(-25deg); opacity: 0; }
          }
          @keyframes symptom-exit-center {
            to { transform: translateY(-80%) scale(0.15) rotate(12deg); opacity: 0; }
          }
          @keyframes symptom-exit-right {
            to { transform: translate(120%, 30%) scale(0.2) rotate(25deg); opacity: 0; }
          }
          @keyframes sight-exit {
            to { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
          }
          @keyframes start-title-exit {
            to { opacity: 0; transform: translateY(-28px) scale(0.92); }
          }
          @keyframes start-button-exit {
            to { opacity: 0; transform: scale(0.85); }
          }
          @keyframes disclaimer-screen-enter {
            0% { opacity: 0; transform: translateY(32px) scale(0.94); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes disclaimer-content-enter {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes screen-content-exit {
            to { opacity: 0; transform: translateY(14px) scale(0.96); }
          }
          .screen-exit {
            animation: screen-exit-fade 0.58s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            pointer-events: none;
          }
          .start-screen--exit {
            animation: start-screen-exit 0.58s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            pointer-events: none;
          }
          .start-screen--exit::after {
            content: '';
            position: absolute;
            inset: 0;
            z-index: 60;
            pointer-events: none;
            background: linear-gradient(180deg, #FFFFFF 0%, #75C4E6 100%);
            animation: start-screen-light-wash 0.58s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            opacity: 0;
          }
          .screen-exit .symptom-exit-left,
          .start-screen--exit .symptom-exit-left {
            animation: symptom-exit-left 0.5s cubic-bezier(0.45, 0.05, 0.55, 0.95) forwards;
          }
          .screen-exit .symptom-exit-center,
          .start-screen--exit .symptom-exit-center {
            animation: symptom-exit-center 0.52s cubic-bezier(0.45, 0.05, 0.55, 0.95) 0.04s forwards;
          }
          .screen-exit .symptom-exit-right,
          .start-screen--exit .symptom-exit-right {
            animation: symptom-exit-right 0.5s cubic-bezier(0.45, 0.05, 0.55, 0.95) 0.02s forwards;
          }
          .screen-exit .sight-exit,
          .start-screen--exit .sight-exit {
            animation: sight-exit 0.45s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          }
          .screen-exit .start-title-exit,
          .start-screen--exit .start-title-exit {
            animation: start-title-exit 0.42s cubic-bezier(0.4, 0, 0.2, 1) 0.06s forwards;
          }
          .screen-exit .start-button-exit,
          .start-screen--exit .start-button-exit {
            animation: start-button-exit 0.38s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards;
          }
          .screen-exit .screen-content-exit {
            animation: screen-content-exit 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.05s forwards;
          }
          .disclaimer-screen-enter,
          .game-screen-enter {
            animation: disclaimer-screen-enter 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          }
          .disclaimer-screen-enter-seamless .disclaimer-enter-stagger {
            animation: disclaimer-content-enter 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.06s backwards;
          }
          .disclaimer-screen-enter .disclaimer-enter-stagger,
          .game-screen-enter .game-enter-stagger {
            animation: disclaimer-content-enter 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.12s backwards;
          }
          @media (prefers-reduced-motion: reduce) {
            .screen-exit,
            .start-screen--exit,
            .start-screen--exit::after,
            .screen-exit .symptom-exit-left,
            .start-screen--exit .symptom-exit-left,
            .screen-exit .symptom-exit-center,
            .start-screen--exit .symptom-exit-center,
            .screen-exit .symptom-exit-right,
            .start-screen--exit .symptom-exit-right,
            .screen-exit .sight-exit,
            .start-screen--exit .sight-exit,
            .screen-exit .start-title-exit,
            .start-screen--exit .start-title-exit,
            .screen-exit .start-button-exit,
            .start-screen--exit .start-button-exit,
            .screen-exit .screen-content-exit,
            .disclaimer-screen-enter,
            .disclaimer-screen-enter-seamless .disclaimer-enter-stagger,
            .game-screen-enter,
            .disclaimer-screen-enter .disclaimer-enter-stagger,
            .game-screen-enter .game-enter-stagger {
              animation-duration: 0.01ms !important;
              animation-delay: 0ms !important;
            }
          }
        `}</style>
        {/* Объединённый дисклеймер */}
        {(showDisclaimer || disclaimerExiting) && (
          <div 
            className={`absolute inset-0 flex flex-col items-center justify-start p-3 pt-4 z-50 overflow-y-auto overflow-x-hidden ${
              disclaimerExiting
                ? 'screen-exit'
                : disclaimerFromStart
                  ? 'disclaimer-screen-enter-seamless'
                  : 'disclaimer-screen-enter'
            }`}
            style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #75C4E6 100%)' }}
          >
            <div className={`w-full max-w-md space-y-2 flex-shrink-0 ${disclaimerExiting ? '' : 'disclaimer-enter-stagger'}`}>
              <div className="mb-2 start-title-exit">
                <GameTitle compact />
              </div>

              <div className="space-y-2 screen-content-exit">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checkbox1}
                    onChange={(e) => setCheckbox1(e.target.checked)}
                    className="mt-0.5 w-4 h-4 min-w-[16px] min-h-[16px] flex-shrink-0 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500 focus:ring-offset-0 accent-blue-500"
                  />
                  <span className="text-slate-700 text-xs leading-snug">
                    Я ознакомился с информацией и понимаю, что игра носит исключительно развлекательный характер
                  </span>
                </label>
                
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checkbox2}
                    onChange={(e) => setCheckbox2(e.target.checked)}
                    className="mt-0.5 w-4 h-4 min-w-[16px] min-h-[16px] flex-shrink-0 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500 focus:ring-offset-0 accent-blue-500"
                  />
                  <span className="text-slate-700 text-xs leading-snug">
                    Я подтверждаю, что являюсь специалистом в сфере здравоохранения
                  </span>
                </label>
              </div>

              <div className={`relative w-full mb-3 start-button-exit ${canAccept ? 'group' : ''}`}>
                {canAccept && (
                  <div className="absolute -inset-1 bg-blue-500 rounded-2xl blur opacity-25 group-hover:opacity-60 transition duration-1000" />
                )}
                <button
                  onClick={handleDisclaimerAccept}
                  disabled={!canAccept || disclaimerExiting}
                  className={`relative w-full py-3 rounded-xl font-black text-base transition-all active:scale-95 overflow-hidden ${
                    canAccept 
                      ? 'attention-pulse text-white' 
                      : 'bg-slate-200/80 text-slate-500 cursor-not-allowed'
                  }`}
                  style={{ fontFamily: "'Comic CAT', sans-serif", backgroundColor: canAccept ? '#0083C1' : undefined }}
                >
                  {canAccept && (
                    <span className="absolute inset-0 shimmer-run pointer-events-none z-0" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)', width: '40%' }} />
                  )}
                  <span className={canAccept ? 'relative z-10' : ''}>Начать игру</span>
                </button>
              </div>

              <div className="bg-white/90 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-3 shadow-lg shadow-slate-300/25 flex flex-col overflow-hidden screen-content-exit">
                <div className="disclaimer-flip-viewport overflow-hidden">
                  <div
                    className={`disclaimer-flip-book ${disclaimerInfoPage === 1 ? 'is-flipped' : ''}`}
                  >
                    <div
                      className="disclaimer-flip-page disclaimer-flip-page--front space-y-2"
                      aria-hidden={disclaimerInfoPage !== 0}
                    >
                    <h2 className="text-base font-black text-slate-800 tracking-tight text-left uppercase">
                      Важная информация
                    </h2>
                    <p className="text-slate-700 text-xs leading-snug">
                      Игра-тапер «Грандаксин<span className="align-super" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '0.5em' }}>®</span> может» является развлекательным приложением и создана исключительно в игровых и развлекательных целях.
                    </p>
                    <p className="text-slate-700 text-xs leading-snug">
                      Игра предназначена только для специалистов здравоохранения (включая, но не ограничиваясь, врачей, медсестер, фельдшеров, студентов медицинских вузов, фармацевтов, провизоров, работников аптек и т.д.).
                    </p>
                    <p className="text-slate-700 text-xs leading-snug">
                      <span className="font-semibold text-slate-800">Конфиденциальность.</span> Приложение не собирает, не обрабатывает и не хранит персональные данные пользователей. Весь игровой процесс является анонимным.
                    </p>
                    <p className="text-slate-700 text-xs leading-snug">
                      <span className="font-semibold text-slate-800">Не является медицинской услугой:</span> данная игра никоим образом не является медицинским устройством, диагностическим инструментом или средством лечения.
                    </p>
                    </div>

                    <div
                      className="disclaimer-flip-page disclaimer-flip-page--back space-y-2"
                      aria-hidden={disclaimerInfoPage !== 1}
                    >
                    <h2 className="text-base font-black text-slate-800 tracking-tight text-left uppercase">
                      Отказ от ответственности
                    </h2>
                    <p className="text-slate-700 text-xs leading-snug">
                      Разработчики и правообладатели игры не несут ответственности за любые решения или действия, предпринятые пользователем на основании информации, впечатлений или ассоциаций, возникших в ходе использования данного приложения.
                    </p>
                    <h2 className="text-base font-black text-slate-800 tracking-tight text-left uppercase pt-1">
                      Подтверждение
                    </h2>
                    <p className="text-slate-700 text-xs leading-snug">
                      Я подтверждаю, что являюсь специалистом в сфере здравоохранения и понимаю, что Игра-тапер «Грандаксин<span className="align-super" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '0.5em' }}>®</span> может» носит исключительно развлекательный и игровой характер. Я осознаю, что данное приложение не является медицинским инструментом, не призывает к самолечению. Мне известно, что приложение является анонимным и не собирает мои персональные данные.
                    </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-3 mt-2 border-t border-slate-200/70">
                  {disclaimerInfoPage > 0 ? (
                    <button
                      type="button"
                      onClick={() => goToDisclaimerPage(0)}
                      aria-label="Назад"
                      className="relative flex items-center justify-center w-10 h-10 rounded-full text-white overflow-hidden transition-all active:scale-95 shadow-md shadow-blue-900/25"
                      style={{ backgroundColor: '#0083C1' }}
                    >
                      <span
                        className="absolute inset-0 shimmer-run pointer-events-none opacity-50"
                        style={{
                          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
                          width: '50%',
                        }}
                      />
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="relative z-10" aria-hidden>
                        <path
                          d="M14 6L8 12L14 18"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  ) : (
                    <div className="w-10 flex-shrink-0" aria-hidden />
                  )}

                  <div className="flex-1 flex justify-center items-center gap-1.5">
                    {[0, 1].map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => goToDisclaimerPage(page as 0 | 1)}
                        aria-label={page === 0 ? 'Страница 1' : 'Страница 2'}
                        aria-current={disclaimerInfoPage === page ? 'page' : undefined}
                        className={`h-2.5 rounded-full transition-all duration-300 ${
                          disclaimerInfoPage === page ? 'w-8 bg-[#0083C1]' : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                        }`}
                      />
                    ))}
                  </div>

                  {disclaimerInfoPage === 0 ? (
                    <button
                      type="button"
                      onClick={() => goToDisclaimerPage(1)}
                      aria-label="Далее"
                      className="relative flex items-center justify-center w-10 h-10 rounded-full text-white overflow-hidden transition-all active:scale-95 shadow-md shadow-blue-900/25"
                      style={{ backgroundColor: '#0083C1' }}
                    >
                      <span
                        className="absolute inset-0 shimmer-run pointer-events-none opacity-50"
                        style={{
                          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
                          width: '50%',
                        }}
                      />
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="relative z-10" aria-hidden>
                        <path
                          d="M10 6L16 12L10 18"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  ) : (
                    <div className="w-10 flex-shrink-0" aria-hidden />
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Стартовый экран */}
        {!isStarted && (!showDisclaimer || startExiting) && (
          <div
            className={`absolute inset-0 h-full w-full flex flex-col items-center justify-center p-8 space-y-12 z-40 ${startExiting ? 'start-screen--exit' : 'animate-in fade-in duration-1000'}`}
            style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #75C4E6 100%)' }}
          >
            <style>{`
              @keyframes float {
                0%, 100% { transform: translate(0, 0); }
                25% { transform: translate(6px, -8px); }
                50% { transform: translate(-5px, 4px); }
                75% { transform: translate(-4px, -6px); }
              }
              @keyframes float-vertical {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-8px); }
              }
              @keyframes attention-pulse {
                0%, 100% { transform: scale(1); box-shadow: 0 10px 25px -5px rgba(0, 131, 193, 0.4); }
                50% { transform: scale(1.04); box-shadow: 0 10px 40px -5px rgba(0, 131, 193, 0.6); }
              }
              @keyframes shimmer {
                0% { transform: translateX(-100%) skewX(-15deg); }
                100% { transform: translateX(200%) skewX(-15deg); }
              }
              @keyframes sight-float {
                0%, 100% { transform: translate(-50%, -50%) translateY(0); }
                50% { transform: translate(-50%, -50%) translateY(-10px); }
              }
              .float-symptom { animation: float 6s ease-in-out infinite; }
              .attention-pulse { animation: attention-pulse 2s ease-in-out infinite; }
              .shimmer-run { animation: shimmer 2.5s ease-in-out infinite; }
              .float-vertical { animation: float-vertical 3s ease-in-out infinite; }
              .sight-float { animation: sight-float 2.5s ease-in-out infinite; }
            `}</style>
            <div className="text-center space-y-4">
              <div className="relative flex items-end justify-center gap-0 mb-6 min-h-[9rem]">
                <div className="translate-y-3 symptom-exit-left">
                  <img src={redImage} alt="Стресс" className="w-36 h-36 object-contain float-symptom" style={{ animationDelay: '0s', filter: 'drop-shadow(0 6px 12px rgba(59, 130, 246, 0.55)) drop-shadow(0 12px 24px rgba(30, 64, 175, 0.4))' }} />
                </div>
                <div className="-translate-y-5 symptom-exit-center">
                  <img src={blueImage} alt="Тревога" className="w-36 h-36 object-contain float-symptom" style={{ animationDelay: '0.4s', filter: 'drop-shadow(0 6px 12px rgba(59, 130, 246, 0.55)) drop-shadow(0 12px 24px rgba(30, 64, 175, 0.4))' }} />
                </div>
                <div className="translate-y-4 symptom-exit-right">
                  <img src={greenImage} alt="Нервозность" className="w-36 h-36 object-contain float-symptom" style={{ animationDelay: '0.8s', filter: 'drop-shadow(0 6px 12px rgba(59, 130, 246, 0.55)) drop-shadow(0 12px 24px rgba(30, 64, 175, 0.4))' }} />
                </div>
                <img
                  src={targetImage}
                  alt=""
                  className="absolute w-36 h-36 object-contain sight-float sight-exit pointer-events-none z-10 transition-all duration-500 ease-in-out"
                  style={{
                    left: sightTarget === 0 ? '16.67%' : sightTarget === 1 ? '50%' : '83.33%',
                    top: sightTarget === 0 ? '58%' : sightTarget === 1 ? '36%' : '61%',
                  }}
                />
              </div>
              <div className="start-title-exit">
                <GameTitle />
              </div>
            </div>

            <div className="w-full max-w-[180px] mx-auto flex flex-col items-stretch gap-3 start-button-exit">
              <div className="relative group w-full">
                <div className="absolute -inset-1 bg-blue-500 rounded-2xl blur opacity-25 group-hover:opacity-60 transition duration-1000 pointer-events-none" />
                <button
                  type="button"
                  onClick={handleStartClick}
                  disabled={startExiting}
                  className="relative w-full py-1.5 text-white rounded-2xl font-black transition-all active:scale-95 attention-pulse overflow-hidden disabled:pointer-events-none"
                  style={{ fontFamily: "'Comic CAT', sans-serif", backgroundColor: '#0083C1', fontSize: '28px' }}
                >
                  <span
                    className="absolute inset-0 shimmer-run pointer-events-none z-0"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
                      width: '40%',
                    }}
                  />
                  <span className="relative z-10">СТАРТ</span>
                </button>
              </div>
              {SHOW_START_SCREEN_RECORDS_BUTTON ? (
                <button
                  type="button"
                  onClick={() => setShowRecords(true)}
                  className="w-full py-1.5 rounded-2xl font-black transition-all active:scale-95 border-2 border-[#0083C1] text-[#0083C1] bg-white/90 shadow-md"
                  style={{ fontFamily: "'Comic CAT', sans-serif", fontSize: '22px' }}
                >
                  Рекорды
                </button>
              ) : null}
            </div>

            <div className="text-center">
              <p className="text-black text-sm font-medium">
                Игра-тапер предназначена только для специалистов здравоохранения
              </p>
            </div>
          </div>
        )}

        {/* Игровой экран */}
        {isStarted && !showDisclaimer && (
          <div className="game-screen-enter absolute inset-0 z-30 h-full w-full">
            <div className="game-enter-stagger h-full w-full">
              <GameContainer onExit={() => setIsStarted(false)} />
            </div>
          </div>
        )}

        {!isStarted && !showDisclaimer && SHOW_START_SCREEN_RECORDS_BUTTON ? (
          <RecordsModal
            open={showRecords}
            onClose={() => setShowRecords(false)}
            uid={getResolvedTrackingUserId()}
            localDisplayName={getResolvedTgName()}
          />
        ) : null}
      </div>
    </div>
  );
};

export default App;
