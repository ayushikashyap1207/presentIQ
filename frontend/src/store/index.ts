import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Session, SessionMetrics, SessionMode } from "@/types";
import { MOCK_SESSIONS, MOCK_USER } from "@/lib/mock-data";
import { checkBackendHealth, getSessions } from "../lib/api";

// THEME STORE
interface ThemeState {
  theme: "dark" | "light";
  toggle: () => void;
}
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      toggle: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
    }),
    { name: "presentiq.theme" },
  ),
);

// USER STORE
interface UserState {
  user: typeof MOCK_USER;
  setName: (n: string) => void;
}
export const useUserStore = create<UserState>((set) => ({
  user: MOCK_USER,
  setName: (n) => set((s) => ({ user: { ...s.user, name: n } })),
}));

// SESSION STORE
interface SessionState {
  sessions: Session[];
  backendActive: boolean;
  initialize: () => Promise<void>;
  remove: (id: string) => void;
  add: (s: Session) => void;
}
export const useSessionStore = create<SessionState>((set) => ({
  sessions: MOCK_SESSIONS,
  backendActive: false,
  initialize: async () => {
    const active = await checkBackendHealth();
    set({ backendActive: active });
    if (active) {
      try {
        const fetched = await getSessions();
        if (fetched.length > 0) {
          set({ sessions: fetched });
        }
      } catch (e) {
        console.error("Failed to load sessions from backend:", e);
      }
    }
  },
  remove: (id) => set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),
  add: (s) => set((st) => ({ sessions: [s, ...st.sessions] })),
}));

// RECORDING STORE
type RecordingStatus = "idle" | "recording" | "paused" | "stopped";
interface RecordingState {
  status: RecordingStatus;
  mode: SessionMode;
  elapsed: number; // seconds
  setMode: (m: SessionMode) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  tick: () => void;
}
export const useRecordingStore = create<RecordingState>((set) => ({
  status: "idle",
  mode: "interview",
  elapsed: 0,
  setMode: (m) => set({ mode: m }),
  start: () => set({ status: "recording", elapsed: 0 }),
  pause: () => set({ status: "paused" }),
  resume: () => set({ status: "recording" }),
  stop: () => set({ status: "stopped" }),
  reset: () => set({ status: "idle", elapsed: 0 }),
  tick: () => set((s) => (s.status === "recording" ? { elapsed: s.elapsed + 1 } : s)),
}));

// LIVE METRICS STORE
interface MetricsState {
  metrics: SessionMetrics;
  randomize: () => void;
}
export const useMetricsStore = create<MetricsState>((set) => ({
  metrics: {
    eyeContact: 72,
    wpm: 138,
    fillerWords: 6,
    pitchVariance: 64,
    volumeConsistency: 78,
    postureScore: 81,
    headStability: 74,
  },
  randomize: () =>
    set((s) => ({
      metrics: {
        eyeContact: jitter(s.metrics.eyeContact, 0, 100),
        wpm: jitter(s.metrics.wpm, 90, 190, 6),
        fillerWords: Math.max(0, jitter(s.metrics.fillerWords, 0, 30, 1)),
        pitchVariance: jitter(s.metrics.pitchVariance, 30, 100),
        volumeConsistency: jitter(s.metrics.volumeConsistency, 40, 100),
        postureScore: jitter(s.metrics.postureScore, 40, 100),
        headStability: jitter(s.metrics.headStability, 40, 100),
      },
    })),
}));
function jitter(v: number, lo: number, hi: number, step = 3) {
  const n = v + (Math.random() - 0.5) * step * 2;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

// ANALYTICS STORE
interface AnalyticsState {
  range: "7d" | "30d" | "90d" | "custom";
  setRange: (r: AnalyticsState["range"]) => void;
}
export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  range: "30d",
  setRange: (r) => set({ range: r }),
}));
