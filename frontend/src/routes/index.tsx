import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Sparkles, Eye, Mic, Gauge, ShieldCheck, BarChart3, ArrowRight,
  Play, Activity, Brain, Lock, Zap, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PresentIQ — AI Interview & Presentation Coach" },
      { name: "description", content: "Improve your interview and presentation skills with AI. Privacy-first feedback on eye contact, pace, posture, fillers, and pitch." },
      { property: "og:title", content: "PresentIQ — AI Interview & Presentation Coach" },
      { property: "og:description", content: "Privacy-first AI feedback on every speaking signal that matters." },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Eye, title: "Eye Contact Tracking", desc: "Measure gaze direction frame-by-frame to build steady, confident presence." },
  { icon: Mic, title: "Speech Analytics", desc: "Detect WPM, filler words, pitch variance, and volume in real time." },
  { icon: Activity, title: "Posture & Stability", desc: "Pose estimation tracks shoulder line, head stability, and movement." },
  { icon: Brain, title: "Mode-Aware Feedback", desc: "Calibrated for interviews, technicals, presentations, and pitches." },
  { icon: Lock, title: "Privacy First", desc: "Video stays on-device. We score signals, not content." },
  { icon: Zap, title: "Actionable Coaching", desc: "Targeted drills you can run in under 5 minutes a day." },
];

const STEPS = [
  { n: "01", t: "Choose a mode", d: "Interview, technical, presentation, or elevator pitch." },
  { n: "02", t: "Record a session", d: "Get live signals while you speak — no playback required." },
  { n: "03", t: "Read your report", d: "Charts, timeline replay, and one-tap drills targeted at your weak spots." },
];

const METRICS = [
  { label: "Sessions analyzed", value: "120K+" },
  { label: "Avg. filler-word drop", value: "−42%" },
  { label: "Improvement in 14 days", value: "3.2×" },
  { label: "Privacy compromises", value: "0" },
];

const TESTIMONIALS = [
  { q: "Cut my fillers by half in two weeks. Interview offers followed.", a: "Priya R.", r: "Product Manager" },
  { q: "It’s like having a speaking coach that never sleeps.", a: "Marcus T.", r: "Founder" },
  { q: "Finally, feedback I can act on. The drills are gold.", a: "Hana K.", r: "Engineer" },
];

const FAQ = [
  { q: "Is my video uploaded anywhere?", a: "No. Camera and audio processing happen on your device. We only store derived numerical scores you choose to keep." },
  { q: "What modes are supported?", a: "Behavioral interviews, technical interviews, long-form presentations, and 60-second pitches." },
  { q: "Do I need special hardware?", a: "Any webcam and microphone will do. Better cameras get better signal, but a laptop cam is plenty." },
  { q: "Can I export reports?", a: "Yes. Every session can be exported as a PDF for sharing with a coach or mentor." },
];

function Landing() {
  return (
    <div>
      <Hero />
      <Metrics />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Faq />
      <CtaBand />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 grid-bg" />
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-20 sm:px-6 lg:px-8 lg:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" /> New · Real-time coaching engine v2
          </span>
          <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Improve Your <span className="gradient-text">Interview</span> and{" "}
            <span className="gradient-text">Presentation</span> Skills with AI
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            Receive objective, privacy-first feedback based on measurable speaking signals —
            eye contact, pace, pitch, posture, and more.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="hero" size="xl">
              <Link to="/recorder">
                <Play className="h-4 w-4" /> Start Practicing
              </Link>
            </Button>
            <Button asChild variant="glass" size="xl">
              <Link to="/dashboard">
                View Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="relative mx-auto mt-16 max-w-5xl"
        >
          <div className="glass-strong rounded-3xl p-3 shadow-elegant">
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border bg-gradient-to-br from-card to-secondary">
              <div className="absolute inset-0 grid grid-cols-3">
                <div className="col-span-2 grid place-items-center p-8">
                  <div className="grid h-full w-full place-items-center rounded-2xl border border-dashed border-border/60 bg-background/40">
                    <div className="text-center">
                      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl [background-image:var(--gradient-primary)] shadow-glow">
                        <Mic className="h-7 w-7 text-primary-foreground" />
                      </div>
                      <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">Live camera preview</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 border-l border-border/50 p-4">
                  {[
                    { l: "Eye contact", v: 82, i: Eye },
                    { l: "WPM", v: 142, i: Gauge, suffix: "" },
                    { l: "Fillers", v: 4, i: Activity, suffix: "" },
                    { l: "Posture", v: 88, i: ShieldCheck },
                  ].map((m, i) => (
                    <motion.div
                      key={m.l}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.08 }}
                      className="glass rounded-xl p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.l}</span>
                        <m.i className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <p className="mt-1 text-xl font-semibold tabular-nums">{m.v}{m.suffix ?? "%"}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Metrics() {
  return (
    <section className="border-y bg-card/30 backdrop-blur">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 sm:px-6 md:grid-cols-4 lg:px-8">
        {METRICS.map((m) => (
          <div key={m.label} className="text-center">
            <p className="gradient-text text-3xl font-bold tracking-tight sm:text-4xl">{m.value}</p>
            <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{m.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Signals that actually predict performance</h2>
        <p className="mt-3 text-muted-foreground">
          Every metric we surface maps to a recognised behavior interviewers notice.
        </p>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -4 }}
            className="group relative overflow-hidden rounded-2xl border bg-card/60 p-6 shadow-card backdrop-blur"
          >
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl transition-opacity group-hover:opacity-80" />
            <div className="relative">
              <div className="grid h-10 w-10 place-items-center rounded-xl [background-image:var(--gradient-violet)] text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="bg-card/20">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-3 text-muted-foreground">Three steps from cold camera to a report you can act on.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="relative rounded-2xl border bg-card/60 p-6 shadow-card backdrop-blur"
            >
              <p className="gradient-text font-mono text-sm font-bold">{s.n}</p>
              <h3 className="mt-2 text-lg font-semibold">{s.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Loved by people who present for a living</h2>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <motion.figure
            key={i}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl border bg-card/60 p-6 shadow-card backdrop-blur"
          >
            <BarChart3 className="h-5 w-5 text-primary" />
            <blockquote className="mt-3 text-sm">"{t.q}"</blockquote>
            <figcaption className="mt-4 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{t.a}</span> · {t.r}
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const items = useMemo(() => FAQ, []);
  return (
    <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
      <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">Frequently asked</h2>
      <div className="mt-10 space-y-3">
        {items.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q} className="overflow-hidden rounded-xl border bg-card/60 backdrop-blur">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm font-medium">{f.q}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <motion.div
                initial={false}
                animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                className="overflow-hidden px-5 text-sm text-muted-foreground"
              >
                <p className="pb-4">{f.a}</p>
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl border p-10 text-center shadow-elegant [background-image:var(--gradient-indigo)]">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative">
          <h3 className="text-2xl font-semibold text-primary-foreground sm:text-3xl">
            Your next interview deserves a rehearsal.
          </h3>
          <p className="mt-2 text-sm text-primary-foreground/80">Record your first session in under 60 seconds.</p>
          <div className="mt-6 flex justify-center">
            <Button asChild variant="glass" size="lg">
              <Link to="/recorder">Start free <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
