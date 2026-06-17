import type { Session } from "@/types";

export function dailyTrend(sessions: Session[], days: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: { name: string; date: number; values: number[]; metrics: any[] }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    out.push({
      name: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      date: d.getTime(),
      values: [],
      metrics: [],
    });
  }
  for (const s of sessions) {
    const d = new Date(s.date);
    d.setHours(0, 0, 0, 0);
    const bucket = out.find((b) => b.date === d.getTime());
    if (bucket) {
      bucket.values.push(s.overallScore);
      bucket.metrics.push(s.metrics);
    }
  }
  return out.map((b) => {
    const avg = (k: keyof Session["metrics"]) =>
      b.metrics.length
        ? Math.round(b.metrics.reduce((a, m) => a + m[k], 0) / b.metrics.length)
        : 0;
    return {
      name: b.name,
      score: b.values.length ? Math.round(b.values.reduce((a, v) => a + v, 0) / b.values.length) : 0,
      eyeContact: avg("eyeContact"),
      wpm: avg("wpm"),
      fillerWords: avg("fillerWords"),
      pitchVariance: avg("pitchVariance"),
      volumeConsistency: avg("volumeConsistency"),
      postureScore: avg("postureScore"),
    };
  });
}

export function avgMetrics(sessions: Session[]) {
  if (!sessions.length) {
    return {
      eyeContact: 0, wpm: 0, fillerWords: 0, pitchVariance: 0,
      volumeConsistency: 0, postureScore: 0, headStability: 0, overall: 0,
    };
  }
  const k = (key: keyof Session["metrics"]) =>
    Math.round(sessions.reduce((a, s) => a + s.metrics[key], 0) / sessions.length);
  return {
    eyeContact: k("eyeContact"),
    wpm: k("wpm"),
    fillerWords: k("fillerWords"),
    pitchVariance: k("pitchVariance"),
    volumeConsistency: k("volumeConsistency"),
    postureScore: k("postureScore"),
    headStability: k("headStability"),
    overall: Math.round(sessions.reduce((a, s) => a + s.overallScore, 0) / sessions.length),
  };
}
