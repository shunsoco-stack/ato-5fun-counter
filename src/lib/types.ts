export type DelayStage =
  | "ready"
  | "margin"
  | "warning"
  | "abandon"
  | "collapsed";

export interface DelayEvent {
  id: string;
  minutes: number;
  pressedAt: string;
  undoneAt: string | null;
}

export interface CounterSession {
  id: string;
  planName: string;
  originalStartAt: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  delayEvents: DelayEvent[];
}

export interface StoredCounterData {
  version: 1;
  activeSession: CounterSession | null;
  history: CounterSession[];
}

export interface CreateCounterSessionInput {
  id: string;
  planName: string;
  originalStartAt: string;
  createdAt: string;
}

export interface PostponeSessionInput {
  id: string;
  pressedAt: string;
}

export interface DelayStatus {
  stage: DelayStage;
  message: string;
  collapsePercent: number;
  isCollapsed: boolean;
}

export interface CounterSessionSummary {
  planName: string;
  postponeCount: number;
  totalDelayMinutes: number;
  currentStartAt: string;
  status: DelayStatus;
}
