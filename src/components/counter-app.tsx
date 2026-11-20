"use client";

import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { track } from "@vercel/analytics";
import {
  COUNTER_STORAGE_KEY,
  createCounterSession,
  createEmptyStoredCounterData,
  createShareText,
  formatDuration,
  formatTime,
  getDelayMessage,
  getSessionSummary,
  getTodayDelayMinutes,
  parseStoredCounterData,
  postponeSession,
  resetStoredCounterData,
  serializeStoredCounterData,
  undoPostponement,
  type CounterSession,
  type DelayStage,
  type StoredCounterData,
} from "@/lib/counter";

const THEME_STORAGE_KEY = "ato5fun:theme";
const EMPTY_COUNTER_DATA = createEmptyStoredCounterData();
const counterStoreListeners = new Set<() => void>();

let counterStoreInitialized = false;
let counterStoreSnapshot = EMPTY_COUNTER_DATA;
let storageListenerAttached = false;

type Theme = "light" | "dark";

function getCounterSnapshot() {
  if (!counterStoreInitialized) {
    try {
      counterStoreSnapshot = parseStoredCounterData(
        localStorage.getItem(COUNTER_STORAGE_KEY),
      );
    } catch {
      counterStoreSnapshot = EMPTY_COUNTER_DATA;
    }
    counterStoreInitialized = true;
  }

  return counterStoreSnapshot;
}

function getServerCounterSnapshot(): null {
  return null;
}

function notifyCounterStore() {
  counterStoreListeners.forEach((listener) => listener());
}

function handleStorageEvent(event: StorageEvent) {
  if (event.key !== COUNTER_STORAGE_KEY && event.key !== null) return;
  counterStoreSnapshot = parseStoredCounterData(event.newValue);
  counterStoreInitialized = true;
  notifyCounterStore();
}

function subscribeCounterStore(listener: () => void) {
  counterStoreListeners.add(listener);

  if (!storageListenerAttached) {
    window.addEventListener("storage", handleStorageEvent);
    storageListenerAttached = true;
  }

  return () => {
    counterStoreListeners.delete(listener);
    if (counterStoreListeners.size === 0 && storageListenerAttached) {
      window.removeEventListener("storage", handleStorageEvent);
      storageListenerAttached = false;
    }
  };
}

function updateCounterStore(
  updater: (current: StoredCounterData) => StoredCounterData,
) {
  const next = updater(getCounterSnapshot());
  counterStoreSnapshot = next;
  counterStoreInitialized = true;

  let saved = true;
  try {
    localStorage.setItem(COUNTER_STORAGE_KEY, serializeStoredCounterData(next));
  } catch {
    saved = false;
  }

  notifyCounterStore();
  return saved;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function toDatetimeLocal(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function getDefaultStartValue() {
  const date = new Date();
  const minutes = date.getMinutes() + date.getSeconds() / 60;
  date.setMinutes(Math.ceil((minutes + 0.01) / 5) * 5, 0, 0);
  return toDatetimeLocal(date);
}

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function stageLabel(stage: DelayStage) {
  const labels: Record<DelayStage, string> = {
    ready: "無傷",
    margin: "誤差",
    warning: "要注意",
    abandon: "再検討",
    collapsed: "崩壊",
  };

  return labels[stage];
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.2 15.1A8.5 8.5 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 7-5 5 5 5M5 12h8a6 6 0 0 1 6 6" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </svg>
  );
}

function ThemeToggle() {
  function toggleTheme() {
    const current = document.documentElement.dataset.theme === "dark";
    const next: Theme = current ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // The visual toggle still works when storage is unavailable.
    }
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label="ライトモードとダークモードを切り替える"
      title="表示モードを切り替える"
    >
      <span className="theme-icon theme-icon-sun">
        <SunIcon />
      </span>
      <span className="theme-icon theme-icon-moon">
        <MoonIcon />
      </span>
    </button>
  );
}

function Header() {
  return (
    <header className="topbar">
      <a className="brand" href="#top" aria-label="あと5分カウンター トップ">
        <span className="brand-mark" aria-hidden="true">
          +5
        </span>
        <span className="brand-copy">
          <strong>あと5分</strong>
          <span>COUNTER</span>
        </span>
      </a>
      <ThemeToggle />
    </header>
  );
}

interface SetupFormProps {
  planName: string;
  startAt: string;
  onPlanNameChange: (value: string) => void;
  onStartAtChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function SetupForm({
  planName,
  startAt,
  onPlanNameChange,
  onStartAtChange,
  onSubmit,
}: SetupFormProps) {
  return (
    <section className="setup-grid" aria-labelledby="setup-title">
      <div className="intro-block">
        <p className="eyebrow">PROCRASTINATION, MEASURED.</p>
        <h1 id="setup-title" className="hero-title">
          その「あと5分」、
          <span>ちゃんと数えます。</span>
        </h1>
        <p className="hero-copy">
          押すたびに予定は5分ずつ後退。画面は赤くなり、言い訳だけが鮮明になります。
        </p>
      </div>

      <form className="setup-card surface" onSubmit={onSubmit}>
        <div className="form-heading">
          <span className="step-number" aria-hidden="true">
            01
          </span>
          <div>
            <p className="section-kicker">予定の寿命を設定</p>
            <h2>まずは、始める予定を。</h2>
          </div>
        </div>

        <label className="field">
          <span className="field-label">予定の名前</span>
          <input
            className="text-input"
            type="text"
            name="planName"
            value={planName}
            onChange={(event) => onPlanNameChange(event.target.value)}
            placeholder="例：ポートフォリオを更新する"
            maxLength={80}
            autoComplete="off"
            required
          />
          <span className="field-hint">ここだけは、まだ正直に。</span>
        </label>

        <label className="field">
          <span className="field-label">本来の開始時刻</span>
          <input
            className="text-input"
            type="datetime-local"
            name="startAt"
            value={startAt}
            onChange={(event) => onStartAtChange(event.target.value)}
            step={300}
            required
          />
          <span className="field-hint">あとで容赦なく比較します。</span>
        </label>

        <button className="primary-button" type="submit">
          <span>カウンターを準備する</span>
          <ArrowIcon />
        </button>
      </form>
    </section>
  );
}

interface ActiveCounterProps {
  session: CounterSession;
  onPostpone: () => void;
  onUndo: () => void;
  onShare: () => void;
  onXShare: () => void;
  xShareUrl: string;
  onRequestReset: () => void;
  delayButtonRef: React.RefObject<HTMLButtonElement | null>;
}

function ActiveCounter({
  session,
  onPostpone,
  onUndo,
  onShare,
  onXShare,
  xShareUrl,
  onRequestReset,
  delayButtonRef,
}: ActiveCounterProps) {
  const summary = getSessionSummary(session);
  const canUndo = summary.postponeCount > 0;

  return (
    <section className="counter-layout" aria-labelledby="plan-title">
      <div className="plan-head">
        <div>
          <p className="section-kicker">いま先延ばし中の予定</p>
          <h1 id="plan-title" className="plan-title">
            {session.planName}
          </h1>
        </div>
        <span className={`stage-pill stage-${summary.status.stage}`}>
          <span aria-hidden="true" />
          {stageLabel(summary.status.stage)}
        </span>
      </div>

      <div className="timeline" role="group" aria-label="予定時刻の変化">
        <div>
          <span>本来</span>
          <strong>{formatTime(session.originalStartAt)}</strong>
        </div>
        <span className="timeline-arrow" aria-hidden="true">
          <ArrowIcon />
        </span>
        <div className="timeline-current">
          <span>いま</span>
          <strong>{formatTime(summary.currentStartAt)}</strong>
        </div>
      </div>

      <div className="counter-stage">
        <div className="orbit orbit-one" aria-hidden="true" />
        <div className="orbit orbit-two" aria-hidden="true" />
        <button
          ref={delayButtonRef}
          className="delay-button"
          type="button"
          onClick={onPostpone}
          aria-label="予定を5分延期する"
          aria-describedby="delay-keyboard-hint"
        >
          <span className="delay-plus">+5</span>
          <span className="delay-label">あと5分</span>
          <span className="delay-sub">を追加</span>
        </button>
      </div>
      <p id="delay-keyboard-hint" className="keyboard-hint">
        <kbd>Enter</kbd>
        <span>または</span>
        <kbd>Space</kbd>
        <span>でも延期できます</span>
      </p>

      <div className="status-panel surface">
        <div className="message-row">
          <span className={`status-symbol status-${summary.status.stage}`} aria-hidden="true">
            {summary.status.isCollapsed ? "×" : summary.status.stage === "ready" ? "○" : "!"}
          </span>
          <div>
            <p className="section-kicker">現在の所見</p>
            <h2>{summary.status.message}</h2>
          </div>
        </div>

        <div className="meter-block">
          <div className="meter-head">
            <span>予定崩壊メーター</span>
            <strong>{summary.status.collapsePercent}%</strong>
          </div>
          <div
            className="meter-track"
            role="progressbar"
            aria-label="予定の崩壊度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={summary.status.collapsePercent}
            aria-valuetext={`${summary.status.collapsePercent}%、${summary.status.message}`}
          >
            <span style={{ width: `${summary.status.collapsePercent}%` }} />
          </div>
          <div className="meter-scale" aria-hidden="true">
            <span>平和</span>
            <span>30分</span>
            <span>1時間</span>
            <span>3時間</span>
          </div>
        </div>
      </div>

      <dl className="stats-grid">
        <div className="stat-card surface">
          <dt>累計延期</dt>
          <dd className="stat-value">{formatDuration(summary.totalDelayMinutes)}</dd>
          <dd className="stat-note">消えた時間</dd>
        </div>
        <div className="stat-card surface">
          <dt>押した回数</dt>
          <dd className="stat-value">
            {summary.postponeCount}
            <small>回</small>
          </dd>
          <dd className="stat-note">意思決定の回数</dd>
        </div>
        <div className="stat-card surface stat-highlight">
          <dt>現在の開始予定</dt>
          <dd className="stat-value">{formatTime(summary.currentStartAt)}</dd>
          <dd className="stat-note">たぶん、きっと</dd>
        </div>
      </dl>

      <div className="action-grid" role="group" aria-label="カウンター操作">
        <button
          className="secondary-button"
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
        >
          <UndoIcon />
          1回戻す
        </button>
        <button className="secondary-button" type="button" onClick={onShare}>
          <ShareIcon />
          共有
        </button>
        <a
          className="secondary-button x-button"
          href={xShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onXShare}
        >
          <span className="x-mark" aria-hidden="true">
            X
          </span>
          Xに投稿
        </a>
        <button
          className="secondary-button danger-button"
          type="button"
          onClick={onRequestReset}
        >
          <TrashIcon />
          リセット
        </button>
      </div>
    </section>
  );
}

function TodaySummary({ totalMinutes }: { totalMinutes: number }) {
  return (
    <aside className="today-card surface" aria-labelledby="today-title">
      <div>
        <p className="section-kicker">TODAY&apos;S DAMAGE</p>
        <h2 id="today-title">本日の先延ばし合計</h2>
      </div>
      <div className="today-total">
        <strong>{formatDuration(totalMinutes)}</strong>
        <span>{totalMinutes === 0 ? "今日はまだ無傷です" : "今日から消えました"}</span>
      </div>
    </aside>
  );
}

function HistoryPanel({ history }: { history: CounterSession[] }) {
  const recent = [...history].reverse().slice(0, 6);

  return (
    <section className="history-panel" aria-labelledby="history-title">
      <div className="history-heading">
        <div>
          <p className="section-kicker">RECENT COLLAPSES</p>
          <h2 id="history-title">最近の記録</h2>
        </div>
        <span>{history.length}件</span>
      </div>

      {recent.length === 0 ? (
        <div className="history-empty surface">
          <span aria-hidden="true">◎</span>
          <p>まだ崩壊の記録はありません。</p>
          <small>これは、とても良いことです。</small>
        </div>
      ) : (
        <ol className="history-list">
          {recent.map((session) => {
            const summary = getSessionSummary(session);
            return (
              <li className="history-item surface" key={session.id}>
                <div className="history-copy">
                  <strong>{session.planName}</strong>
                  <span>
                    {formatHistoryDate(session.archivedAt ?? session.updatedAt)}
                  </span>
                </div>
                <div className="history-result">
                  <strong>{formatDuration(summary.totalDelayMinutes)}</strong>
                  <span>{summary.postponeCount}回</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

async function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Continue to the legacy, user-gesture based fallback below.
  }

  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

export function CounterApp() {
  const counterSnapshot = useSyncExternalStore(
    subscribeCounterStore,
    getCounterSnapshot,
    getServerCounterSnapshot,
  );
  const data = counterSnapshot ?? EMPTY_COUNTER_DATA;
  const isHydrated = counterSnapshot !== null;
  const [planName, setPlanName] = useState("");
  const [startAt, setStartAt] = useState(getDefaultStartValue);
  const [announcement, setAnnouncement] = useState("");
  const [toast, setToast] = useState("");
  const [fallbackShareText, setFallbackShareText] = useState("");
  const [todayReference, setTodayReference] = useState(() => new Date());
  const delayButtonRef = useRef<HTMLButtonElement>(null);
  const resetDialogRef = useRef<HTMLDialogElement>(null);

  const activeSessionId = data.activeSession?.id ?? null;
  useEffect(() => {
    if (!activeSessionId || !isHydrated) return;
    const frame = requestAnimationFrame(() => delayButtonRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [activeSessionId, isHydrated]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    let midnightTimer = 0;

    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      midnightTimer = window.setTimeout(() => {
        setTodayReference(new Date());
        scheduleMidnightRefresh();
      }, nextMidnight.getTime() - now.getTime() + 1_000);
    };

    scheduleMidnightRefresh();
    return () => window.clearTimeout(midnightTimer);
  }, []);

  const activeSummary = data.activeSession
    ? getSessionSummary(data.activeSession)
    : null;
  const heat = activeSummary
    ? Math.min(1, activeSummary.totalDelayMinutes / 180)
    : 0;
  const todayTotal = useMemo(
    () => getTodayDelayMinutes(data, todayReference),
    [data, todayReference],
  );
  const shareText = data.activeSession
    ? createShareText(
        data.activeSession,
        typeof window === "undefined" ? undefined : window.location.href,
      )
    : "";
  const xShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
  const shellStyle = { "--heat": heat } as CSSProperties;

  function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = planName.trim();
    const parsedStart = new Date(startAt);

    if (!normalizedName || !Number.isFinite(parsedStart.getTime())) {
      setToast("予定名と開始時刻を確認してください");
      return;
    }

    const now = new Date().toISOString();
    const session = createCounterSession({
      id: createId(),
      planName: normalizedName,
      originalStartAt: parsedStart.toISOString(),
      createdAt: now,
    });
    const saved = updateCounterStore((current) => ({
      ...current,
      activeSession: session,
    }));
    if (!saved) setToast("このブラウザでは履歴を保存できませんでした");
    setAnnouncement(`${normalizedName}のカウンターを開始しました`);
    setFallbackShareText("");
  }

  function handlePostpone() {
    const eventId = createId();
    const pressedAt = new Date().toISOString();

    const saved = updateCounterStore((current) => {
      if (!current.activeSession) return current;
      return {
        ...current,
        activeSession: postponeSession(current.activeSession, {
          id: eventId,
          pressedAt,
        }),
      };
    });
    if (!saved) setToast("このブラウザでは履歴を保存できませんでした");

    const nextMinutes = (activeSummary?.totalDelayMinutes ?? 0) + 5;
    const nextCount = (activeSummary?.postponeCount ?? 0) + 1;
    setAnnouncement(
      `${getDelayMessage(nextMinutes)}。5分延期しました。累計${formatDuration(nextMinutes)}、${nextCount}回目です`,
    );
    setFallbackShareText("");
    navigator.vibrate?.(12);
    track("postpone_click", {
      delay_minutes: nextMinutes,
      press_count: nextCount,
    });
  }

  function handleUndo() {
    const undoneAt = new Date().toISOString();
    const saved = updateCounterStore((current) => {
      if (!current.activeSession) return current;
      return {
        ...current,
        activeSession: undoPostponement(current.activeSession, undoneAt),
      };
    });
    if (!saved) setToast("このブラウザでは履歴を保存できませんでした");

    const nextMinutes = Math.max(0, (activeSummary?.totalDelayMinutes ?? 0) - 5);
    setAnnouncement(
      `${getDelayMessage(nextMinutes)}。直前の延期を戻しました。累計${formatDuration(nextMinutes)}です`,
    );
    setToast("5分だけ、予定を取り戻しました");
    setFallbackShareText("");
  }

  async function handleShare() {
    if (!data.activeSession) return;
    const text = createShareText(data.activeSession, window.location.href);

    if (navigator.share) {
      try {
        await navigator.share({ title: "あと5分カウンター", text });
        track("share_result", { method: "web_share" });
        setToast("結果を共有しました");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    const didCopy = await copyToClipboard(text);
    if (didCopy) {
      track("share_result", { method: "clipboard" });
      setToast("共有文をコピーしました");
      return;
    }

    setFallbackShareText(text);
    setToast("下の共有文を選択してコピーしてください");
  }

  function handleXShare() {
    track("share_result", { method: "x_intent" });
  }

  function handleReset() {
    if (!data.activeSession) return;
    track("reset_counter", {
      delay_minutes: activeSummary?.totalDelayMinutes ?? 0,
      press_count: activeSummary?.postponeCount ?? 0,
    });
    const saved = updateCounterStore((current) =>
      resetStoredCounterData(current, new Date().toISOString()),
    );
    if (!saved) setToast("このブラウザでは履歴を保存できませんでした");
    setPlanName("");
    setStartAt(getDefaultStartValue());
    setFallbackShareText("");
    setAnnouncement("カウンターをリセットしました。記録は履歴に保存されています");
    resetDialogRef.current?.close();
  }

  return (
    <div
      id="top"
      className="app-shell"
      data-stage={activeSummary?.status.stage ?? "ready"}
      style={shellStyle}
    >
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <div className="app-frame">
        <Header />

        <main className="content-stack">
          {!isHydrated ? (
            <div className="loading-state" role="status">
              <span aria-hidden="true">+5</span>
              <p>言い訳を読み込み中…</p>
            </div>
          ) : data.activeSession ? (
            <ActiveCounter
              session={data.activeSession}
              onPostpone={handlePostpone}
              onUndo={handleUndo}
              onShare={handleShare}
              onXShare={handleXShare}
              xShareUrl={xShareUrl}
              onRequestReset={() => resetDialogRef.current?.showModal()}
              delayButtonRef={delayButtonRef}
            />
          ) : (
            <SetupForm
              planName={planName}
              startAt={startAt}
              onPlanNameChange={setPlanName}
              onStartAtChange={setStartAt}
              onSubmit={handleStart}
            />
          )}

          {isHydrated && (
            <>
              <TodaySummary totalMinutes={todayTotal} />
              <HistoryPanel history={data.history} />
            </>
          )}

          {fallbackShareText && (
            <section className="manual-share surface" aria-labelledby="manual-share-title">
              <div>
                <p className="section-kicker">MANUAL SHARE</p>
                <h2 id="manual-share-title">共有文を手動でコピー</h2>
              </div>
              <label className="sr-only" htmlFor="manual-share-text">
                共有用テキスト
              </label>
              <textarea
                id="manual-share-text"
                readOnly
                value={fallbackShareText}
                onFocus={(event) => event.target.select()}
              />
            </section>
          )}
        </main>

        <footer className="footer">
          <p>データはこのブラウザだけ。言い訳はあなたのもの。</p>
          <p><a href="/privacy">プライバシーポリシー</a></p>
          <span>© 2026 ATO 5 FUN COUNTER</span>
        </footer>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {toast && (
        <div className="toast" role="status">
          <span aria-hidden="true">✓</span>
          {toast}
        </div>
      )}

      <dialog
        className="reset-dialog"
        ref={resetDialogRef}
        aria-labelledby="reset-dialog-title"
        aria-describedby="reset-dialog-description"
      >
        <form method="dialog">
          <span className="dialog-mark" aria-hidden="true">
            ↺
          </span>
          <p className="section-kicker">RESET COUNTER</p>
          <h2 id="reset-dialog-title">この予定を終了しますか？</h2>
          <p id="reset-dialog-description">
            カウンターは初期画面に戻ります。これまでの先延ばしは履歴にきちんと残ります。
          </p>
          <div className="dialog-actions">
            <button className="secondary-button" value="cancel">
              やめる
            </button>
            <button
              className="primary-button compact-button"
              type="button"
              onClick={handleReset}
            >
              終了して記録する
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
