import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Download, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/common/chart-card";
import { TrendArea, CHART_COLORS } from "@/components/common/charts";
import { useSessionStore } from "@/store";
import { dailyTrend, avgMetrics } from "@/lib/analytics";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports · PresentIQ" },
      { name: "description", content: "Weekly and monthly speaking reports with strengths, weaknesses, and recommended drills." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const sessions = useSessionStore((s) => s.sessions);
  const week = dailyTrend(sessions, 7);
  const month = dailyTrend(sessions, 30);
  const w = avgMetrics(sessions.slice(0, 7));
  const m = avgMetrics(sessions.slice(0, 30));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reports</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Periodic reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Auto-generated summaries you can share or export.</p>
        </div>
      </header>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <ReportCard
          title="This week"
          period="Last 7 days"
          trend={week}
          dataKey="score"
          improvement={12.4}
          strengths={["Steady WPM at 142", "Eye contact above 80% on 5 of 7 days"]}
          weaknesses={["Pitch variance dipped on Mon & Wed", "Filler words spiked in technical mode"]}
          recommendations={["Run 10 min daily pitch ladder drill", "Avoid coffee 30m before technical sessions"]}
          score={w.overall}
        />
        <ReportCard
          title="This month"
          period="Last 30 days"
          trend={month}
          dataKey="score"
          improvement={28.1}
          strengths={["Posture score steady around 85%", "Volume consistency improved 14%"]}
          weaknesses={["Filler words still high in interview mode", "Long sessions show late-stage fatigue"]}
          recommendations={["Add 2 mock interviews per week", "Cap sessions at 30 minutes initially"]}
          score={m.overall}
        />
      </section>
    </div>
  );
}

function ReportCard({
  title, period, trend, dataKey, improvement, strengths, weaknesses, recommendations, score,
}: {
  title: string; period: string; trend: any[]; dataKey: string;
  improvement: number; strengths: string[]; weaknesses: string[]; recommendations: string[]; score: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="rounded-2xl border bg-card/60 p-5 shadow-card backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{period}</p>
          <h3 className="mt-1 text-xl font-semibold">{title}</h3>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tabular-nums">{score}<span className="text-xs text-muted-foreground">/100</span></p>
          <p className={`mt-0.5 inline-flex items-center gap-1 text-xs ${improvement >= 0 ? "text-[color:var(--success)]" : "text-destructive"}`}>
            {improvement >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(improvement)}%
          </p>
        </div>
      </div>
      <div className="mt-4">
        <TrendArea data={trend} dataKey={dataKey} color={CHART_COLORS.primary} height={140} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Block title="Strengths" items={strengths} tone="success" />
        <Block title="Weaknesses" items={weaknesses} tone="warning" />
        <Block title="Recommendations" items={recommendations} tone="primary" />
      </div>
      <div className="mt-5 flex justify-end">
        <Button variant="hero"><Download className="h-4 w-4" /> Download PDF</Button>
      </div>
    </motion.div>
  );
}

function Block({ title, items, tone }: { title: string; items: string[]; tone: "success" | "warning" | "primary" }) {
  const dot = tone === "success" ? "bg-[color:var(--success)]" : tone === "warning" ? "bg-[color:var(--warning)]" : "bg-primary";
  return (
    <div className="rounded-xl border bg-background/40 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {title}
      </p>
      <ul className="space-y-1.5 text-xs">
        {items.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}
