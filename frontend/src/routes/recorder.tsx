import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Camera, CameraOff, Mic, MicOff, Pause, Play, Square, Trash2,
  CircleDot, Eye, Gauge, Activity, ShieldCheck, Volume2, Music2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MODES } from "@/constants";
import { useMetricsStore, useRecordingStore, useSessionStore } from "@/store";
import { fmtDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CircularProgress } from "@/components/common/circular-progress";
import type { SessionMode } from "@/types";

export const Route = createFileRoute("/recorder")({
  head: () => ({
    meta: [
      { title: "Recorder · PresentIQ" },
      { name: "description", content: "Record your next interview or presentation with real-time AI signal feedback." },
    ],
  }),
  component: Recorder,
});

function Recorder() {
  const { status, mode, elapsed, setMode, start, pause, resume, stop, reset, tick } = useRecordingStore();
  const { metrics, randomize } = useMetricsStore();
  const addSession = useSessionStore((s) => s.add);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camError, setCamError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (camOn) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: micOn })
        .then((s) => {
          stream = s;
          if (videoRef.current) videoRef.current.srcObject = s;
          setCamError(null);
        })
        .catch((e) => setCamError(e.message || "Camera unavailable"));
    }
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [camOn, micOn]);

  useEffect(() => {
    if (status !== "recording") return;
    const id = setInterval(() => {
      tick();
      randomize();
    }, 1000);
    return () => clearInterval(id);
  }, [status, tick, randomize]);

  const onStop = () => {
    stop();
    const now = new Date().toISOString();
    addSession({
      id: `sess_${Date.now()}`,
      date: now,
      mode,
      duration: elapsed,
      overallScore: Math.round(
        (metrics.eyeContact + metrics.pitchVariance + metrics.volumeConsistency + metrics.postureScore + metrics.headStability + (100 - metrics.fillerWords * 2)) / 6,
      ),
      metrics,
      strengths: ["Confident opening", "Clear articulation"],
      improvements: ["Reduce filler words", "Vary pitch on key points"],
      suggestions: ["Practice STAR answers", "Run a 60s elevator pitch tomorrow"],
      timeline: [
        { start: "00:00", end: "01:00", label: "Strong opening, confident tone", kind: "positive" },
        { start: "01:00", end: "02:10", label: "Good pace maintained", kind: "positive" },
        { start: "02:10", end: "02:40", label: "Long pause detected", kind: "warning" },
      ],
    });
    reset();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recorder</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Practice session</h1>
        </div>
        <StatusPill status={status} />
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Camera / controls */}
        <div className="space-y-4">
          <div className="relative aspect-video overflow-hidden rounded-3xl border bg-black shadow-elegant">
            {camOn ? (
              <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-gradient-to-br from-card to-secondary">
                <div className="text-center">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl [background-image:var(--gradient-primary)] shadow-glow">
                    <Camera className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">Enable your camera to begin</p>
                  <Button variant="hero" size="sm" className="mt-4" onClick={() => setCamOn(true)}>
                    Enable camera
                  </Button>
                  {camError && <p className="mt-3 text-xs text-destructive">{camError}</p>}
                </div>
              </div>
            )}

            {/* HUD overlay */}
            <div className="pointer-events-none absolute inset-0 p-4">
              <div className="flex items-start justify-between">
                <div className="glass pointer-events-auto flex items-center gap-2 rounded-full px-3 py-1.5">
                  {status === "recording" && (
                    <motion.span
                      className="h-2 w-2 rounded-full bg-destructive"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    />
                  )}
                  <span className="font-mono text-sm tabular-nums">{fmtDuration(elapsed)}</span>
                </div>
                <div className="glass pointer-events-auto flex items-center gap-3 rounded-full px-3 py-1.5 text-xs">
                  <span className="flex items-center gap-1.5">
                    {camOn ? <Camera className="h-3.5 w-3.5 text-[color:var(--success)]" /> : <CameraOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    Camera
                  </span>
                  <span className="text-border">|</span>
                  <span className="flex items-center gap-1.5">
                    {micOn ? <Mic className="h-3.5 w-3.5 text-[color:var(--success)]" /> : <MicOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    Mic
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="glass-strong flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" aria-label="Toggle camera" onClick={() => setCamOn((v) => !v)}>
                {camOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" aria-label="Toggle mic" onClick={() => setMicOn((v) => !v)}>
                {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {status === "idle" && (
                <Button variant="hero" size="lg" onClick={start} disabled={!camOn}>
                  <CircleDot className="h-4 w-4" /> Start
                </Button>
              )}
              {status === "recording" && (
                <>
                  <Button variant="glass" size="lg" onClick={pause}>
                    <Pause className="h-4 w-4" /> Pause
                  </Button>
                  <Button variant="danger" size="lg" onClick={onStop}>
                    <Square className="h-4 w-4" /> Stop
                  </Button>
                </>
              )}
              {status === "paused" && (
                <>
                  <Button variant="hero" size="lg" onClick={resume}>
                    <Play className="h-4 w-4" /> Resume
                  </Button>
                  <Button variant="danger" size="lg" onClick={onStop}>
                    <Square className="h-4 w-4" /> Stop
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon" aria-label="Discard" onClick={reset}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Mode selector */}
          <div className="glass-strong rounded-2xl p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Mode</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {MODES.map((m) => (
                <ModeButton key={m.id} m={m} active={mode === m.id} onClick={() => setMode(m.id)} />
              ))}
            </div>
          </div>
        </div>

        {/* Live metrics */}
        <aside className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Live signals</p>
          <LiveMetric icon={Eye} label="Eye contact" value={metrics.eyeContact} suffix="%" />
          <LiveMetric icon={Gauge} label="WPM" value={metrics.wpm} suffix="" max={200} />
          <LiveMetric icon={Activity} label="Filler words" value={metrics.fillerWords} suffix="" max={30} invert />
          <LiveMetric icon={Music2} label="Pitch variance" value={metrics.pitchVariance} suffix="%" />
          <LiveMetric icon={Volume2} label="Volume" value={metrics.volumeConsistency} suffix="%" />
          <LiveMetric icon={ShieldCheck} label="Posture" value={metrics.postureScore} suffix="%" />
          <LiveMetric icon={ShieldCheck} label="Head stability" value={metrics.headStability} suffix="%" />
        </aside>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    idle: "bg-muted text-muted-foreground",
    recording: "bg-destructive/15 text-destructive",
    paused: "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
    stopped: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
  };
  return (
    <span className={cn("rounded-full px-3 py-1 text-xs font-medium capitalize", map[status])}>
      {status}
    </span>
  );
}

function ModeButton({ m, active, onClick }: { m: { id: SessionMode; label: string; description: string }; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card/40 p-3 text-left transition",
        active ? "border-primary/50 bg-primary/10 shadow-glow" : "hover:bg-accent/40",
      )}
    >
      <p className="text-sm font-semibold">{m.label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>
    </button>
  );
}

function LiveMetric({
  icon: Icon, label, value, suffix, max = 100, invert = false,
}: {
  icon: any; label: string; value: number; suffix: string; max?: number; invert?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const display = invert ? 100 - pct : pct;
  return (
    <motion.div
      layout
      className="flex items-center gap-4 rounded-2xl border bg-card/60 p-4 shadow-card backdrop-blur"
    >
      <CircularProgress value={display} size={64} stroke={6} sublabel="" />
      <div className="flex-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 flex items-baseline gap-1 text-xl font-semibold tabular-nums">
          {value}<span className="text-xs text-muted-foreground">{suffix}</span>
        </p>
      </div>
      <Icon className="h-4 w-4 text-primary" />
    </motion.div>
  );
}
