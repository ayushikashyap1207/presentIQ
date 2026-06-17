import { createFileRoute } from "@tanstack/react-router";
import { Eye, Flame, Mic, Zap, Sparkles, Clock, Calendar } from "lucide-react";
import { useSessionStore, useUserStore } from "@/store";
import { ChartCard } from "@/components/common/chart-card";
import { MetricCard } from "@/components/common/metric-card";
import { avgMetrics } from "@/lib/analytics";
import { fmtDate } from "@/lib/format";

const ICONS: Record<string, any> = { Flame, Zap, Eye, Mic };

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile · PresentIQ" },
      { name: "description", content: "Your speaking journey: badges, achievements, and lifetime stats." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const user = useUserStore((s) => s.user);
  const sessions = useSessionStore((s) => s.sessions);
  const avg = avgMetrics(sessions);
  const totalSeconds = sessions.reduce((s, x) => s + x.duration, 0);
  const hours = +(totalSeconds / 3600).toFixed(1);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border bg-card/60 p-6 shadow-card backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <div className="grid h-20 w-20 place-items-center rounded-2xl [background-image:var(--gradient-violet)] text-2xl font-semibold text-primary-foreground shadow-glow">
            {user.name.split(" ").map((n) => n[0]).join("")}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" /> Joined {fmtDate(user.joinedAt)}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Sessions" value={sessions.length} icon={Sparkles} gradient="primary" />
        <MetricCard label="Hours" value={hours} decimals={1} icon={Clock} gradient="indigo" />
        <MetricCard label="Avg eye contact" value={avg.eyeContact} suffix="%" icon={Eye} gradient="violet" />
        <MetricCard label="Avg WPM" value={avg.wpm} icon={Mic} gradient="cyan" />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Badges">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {user.badges.map((b) => {
              const I = ICONS[b.icon] ?? Sparkles;
              return (
                <div key={b.id} className="grid place-items-center rounded-2xl border bg-background/40 p-4 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl [background-image:var(--gradient-primary)] text-primary-foreground shadow-glow">
                    <I className="h-5 w-5" />
                  </div>
                  <p className="mt-2 text-xs font-medium">{b.label}</p>
                </div>
              );
            })}
          </div>
        </ChartCard>
        <ChartCard title="Achievements">
          <ul className="space-y-2 text-sm">
            {[
              "Recorded 25+ sessions",
              "Reduced fillers by 40%",
              "Maintained 80%+ eye contact for 7 days",
              "Completed every mode at least once",
            ].map((a) => (
              <li key={a} className="rounded-lg bg-accent/40 px-3 py-2">✓ {a}</li>
            ))}
          </ul>
        </ChartCard>
      </section>
    </div>
  );
}
