export type SessionMode =
  | "interview"
  | "technical"
  | "presentation"
  | "elevator";

export interface SessionMetrics {
  eyeContact: number; // %
  wpm: number;
  fillerWords: number;
  pitchVariance: number; // 0-100
  volumeConsistency: number; // 0-100
  postureScore: number; // 0-100
  headStability: number; // 0-100
}

export interface TimelineEvent {
  start: string; // "00:00"
  end: string;
  label: string;
  kind: "positive" | "neutral" | "warning";
}

export interface Session {
  id: string;
  date: string; // ISO
  mode: SessionMode;
  duration: number; // seconds
  overallScore: number; // 0-100
  metrics: SessionMetrics;
  strengths: string[];
  improvements: string[];
  suggestions: string[];
  timeline: TimelineEvent[];
}

export interface User {
  name: string;
  email: string;
  avatarUrl?: string;
  joinedAt: string;
  badges: { id: string; label: string; icon: string }[];
}
