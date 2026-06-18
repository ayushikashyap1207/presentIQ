import type { Session, SessionMetrics, TimelineEvent } from "@/types";

const API_BASE_URL = "http://localhost:8000";

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/session`, { method: "GET" });
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

export function mapBackendSessionToFrontend(s: any): Session {
  const m = s.metrics || {};
  const metrics: SessionMetrics = {
    eyeContact: Math.round(m.eye_contact_percentage ?? 80),
    wpm: Math.round(m.average_wpm ?? 130),
    fillerWords: m.filler_words_count ?? 0,
    pitchVariance: Math.round(m.pitch_variance ?? 60),
    volumeConsistency: Math.round(m.volume_consistency ?? 80),
    postureScore: Math.round(m.posture_score ?? 85),
    headStability: Math.round(m.head_stability_score ?? 90),
  };

  const strengths = s.feedback?.strengths ?? ["Confident speaking voice", "Clear articulation"];
  const improvements = s.feedback?.areas_to_improve ?? ["Reduce conversational filler words"];
  const suggestions = s.feedback?.suggestions ?? ["Practice transitional phrasing"];

  const fmtTime = (secs: number) => {
    const min = Math.floor(secs / 60);
    const sec = Math.floor(secs % 60);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const timeline: TimelineEvent[] = (s.timeline_items || []).map((t: any) => {
    let kind: "positive" | "neutral" | "warning" = "neutral";
    if (t.category === "filler" || t.category === "pause") {
      kind = "warning";
    } else if (t.category === "pace" && t.observation.toLowerCase().includes("quick")) {
      kind = "warning";
    } else if (t.category === "pitch") {
      kind = "positive";
    }
    return {
      start: fmtTime(t.start_seconds),
      end: fmtTime(t.end_seconds),
      label: t.observation,
      kind,
    };
  });

  if (timeline.length === 0) {
    timeline.push({ start: "00:00", end: fmtTime(s.duration_seconds || 10), label: "Steady vocal delivery", kind: "positive" });
  }

  const overallScore = Math.round(
    (metrics.eyeContact +
      metrics.pitchVariance +
      metrics.volumeConsistency +
      metrics.postureScore +
      metrics.headStability +
      Math.max(0, 100 - metrics.fillerWords * 2)) /
      6
  );

  return {
    id: s.id,
    date: s.created_at,
    mode: s.mode || "interview",
    duration: s.duration_seconds || 0,
    overallScore: overallScore || 75,
    metrics,
    strengths,
    improvements,
    suggestions,
    timeline,
  };
}

export async function createSession(title: string, mode: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, mode }),
  });
  if (!response.ok) throw new Error("Failed to create session");
  return response.json();
}

export async function uploadAudio(sessionId: string, audioBlob: Blob): Promise<any> {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.wav");

  const response = await fetch(`${API_BASE_URL}/session/${sessionId}/upload-audio`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error("Failed to upload audio");
  return response.json();
}

export async function transcribeSession(sessionId: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/session/${sessionId}/transcribe`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to transcribe session");
  return response.json();
}

export async function analyzeMetrics(sessionId: string, visualMetrics: any): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/session/${sessionId}/analyze-metrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(visualMetrics),
  });
  if (!response.ok) throw new Error("Failed to analyze metrics");
  return response.json();
}

export async function generateFeedback(sessionId: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/session/${sessionId}/generate-feedback`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to generate feedback");
  return response.json();
}

export async function getSessions(): Promise<Session[]> {
  const response = await fetch(`${API_BASE_URL}/session`);
  if (!response.ok) throw new Error("Failed to get sessions");
  const data = await response.json();
  return data.map(mapBackendSessionToFrontend);
}

export async function getAnalytics(): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/analytics`);
  if (!response.ok) throw new Error("Failed to get analytics");
  return response.json();
}
