import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Activity, Eye, Gauge, Mic, ShieldCheck, Sparkles, TrendingUp, Play } from "lucide-react";
import { useSessionStore } from "@/store";
import { MetricCard } from "@/components/common/metric-card";
import { ChartCard } from "@/components/common/chart-card";
import { TrendArea, TrendBar, TrendLine, CHART_COLORS } from "@/components/common/charts";
import { Button } from "@/components/ui/button";
import { avgMetrics, dailyTrend } from "@/lib/analytics";
import { SessionCard } from "@/components/common/session-card";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · PresentIQ" },
      { name: "description", content: "Track your speaking metrics, recent sessions, and AI feedback at a glance." },
      { property: "og:title", content: "Dashboard · PresentIQ" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const sessions = useSessionStore((s) => s.sessions);
  const recent = sessions.slice(0, 14);
  const avg = avgMetrics(recent);
  const trend30 = dailyTrend(sessions, 30);
  const improvement = (() => {
    const half = Math.floor(trend30.length / 2);
    const a = trend30.slice(0, half).filter((d) => d.score);
    const b = trend30.slice(half).filter((d) => d.score);
    const avgA = a.length ? a.reduce((s, d) => s + d.score, 0) / a.length : 0;
    const avgB = b.length ? b.reduce((s, d) => s + d.score, 0) / b.length : 0;
    return avgA ? Math.round(((avgB - avgA) / avgA) * 100) : 0;
  })();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Overview</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Welcome back, Alex</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here's how your last 30 days look.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="glass">
            <Link to="/analytics">View analytics</Link>
          </Button>
          <Button asChild variant="hero">
            <Link to="/recorder"><Play className="h-4 w-4" /> New session</Link>
          </Button>
        </div>
      </motion.header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Sessions" value={sessions.length} icon={Sparkles} gradient="primary" trend={12.4} />
        <MetricCard label="Eye contact" value={avg.eyeContact} suffix="%" icon={Eye} gradient="violet" trend={4.2} />
        <MetricCard label="Avg WPM" value={avg.wpm} icon={Gauge} gradient="indigo" trend={-1.8} />
        <MetricCard label="Posture" value={avg.postureScore} suffix="%" icon={ShieldCheck} gradient="cyan" trend={6.1} />
        <MetricCard label="Filler words" value={avg.fillerWords} icon={Mic} gradient="warning" trend={-18.7} />
        <MetricCard label="Improvement" value={improvement} suffix="%" icon={TrendingUp} gradient="success" trend={improvement} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Eye contact trend" description="Last 30 days · daily average">
          <TrendArea data={trend30} dataKey="eyeContact" color={CHART_COLORS.violet} />
        </ChartCard>
        <ChartCard title="Words per minute" description="Pace consistency">
          <TrendArea data={trend30} dataKey="wpm" color={CHART_COLORS.indigo} />
        </ChartCard>
        <ChartCard title="Filler words" description="Lower is better">
          <TrendBar data={trend30} dataKey="fillerWords" color={CHART_COLORS.warning} />
        </ChartCard>
        <ChartCard title="Posture score" description="Shoulder line & head stability">
          <TrendArea data={trend30} dataKey="postureScore" color={CHART_COLORS.success} />
        </ChartCard>
        <ChartCard title="Pitch variance" description="Vocal range across the session">
          <TrendArea data={trend30} dataKey="pitchVariance" color={CHART_COLORS.cyan} />
        </ChartCard>
        <ChartCard title="Volume consistency" description="Steady, audible delivery">
          <TrendLine
            data={trend30}
            series={[{ key: "volumeConsistency", label: "Volume", color: CHART_COLORS.primary }]}
          />
        </ChartCard>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent sessions</h2>
          <Link to="/sessions" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recent.slice(0, 6).map((s) => <SessionCard key={s.id} session={s} />)}
        </div>
      </section>
    </div>
  );
}
