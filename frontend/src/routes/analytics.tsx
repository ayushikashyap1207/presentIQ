import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChartCard } from "@/components/common/chart-card";
import {
  TrendArea, TrendBar, TrendLine, MetricRadar, DonutChart, CHART_COLORS,
} from "@/components/common/charts";
import { useAnalyticsStore, useSessionStore } from "@/store";
import { avgMetrics, dailyTrend } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RANGES = [
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "90d", label: "90 days", days: 90 },
  { id: "custom", label: "Custom", days: 60 },
] as const;

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics · PresentIQ" },
      { name: "description", content: "Deep dive into weekly and monthly speaking trends with comparison charts." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const sessions = useSessionStore((s) => s.sessions);
  const { range, setRange } = useAnalyticsStore();
  const days = RANGES.find((r) => r.id === range)!.days;
  const trend = useMemo(() => dailyTrend(sessions, days), [sessions, days]);
  const avg = useMemo(() => avgMetrics(sessions.slice(0, days)), [sessions, days]);
  const radar = [
    { metric: "Eye", value: avg.eyeContact, full: 100 },
    { metric: "Pitch", value: avg.pitchVariance, full: 100 },
    { metric: "Volume", value: avg.volumeConsistency, full: 100 },
    { metric: "Posture", value: avg.postureScore, full: 100 },
    { metric: "Head", value: avg.headStability, full: 100 },
    { metric: "Fluency", value: Math.max(0, 100 - avg.fillerWords * 2), full: 100 },
  ];
  const modeCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.mode] = (acc[s.mode] ?? 0) + 1;
    return acc;
  }, {});
  const donut = [
    { name: "Interview", value: modeCounts.interview || 0, color: CHART_COLORS.primary },
    { name: "Technical", value: modeCounts.technical || 0, color: CHART_COLORS.indigo },
    { name: "Presentation", value: modeCounts.presentation || 0, color: CHART_COLORS.violet },
    { name: "Elevator", value: modeCounts.elevator || 0, color: CHART_COLORS.cyan },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Analytics</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Progress over time</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track how every signal trends and where to focus next.</p>
        </div>
        <div className="glass flex rounded-xl p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                range === r.id ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <ChartCard title="Overall score trend" description="Composite weighted score" className="lg:col-span-2">
          <TrendArea data={trend} dataKey="score" color={CHART_COLORS.primary} height={260} />
        </ChartCard>
        <ChartCard title="Signal balance" description="Last period averages">
          <MetricRadar data={radar} />
        </ChartCard>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Eye contact vs Posture">
          <TrendLine
            data={trend}
            series={[
              { key: "eyeContact", label: "Eye contact", color: CHART_COLORS.violet },
              { key: "postureScore", label: "Posture", color: CHART_COLORS.success },
            ]}
          />
        </ChartCard>
        <ChartCard title="Pace consistency">
          <TrendLine
            data={trend}
            series={[
              { key: "wpm", label: "WPM", color: CHART_COLORS.indigo },
              { key: "volumeConsistency", label: "Volume", color: CHART_COLORS.cyan },
            ]}
          />
        </ChartCard>
        <ChartCard title="Filler words per day"><TrendBar data={trend} dataKey="fillerWords" color={CHART_COLORS.warning} /></ChartCard>
        <ChartCard title="Mode distribution"><DonutChart data={donut} /></ChartCard>
      </section>

      <section className="mt-4">
        <ChartCard title="Heatmap" description="Sessions per day in the period">
          <Heatmap trend={trend} />
        </ChartCard>
      </section>
    </div>
  );
}

function Heatmap({ trend }: { trend: { name: string; score: number }[] }) {
  const max = Math.max(1, ...trend.map((d) => d.score));
  return (
    <div className="flex flex-wrap gap-1.5">
      {trend.map((d, i) => {
        const alpha = d.score / max;
        return (
          <div
            key={i}
            title={`${d.name}: ${d.score}`}
            className="h-6 w-6 rounded-md border"
            style={{ background: `color-mix(in oklab, var(--primary) ${Math.round(alpha * 80)}%, transparent)` }}
          />
        );
      })}
    </div>
  );
}
