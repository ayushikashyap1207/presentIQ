import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Download, Sparkles, ThumbsUp, AlertTriangle, Lightbulb, BookOpen, Send, Loader2 } from "lucide-react";
import { useSessionStore } from "@/store";
import { MetricCard } from "@/components/common/metric-card";
import { ChartCard } from "@/components/common/chart-card";
import { TrendArea, MetricRadar, CHART_COLORS } from "@/components/common/charts";
import { Timeline } from "@/components/common/timeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtDuration } from "@/lib/format";
import { MODE_LABEL } from "@/constants";
import { useState } from "react";

// ── Source name formatter ────────────────────────────────────────────────────
const SOURCE_LABELS: Record<string, string> = {
  filler_words_research: "Filler Words Research",
  speech_coaching: "Speech Coaching",
  posture_eye_contact: "Posture & Eye Contact",
  body_language: "Body Language",
  wpm_norms: "Speech Rate Norms",
};
function formatSourceName(raw: string): string {
  return SOURCE_LABELS[raw] ?? raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── /api/v1/ask helper ───────────────────────────────────────────────────────
const API_BASE_URL = "http://localhost:8000";
async function askCoach(
  question: string,
  metrics: Record<string, number>,
): Promise<{ answer: string; sources: string[]; chunks_used: number }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, metrics }),
  });
  if (!res.ok) throw new Error("Coach unavailable");
  return res.json();
}

export const Route = createFileRoute("/sessions/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Session ${params.id} · PresentIQ` },
      { name: "description", content: "Detailed breakdown of your practice session with charts, timeline, and coaching suggestions." },
    ],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Session not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">It may have been deleted or never existed.</p>
      <Button asChild className="mt-6"><Link to="/sessions">Back to sessions</Link></Button>
    </div>
  ),
  component: SessionDetail,
});

function SessionDetail() {
  const { id } = Route.useParams();
  const session = useSessionStore((s) => s.sessions.find((x) => x.id === id));

  // Ask-the-Coach state — hooks must be called before any conditional returns
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [coachAnswer, setCoachAnswer] = useState<string | null>(null);
  const [answerSources, setAnswerSources] = useState<string[]>([]);
  const [askError, setAskError] = useState<string | null>(null);

  // Throw notFound AFTER hooks (React rules) — TanStack Router catches this
  if (!session) throw notFound();

  // Snapshot into a non-null const so async closures have a narrowed type
  const s = session;

  // Sources returned by the coaching pipeline (populated when backend is connected)
  const knowledgeSources: string[] = s.sources ?? [];

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setCoachAnswer(null);
    setAnswerSources([]);
    setAskError(null);
    try {
      const metricsPayload: Record<string, number> = {
        eye_contact_percentage: s.metrics.eyeContact,
        average_wpm: s.metrics.wpm,
        filler_words_count: s.metrics.fillerWords,
        pitch_variance: s.metrics.pitchVariance,
        volume_consistency: s.metrics.volumeConsistency,
        posture_score: s.metrics.postureScore,
        head_stability_score: s.metrics.headStability,
      };
      const result = await askCoach(question, metricsPayload);
      setCoachAnswer(result.answer);
      setAnswerSources(result.sources);
    } catch {
      setAskError("The coaching service is currently unavailable. Please try again later.");
    } finally {
      setAsking(false);
    }
  }

  const m = session.metrics;
  const radar = [
    { metric: "Eye", value: m.eyeContact, full: 100 },
    { metric: "Pitch", value: m.pitchVariance, full: 100 },
    { metric: "Volume", value: m.volumeConsistency, full: 100 },
    { metric: "Posture", value: m.postureScore, full: 100 },
    { metric: "Head", value: m.headStability, full: 100 },
    { metric: "Fluency", value: 100 - m.fillerWords * 2, full: 100 },
  ];

  // synthesize per-second-ish data
  const minutes = Math.max(4, Math.floor(session.duration / 30));
  const minuteData = Array.from({ length: minutes }, (_, i) => ({
    name: `${i + 1}m`,
    eyeContact: clampLine(m.eyeContact, i),
    wpm: clampLine(m.wpm, i, 20),
    fillerWords: Math.max(0, Math.round((m.fillerWords / minutes) * (1 + Math.sin(i)))),
    pitchVariance: clampLine(m.pitchVariance, i),
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/sessions" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to sessions
      </Link>
      <header className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{MODE_LABEL[session.mode]}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Session report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {fmtDate(session.date)} · {fmtDuration(session.duration)} · Score {session.overallScore}/100
          </p>
        </div>
        <Button variant="hero"><Download className="h-4 w-4" /> Export PDF</Button>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Overall" value={session.overallScore} suffix="/100" icon={Sparkles} gradient="primary" />
        <MetricCard label="Eye contact" value={m.eyeContact} suffix="%" gradient="violet" />
        <MetricCard label="Avg WPM" value={m.wpm} gradient="indigo" />
        <MetricCard label="Filler words" value={m.fillerWords} gradient="warning" />
      </section>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="glass">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-3">
          <FeedbackList title="Strengths" icon={ThumbsUp} kind="positive" items={session.strengths} />
          <FeedbackList title="Areas to improve" icon={AlertTriangle} kind="warning" items={session.improvements} />
          <FeedbackList title="Suggestions" icon={Lightbulb} kind="primary" items={session.suggestions} />
          <ChartCard title="Metric balance" description="Strength across signal categories" className="lg:col-span-2">
            <MetricRadar data={radar} />
          </ChartCard>
          <ChartCard title="Quick exercises" description="3 drills tailored to today's session">
            <ul className="space-y-3 text-sm">
              {[
                "Read 60s passage aloud, replace fillers with pauses.",
                "Mirror practice: hold eye contact for full answer.",
                "Pitch ladder: alternate high/low emphasis on keywords.",
              ].map((d, i) => (
                <li key={i} className="flex gap-3 rounded-lg bg-accent/40 p-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md [background-image:var(--gradient-primary)] text-xs font-semibold text-primary-foreground">{i + 1}</span>
                  <p>{d}</p>
                </li>
              ))}
            </ul>
          </ChartCard>

          {/* ── Knowledge Sources Panel ─────────────────────────────── */}
          <div className="lg:col-span-3">
            <ChartCard
              title={
                <span className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg [background-image:var(--gradient-primary)] text-primary-foreground">
                    <BookOpen className="h-3.5 w-3.5" />
                  </span>
                  Knowledge Sources
                </span>
              }
              description="Research used to generate your coaching feedback"
            >
              {knowledgeSources.length > 0 ? (
                <details className="group" open>
                  <summary className="flex cursor-pointer select-none list-none items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent/60 text-xs font-semibold tabular-nums">
                      {knowledgeSources.length}
                    </span>
                    Knowledge sources used
                    <span className="ml-auto text-xs opacity-60 group-open:hidden">Show</span>
                    <span className="ml-auto text-xs opacity-60 [display:none] group-open:inline">Hide</span>
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {knowledgeSources.map((src) => (
                      <li
                        key={src}
                        className="flex items-center gap-2 rounded-lg bg-accent/40 px-3 py-2 text-sm"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full [background-image:var(--gradient-primary)]" />
                        {formatSourceName(src)}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <details className="group">
                  <summary className="flex cursor-pointer select-none list-none items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent/60 text-xs font-semibold">5</span>
                    Knowledge sources used (demo)
                    <span className="ml-auto text-xs opacity-60 group-open:hidden">Show</span>
                    <span className="ml-auto text-xs opacity-60 [display:none] group-open:inline">Hide</span>
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {Object.values(SOURCE_LABELS).map((label) => (
                      <li
                        key={label}
                        className="flex items-center gap-2 rounded-lg bg-accent/40 px-3 py-2 text-sm"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full [background-image:var(--gradient-primary)]" />
                        {label}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </ChartCard>
          </div>

          {/* ── Ask the Coach ───────────────────────────────────────── */}
          <div className="lg:col-span-3">
            <ChartCard
              title="Ask the Coach"
              description="Get evidence-based answers from the PresentIQ knowledge base"
            >
              <form onSubmit={handleAsk} className="flex gap-2">
                <input
                  id={`ask-coach-input-${id}`}
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a follow-up question about your presentation…"
                  className="flex-1 rounded-lg border border-border bg-accent/30 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                  disabled={asking}
                />
                <Button
                  id={`ask-coach-submit-${id}`}
                  type="submit"
                  variant="hero"
                  disabled={asking || !question.trim()}
                  className="shrink-0"
                >
                  {asking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {asking ? "Asking…" : "Ask"}
                </Button>
              </form>

              {/* Answer box */}
              {(coachAnswer || askError) && (
                <details open className="mt-4 group">
                  <summary className="flex cursor-pointer select-none list-none items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                    Coach response
                    <span className="ml-auto text-xs opacity-60 group-open:hidden">Expand</span>
                    <span className="ml-auto text-xs opacity-60 [display:none] group-open:inline">Collapse</span>
                  </summary>
                  <div className="mt-3 rounded-xl border border-border/60 bg-accent/20 p-4 text-sm leading-relaxed">
                    {askError ? (
                      <p className="text-destructive">{askError}</p>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap">{coachAnswer}</p>
                        {answerSources.length > 0 && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Sources: {answerSources.map(formatSourceName).join(" · ")}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </details>
              )}
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="charts" className="mt-4 grid gap-4 lg:grid-cols-2">
          <ChartCard title="Eye contact over time"><TrendArea data={minuteData} dataKey="eyeContact" color={CHART_COLORS.violet} /></ChartCard>
          <ChartCard title="Words per minute"><TrendArea data={minuteData} dataKey="wpm" color={CHART_COLORS.indigo} /></ChartCard>
          <ChartCard title="Filler words per minute"><TrendArea data={minuteData} dataKey="fillerWords" color={CHART_COLORS.warning} /></ChartCard>
          <ChartCard title="Pitch variance"><TrendArea data={minuteData} dataKey="pitchVariance" color={CHART_COLORS.cyan} /></ChartCard>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <ChartCard title="Timeline replay" description="Click a moment to jump in playback">
            <Timeline events={session.timeline} onSeek={() => {}} />
          </ChartCard>
        </TabsContent>

        <TabsContent value="metrics" className="mt-4">
          <ChartCard title="Metrics table">
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Metric</th>
                    <th className="px-4 py-2 text-right">Value</th>
                    <th className="px-4 py-2 text-right">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Eye contact", `${m.eyeContact}%`, "85%"],
                    ["Words per minute", `${m.wpm}`, "130–160"],
                    ["Filler words", `${m.fillerWords}`, "< 5"],
                    ["Pitch variance", `${m.pitchVariance}%`, "70%"],
                    ["Volume consistency", `${m.volumeConsistency}%`, "85%"],
                    ["Posture score", `${m.postureScore}%`, "90%"],
                    ["Head stability", `${m.headStability}%`, "85%"],
                  ].map(([k, v, t]) => (
                    <tr key={k as string} className="border-t">
                      <td className="px-4 py-2 font-medium">{k}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{v}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{t}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function clampLine(base: number, i: number, span = 12) {
  return Math.max(0, Math.min(200, Math.round(base + Math.sin(i / 1.5) * span)));
}

function FeedbackList({
  title, icon: Icon, kind, items,
}: { title: string; icon: any; kind: "positive" | "warning" | "primary"; items: string[] }) {
  const tone =
    kind === "positive" ? "[background-image:var(--gradient-success)]"
    : kind === "warning" ? "[background-image:var(--gradient-warning)]"
    : "[background-image:var(--gradient-primary)]";
  return (
    <ChartCard
      title={
        <span className="flex items-center gap-2">
          <span className={`grid h-7 w-7 place-items-center rounded-lg text-primary-foreground ${tone}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          {title}
        </span>
      }
    >
      <ul className="space-y-2 text-sm">
        {items.map((t, i) => (
          <li key={i} className="rounded-lg bg-accent/40 px-3 py-2">{t}</li>
        ))}
      </ul>
    </ChartCard>
  );
}
