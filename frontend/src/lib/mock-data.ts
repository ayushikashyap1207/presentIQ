import type { Session, SessionMode, TimelineEvent } from "@/types";

const MODES: SessionMode[] = ["interview", "technical", "presentation", "elevator"];

function seeded(n: number) {
  // tiny deterministic pseudo-random
  let s = n * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function makeTimeline(rand: () => number): TimelineEvent[] {
  const samples = [
    { label: "Strong opening, confident tone", kind: "positive" as const },
    { label: "Good pace maintained", kind: "positive" as const },
    { label: "Speech speed increased", kind: "warning" as const },
    { label: "Long pause detected", kind: "warning" as const },
    { label: "Excellent eye contact", kind: "positive" as const },
    { label: "Filler words cluster", kind: "warning" as const },
    { label: "Posture stabilized", kind: "neutral" as const },
    { label: "Closing summary delivered", kind: "positive" as const },
  ];
  const events: TimelineEvent[] = [];
  let t = 0;
  for (let i = 0; i < 6; i++) {
    const dur = 30 + Math.floor(rand() * 80);
    const start = t;
    const end = t + dur;
    const fmt = (s: number) =>
      `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    const pick = samples[Math.floor(rand() * samples.length)];
    events.push({ start: fmt(start), end: fmt(end), label: pick.label, kind: pick.kind });
    t = end;
  }
  return events;
}

export function generateSessions(count = 50): Session[] {
  const today = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const rand = seeded(i + 1);
    const mode = MODES[Math.floor(rand() * MODES.length)];
    const date = new Date(today - i * 86400000 * (0.6 + rand() * 1.4)).toISOString();
    const progress = 1 - i / count; // newer sessions trend better
    const trend = 0.55 + progress * 0.35;
    const metrics = {
      eyeContact: clamp(trend * 100 + (rand() - 0.5) * 18),
      wpm: clamp(120 + trend * 30 + (rand() - 0.5) * 25, 80, 200),
      fillerWords: clamp(28 - trend * 20 + (rand() - 0.5) * 8, 0, 60),
      pitchVariance: clamp(trend * 100 + (rand() - 0.5) * 20),
      volumeConsistency: clamp(trend * 100 + (rand() - 0.5) * 14),
      postureScore: clamp(trend * 100 + (rand() - 0.5) * 16),
      headStability: clamp(trend * 100 + (rand() - 0.5) * 14),
    };
    const overall = clamp(
      (metrics.eyeContact +
        metrics.pitchVariance +
        metrics.volumeConsistency +
        metrics.postureScore +
        metrics.headStability +
        (100 - metrics.fillerWords * 2)) /
        6,
    );
    return {
      id: `sess_${String(i + 1).padStart(4, "0")}`,
      date,
      mode,
      duration: 180 + Math.floor(rand() * 900),
      overallScore: overall,
      metrics,
      strengths: [
        "Steady cadence throughout the session",
        "Confident eye contact during key moments",
        "Clear articulation of technical concepts",
      ],
      improvements: [
        "Reduce filler words at transitions",
        "Vary pitch on closing statements",
        "Hold posture during long answers",
      ],
      suggestions: [
        "Practice the STAR framework for behavioral answers",
        "Record a 60s elevator pitch daily",
        "Use intentional 2-second pauses instead of fillers",
      ],
      timeline: makeTimeline(rand),
    };
  });
}

export const MOCK_SESSIONS = generateSessions(50);

export const MOCK_USER = {
  name: "Alex Morgan",
  email: "alex@presentiq.app",
  joinedAt: new Date(Date.now() - 86400000 * 120).toISOString(),
  badges: [
    { id: "streak7", label: "7-Day Streak", icon: "Flame" },
    { id: "filler", label: "Filler Slayer", icon: "Zap" },
    { id: "eye", label: "Eye Contact Pro", icon: "Eye" },
    { id: "consistency", label: "Consistent Voice", icon: "Mic" },
  ],
};
