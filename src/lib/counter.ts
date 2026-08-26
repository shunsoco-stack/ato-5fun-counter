import type {
  CounterSession,
  CounterSessionSummary,
  CreateCounterSessionInput,
  DelayEvent,
  DelayStage,
  DelayStatus,
  PostponeSessionInput,
  StoredCounterData,
} from "./types";

export type {
  CounterSession,
  CounterSessionSummary,
  CreateCounterSessionInput,
  DelayEvent,
  DelayStage,
  DelayStatus,
  PostponeSessionInput,
  StoredCounterData,
} from "./types";

export const COUNTER_STORAGE_KEY = "ato-5fun-counter:counter:v1";
export const POSTPONEMENT_MINUTES = 5;
export const COLLAPSE_MINUTES = 180;

const MAX_ID_LENGTH = 128;
const MAX_PLAN_NAME_LENGTH = 120;
const MAX_TIMESTAMP_LENGTH = 64;
const MAX_HISTORY_ENTRIES = 366;
const MAX_EVENTS_PER_SESSION = 2_000;
const MAX_TOTAL_EVENTS = 10_000;
const MAX_SERIALIZED_LENGTH = 2_000_000;

const DELAY_MESSAGES: Readonly<Record<DelayStage, string>> = {
  ready: "まだ何も壊れていません",
  margin: "まだ誤差です",
  warning: "そろそろ始めませんか？",
  abandon: "もう別日にしません？",
  collapsed: "予定は完全に崩壊しました",
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_ID_LENGTH
  );
}

function normalizePlanName(value: string): string {
  return value.trim().slice(0, MAX_PLAN_NAME_LENGTH);
}

function toIsoString(value: string | Date): string | null {
  if (
    typeof value === "string" &&
    (value.length === 0 || value.length > MAX_TIMESTAMP_LENGTH)
  ) {
    return null;
  }

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function requireIsoString(value: string | Date, fieldName: string): string {
  const iso = toIsoString(value);

  if (iso === null) {
    throw new TypeError(`${fieldName} must be a valid date.`);
  }

  return iso;
}

function requireSafeId(value: string, fieldName: string): string {
  if (!isSafeId(value)) {
    throw new TypeError(`${fieldName} must be a non-empty identifier.`);
  }

  return value;
}

function normalizeMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function sanitizeDelayEvent(value: unknown): DelayEvent | null {
  if (!isRecord(value) || !isSafeId(value.id)) {
    return null;
  }

  if (value.minutes !== POSTPONEMENT_MINUTES) {
    return null;
  }

  const pressedAt =
    typeof value.pressedAt === "string" ? toIsoString(value.pressedAt) : null;
  const undoneAt =
    value.undoneAt === null
      ? null
      : typeof value.undoneAt === "string"
        ? toIsoString(value.undoneAt)
        : null;

  if (pressedAt === null || (value.undoneAt !== null && undoneAt === null)) {
    return null;
  }

  return {
    id: value.id,
    minutes: POSTPONEMENT_MINUTES,
    pressedAt,
    undoneAt,
  };
}

function sanitizeSession(
  value: unknown,
  remainingEventBudget: number,
): CounterSession | null {
  if (
    !isRecord(value) ||
    !isSafeId(value.id) ||
    typeof value.planName !== "string" ||
    value.planName.length > MAX_PLAN_NAME_LENGTH ||
    !Array.isArray(value.delayEvents) ||
    value.delayEvents.length > MAX_EVENTS_PER_SESSION ||
    value.delayEvents.length > remainingEventBudget
  ) {
    return null;
  }

  const originalStartAt =
    typeof value.originalStartAt === "string"
      ? toIsoString(value.originalStartAt)
      : null;
  const createdAt =
    typeof value.createdAt === "string" ? toIsoString(value.createdAt) : null;
  const updatedAt =
    typeof value.updatedAt === "string" ? toIsoString(value.updatedAt) : null;
  const archivedAt =
    value.archivedAt === null
      ? null
      : typeof value.archivedAt === "string"
        ? toIsoString(value.archivedAt)
        : null;

  if (
    originalStartAt === null ||
    createdAt === null ||
    updatedAt === null ||
    (value.archivedAt !== null && archivedAt === null)
  ) {
    return null;
  }

  const seenEventIds = new Set<string>();
  const delayEvents: DelayEvent[] = [];

  for (const candidate of value.delayEvents) {
    const event = sanitizeDelayEvent(candidate);

    if (event === null || seenEventIds.has(event.id)) {
      return null;
    }

    seenEventIds.add(event.id);
    delayEvents.push(event);
  }

  return {
    id: value.id,
    planName: normalizePlanName(value.planName),
    originalStartAt,
    createdAt,
    updatedAt,
    archivedAt,
    delayEvents,
  };
}

function sanitizeStoredCounterData(value: unknown): StoredCounterData | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.history) ||
    value.history.length > MAX_HISTORY_ENTRIES
  ) {
    return null;
  }

  let remainingEventBudget = MAX_TOTAL_EVENTS;
  const activeSession =
    value.activeSession === null
      ? null
      : sanitizeSession(value.activeSession, remainingEventBudget);

  if (value.activeSession !== null && activeSession === null) {
    return null;
  }

  if (activeSession !== null) {
    if (activeSession.archivedAt !== null) {
      return null;
    }

    remainingEventBudget -= activeSession.delayEvents.length;
  }

  const seenSessionIds = new Set<string>();
  if (activeSession !== null) {
    seenSessionIds.add(activeSession.id);
  }

  const history: CounterSession[] = [];

  for (const candidate of value.history) {
    const session = sanitizeSession(candidate, remainingEventBudget);

    if (
      session === null ||
      session.archivedAt === null ||
      seenSessionIds.has(session.id)
    ) {
      return null;
    }

    remainingEventBudget -= session.delayEvents.length;
    seenSessionIds.add(session.id);
    history.push(session);
  }

  return { version: 1, activeSession, history };
}

export function createEmptyStoredCounterData(): StoredCounterData {
  return {
    version: 1,
    activeSession: null,
    history: [],
  };
}

export function isStoredCounterData(value: unknown): value is StoredCounterData {
  return sanitizeStoredCounterData(value) !== null;
}

export function parseStoredCounterData(serialized: string | null): StoredCounterData {
  if (
    serialized === null ||
    serialized.length === 0 ||
    serialized.length > MAX_SERIALIZED_LENGTH
  ) {
    return createEmptyStoredCounterData();
  }

  try {
    const parsed: unknown = JSON.parse(serialized);
    return sanitizeStoredCounterData(parsed) ?? createEmptyStoredCounterData();
  } catch {
    return createEmptyStoredCounterData();
  }
}

export function serializeStoredCounterData(data: StoredCounterData): string {
  const safeData = sanitizeStoredCounterData(data);

  if (safeData === null) {
    throw new TypeError("Counter data is invalid and cannot be serialized.");
  }

  return JSON.stringify(safeData);
}

export function createCounterSession(
  input: CreateCounterSessionInput,
): CounterSession {
  const createdAt = requireIsoString(input.createdAt, "createdAt");

  return {
    id: requireSafeId(input.id, "id"),
    planName: normalizePlanName(input.planName),
    originalStartAt: requireIsoString(
      input.originalStartAt,
      "originalStartAt",
    ),
    createdAt,
    updatedAt: createdAt,
    archivedAt: null,
    delayEvents: [],
  };
}

export function postponeSession(
  session: CounterSession,
  input: PostponeSessionInput,
): CounterSession {
  if (session.archivedAt !== null) {
    throw new Error("An archived session cannot be postponed.");
  }

  const id = requireSafeId(input.id, "event id");
  if (session.delayEvents.some((event) => event.id === id)) {
    throw new Error(`A delay event with id "${id}" already exists.`);
  }

  const pressedAt = requireIsoString(input.pressedAt, "pressedAt");

  return {
    ...session,
    updatedAt: pressedAt,
    delayEvents: [
      ...session.delayEvents,
      {
        id,
        minutes: POSTPONEMENT_MINUTES,
        pressedAt,
        undoneAt: null,
      },
    ],
  };
}

export function undoPostponement(
  session: CounterSession,
  undoneAt: string,
): CounterSession {
  if (session.archivedAt !== null) {
    return session;
  }

  let indexToUndo = -1;
  for (let index = session.delayEvents.length - 1; index >= 0; index -= 1) {
    if (session.delayEvents[index].undoneAt === null) {
      indexToUndo = index;
      break;
    }
  }

  if (indexToUndo === -1) {
    return session;
  }

  const normalizedUndoneAt = requireIsoString(undoneAt, "undoneAt");

  return {
    ...session,
    updatedAt: normalizedUndoneAt,
    delayEvents: session.delayEvents.map((event, index) =>
      index === indexToUndo
        ? { ...event, undoneAt: normalizedUndoneAt }
        : event,
    ),
  };
}

export function archiveSession(
  session: CounterSession,
  archivedAt: string,
): CounterSession {
  if (session.archivedAt !== null) {
    return session;
  }

  const normalizedArchivedAt = requireIsoString(archivedAt, "archivedAt");

  return {
    ...session,
    updatedAt: normalizedArchivedAt,
    archivedAt: normalizedArchivedAt,
  };
}

export function resetStoredCounterData(
  data: StoredCounterData,
  resetAt: string,
): StoredCounterData {
  if (data.activeSession === null) {
    return data;
  }

  const archived = archiveSession(data.activeSession, resetAt);
  const history =
    archived.delayEvents.length > 0
      ? [...data.history, archived].slice(-MAX_HISTORY_ENTRIES)
      : data.history;

  return {
    version: 1,
    activeSession: null,
    history,
  };
}

export function getActiveDelayEvents(
  session: CounterSession,
): readonly DelayEvent[] {
  return session.delayEvents.filter((event) => event.undoneAt === null);
}

export function getPostponementCount(session: CounterSession): number {
  return session.delayEvents.reduce(
    (count, event) => count + (event.undoneAt === null ? 1 : 0),
    0,
  );
}

export function getTotalDelayMinutes(session: CounterSession): number {
  return session.delayEvents.reduce(
    (total, event) =>
      total + (event.undoneAt === null ? normalizeMinutes(event.minutes) : 0),
    0,
  );
}

export function addMinutesToIso(
  value: string | Date,
  minutes: number,
): string | null {
  const iso = toIsoString(value);

  if (iso === null || !Number.isFinite(minutes)) {
    return null;
  }

  return new Date(
    new Date(iso).getTime() + Math.trunc(minutes) * 60_000,
  ).toISOString();
}

export function getCurrentStartAt(session: CounterSession): string {
  return (
    addMinutesToIso(session.originalStartAt, getTotalDelayMinutes(session)) ??
    session.originalStartAt
  );
}

export function startAtTimeOnDate(
  time: string,
  date: string | Date,
): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  const dateIso = toIsoString(date);

  if (match === null || dateIso === null) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }

  const result = new Date(dateIso);
  result.setHours(hours, minutes, 0, 0);
  return result.toISOString();
}

export function formatTime(
  value: string | Date,
  options: { locale?: string; timeZone?: string } = {},
): string {
  const iso = toIsoString(value);
  if (iso === null) {
    return "--:--";
  }

  try {
    return new Intl.DateTimeFormat(options.locale ?? "ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      ...(options.timeZone ? { timeZone: options.timeZone } : {}),
    }).format(new Date(iso));
  } catch {
    return "--:--";
  }
}

export function formatDuration(totalMinutes: number): string {
  const normalized = normalizeMinutes(totalMinutes);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  if (hours === 0) {
    return `${minutes}分`;
  }

  if (minutes === 0) {
    return `${hours}時間`;
  }

  return `${hours}時間${minutes}分`;
}

export function getDelayStage(totalMinutes: number): DelayStage {
  const normalized = normalizeMinutes(totalMinutes);

  if (normalized >= COLLAPSE_MINUTES) {
    return "collapsed";
  }
  if (normalized >= 60) {
    return "abandon";
  }
  if (normalized >= 30) {
    return "warning";
  }
  if (normalized >= POSTPONEMENT_MINUTES) {
    return "margin";
  }
  return "ready";
}

export function getDelayMessage(totalMinutes: number): string {
  return DELAY_MESSAGES[getDelayStage(totalMinutes)];
}

export function getCollapsePercent(totalMinutes: number): number {
  const normalized = normalizeMinutes(totalMinutes);
  return Math.min(100, Math.round((normalized / COLLAPSE_MINUTES) * 100));
}

export function getDelayStatus(totalMinutes: number): DelayStatus {
  const stage = getDelayStage(totalMinutes);

  return {
    stage,
    message: DELAY_MESSAGES[stage],
    collapsePercent: getCollapsePercent(totalMinutes),
    isCollapsed: stage === "collapsed",
  };
}

export function getSessionSummary(
  session: CounterSession,
): CounterSessionSummary {
  const totalDelayMinutes = getTotalDelayMinutes(session);

  return {
    planName: session.planName,
    postponeCount: getPostponementCount(session),
    totalDelayMinutes,
    currentStartAt: getCurrentStartAt(session),
    status: getDelayStatus(totalDelayMinutes),
  };
}

function localDateKey(value: string | Date, timeZone?: string): string | null {
  const iso = toIsoString(value);
  if (iso === null) {
    return null;
  }

  const parsed = new Date(iso);
  if (!timeZone) {
    return `${parsed.getFullYear()}-${parsed.getMonth()}-${parsed.getDate()}`;
  }

  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone,
    }).format(parsed);
  } catch {
    return null;
  }
}

export function getTodayDelayMinutes(
  data: StoredCounterData,
  now: string | Date,
  timeZone?: string,
): number {
  const today = localDateKey(now, timeZone);
  if (today === null) {
    return 0;
  }

  const sessions = [
    ...(data.activeSession ? [data.activeSession] : []),
    ...data.history,
  ];
  const seenEvents = new Set<string>();

  return sessions.reduce((total, session) => {
    return session.delayEvents.reduce((sessionTotal, event) => {
      const eventKey = `${session.id}:${event.id}`;
      if (
        event.undoneAt !== null ||
        seenEvents.has(eventKey) ||
        localDateKey(event.pressedAt, timeZone) !== today
      ) {
        return sessionTotal;
      }

      seenEvents.add(eventKey);
      return sessionTotal + normalizeMinutes(event.minutes);
    }, total);
  }, 0);
}

export function createShareText(
  session: CounterSession,
  appUrl?: string,
): string {
  const summary = getSessionSummary(session);
  const planName = normalizePlanName(summary.planName) || "名もなき予定";
  const lines = [
    `「${planName}」を${formatDuration(summary.totalDelayMinutes)}先延ばししました。`,
    `「あと5分」は${summary.postponeCount}回。現在の開始予定は${formatTime(summary.currentStartAt)}です。`,
    summary.status.message,
    "#あと5分カウンター",
  ];
  const url = appUrl?.trim();

  if (url) {
    lines.push(url);
  }

  return lines.join("\n");
}
