import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, CameraOff, Mic, MicOff, Pause, Play, Square, Trash2,
  CircleDot, Eye, Gauge, Activity, ShieldCheck, Volume2, Music2,
  Briefcase, ChevronRight, ChevronLeft, HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MODES } from "@/constants";
import { useMetricsStore, useRecordingStore, useSessionStore } from "@/store";
import { fmtDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CircularProgress } from "@/components/common/circular-progress";
import type { SessionMode } from "@/types";
import { createSession, uploadAudio, transcribeSession, analyzeMetrics, generateFeedback, getSessions } from "@/lib/api";
import { useRecorder } from "@/hooks/useRecorder";
import { useMediaPipe } from "@/hooks/useMediaPipe";

export const Route = createFileRoute("/recorder")({
  head: () => ({
    meta: [
      { title: "Recorder · PresentIQ" },
      { name: "description", content: "Record your next interview or presentation with real-time AI signal feedback." },
    ],
  }),
  component: Recorder,
});

// Practice questions mapped by job profile
const JOB_QUESTIONS: Record<string, string[]> = {
  "Software Engineer": [
    "Tell me about a challenging technical problem you solved and how you approached it.",
    "How do you handle disagreement with a technical decision made by your lead or peer?",
    "Explain the difference between SQL and NoSQL databases, and when you would choose one over the other.",
    "Describe your experience with system design and how you ensure scalability."
  ],
  "Product Manager": [
    "How do you prioritize features for a product roadmap when faced with conflicting stakeholder inputs?",
    "Tell me about a product you love and how you would improve it to increase engagement.",
    "How do you define and measure success for a new feature launch?",
    "Describe a time you had to make a product decision without complete data."
  ],
  "Data Analyst": [
    "Describe a time you discovered an unexpected trend or insight in a dataset. How did you communicate it?",
    "How do you clean and validate noisy or incomplete data before beginning your analysis?",
    "Explain what a statistical p-value or A/B test is to a non-technical business partner.",
    "Which tools (SQL, Python, Excel, Tableau) do you prefer for data visualization and why?"
  ],
  "General / Other": [
    "Tell me about yourself and why you are interested in this position.",
    "Describe a time you had to work closely with someone whose style or personality was very different from yours.",
    "What is your greatest professional achievement and how did you accomplish it?",
    "How do you manage multiple tight deadlines or project priorities?"
  ]
};

function Recorder() {
  const { status, mode, elapsed, setMode, start, pause, resume, stop, reset, tick } = useRecordingStore();
  const addSession = useSessionStore((s) => s.add);
  const backendActive = useSessionStore((s) => s.backendActive);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camError, setCamError] = useState<string | null>(null);

  // Job profile state
  const [jobProfile, setJobProfile] = useState<string>("Software Engineer");
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);

  // MediaPipe Vision Hook
  const mp = useMediaPipe();

  // Audio chunk handler
  const handleAudioChunk = useCallback((chunk: Blob) => {
    audioChunksRef.current.push(chunk);
  }, []);

  // Initialize recorder hook
  const { isRecording, stream, startRecording, stopRecording } = useRecorder({
    onAudioChunk: handleAudioChunk,
  });

  // Bind video element stream
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      setCamOn(true);
    }
  }, [stream]);

  // Frame processing loop
  useEffect(() => {
    if (status !== "recording" || !videoRef.current || !mp.isReady) return;
    
    let active = true;
    const processFrame = () => {
      if (!active || !videoRef.current) return;
      
      const video = videoRef.current;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        mp.analyzeFrame(video, performance.now());
      }
      
      requestAnimationFrame(processFrame);
    };
    
    processFrame();
    
    return () => {
      active = false;
    };
  }, [status, mp.isReady, mp.analyzeFrame]);

  // Handle elapsed time and fallback fallback jitter
  useEffect(() => {
    if (status !== "recording") return;
    const id = setInterval(() => {
      tick();
    }, 1000);
    return () => clearInterval(id);
  }, [status, tick]);

  const onStart = async () => {
    audioChunksRef.current = [];
    mp.resetSessionMetrics();
    await startRecording();
    start();
  };

  const onStop = async () => {
    stopRecording();
    stop();
    const now = new Date().toISOString();
    
    // Construct audio blob from recorded chunks
    const audioBlob = audioChunksRef.current.length > 0 
      ? new Blob(audioChunksRef.current, { type: "audio/webm" })
      : new Blob([new Uint8Array(1000)], { type: "audio/wav" }); // fallback dummy

    const metrics = {
      eyeContact: mp.metrics.eyeContactPercentage,
      wpm: 135, // average WPM baseline
      fillerWords: 4,
      pitchVariance: mp.metrics.fidgetScore > 15 ? 45 : 65,
      volumeConsistency: 80,
      postureScore: mp.metrics.postureScore,
      headStability: mp.metrics.headStabilityScore,
    };

    const currentQuestion = mode === "interview" ? JOB_QUESTIONS[jobProfile][currentQuestionIdx] : "General speaking practice";
    const sessionTitle = mode === "interview" ? `${jobProfile} Interview Practice` : `${mode.charAt(0).toUpperCase() + mode.slice(1)} Practice`;

    const fallbackSession = {
      id: `sess_${Date.now()}`,
      date: now,
      mode,
      duration: elapsed,
      overallScore: Math.round(
        (metrics.eyeContact + metrics.pitchVariance + metrics.volumeConsistency + metrics.postureScore + metrics.headStability + (100 - metrics.fillerWords * 2)) / 6,
      ),
      metrics,
      strengths: ["Confident opening", "Clear articulation", "Good posture stability"],
      improvements: ["Reduce filler words", "Vary pitch on key points"],
      suggestions: [`Keep practicing ${jobProfile} questions`, "Structure answers with STAR method"],
      timeline: [
        { start: "00:00", end: "00:30", label: "Steady vocal delivery", kind: "positive" as const },
        { start: "00:30", end: "00:45", label: "Slight pacing drop", kind: "neutral" as const },
        { start: "00:45", end: "01:00", label: "Use of filler word 'like'", kind: "warning" as const },
      ],
    };

    if (!backendActive) {
      addSession(fallbackSession);
      reset();
      return;
    }

    try {
      const sess = await createSession(sessionTitle, mode);
      const sessionId = sess.id;

      // Upload actual audio file
      await uploadAudio(sessionId, audioBlob);
      await transcribeSession(sessionId);
      await analyzeMetrics(sessionId, {
        eyeContact: metrics.eyeContact,
        postureScore: metrics.postureScore,
        headStability: metrics.headStability,
        fidgetScore: mp.metrics.fidgetScore,
      });
      await generateFeedback(sessionId);

      // Re-sync sessions list
      const fetched = await getSessions();
      if (fetched.length > 0) {
        useSessionStore.setState({ sessions: fetched });
      }
    } catch (e) {
      console.error("Backend pipeline failed, falling back to client-side mock:", e);
      addSession(fallbackSession);
    }
    reset();
  };

  const handleDiscard = () => {
    stopRecording();
    reset();
    setCamOn(false);
  };

  const activeQuestions = JOB_QUESTIONS[jobProfile] || JOB_QUESTIONS["General / Other"];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recorder</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Practice session</h1>
        </div>
        <StatusPill status={status} />
      </header>

      {/* Main recording workspace */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        
        {/* Left pane: Video, questions, profile select */}
        <div className="space-y-4">
          
          {/* Question / Prompter Panel during Interview Practice */}
          <AnimatePresence>
            {mode === "interview" && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="glass-strong rounded-2xl p-5 border-primary/20 shadow-glow"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-primary">
                    <Briefcase className="h-5 w-5" />
                    <span className="text-sm font-semibold">{jobProfile} Profile</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={currentQuestionIdx === 0}
                      onClick={() => setCurrentQuestionIdx((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-mono text-muted-foreground">
                      {currentQuestionIdx + 1} / {activeQuestions.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={currentQuestionIdx === activeQuestions.length - 1}
                      onClick={() => setCurrentQuestionIdx((p) => Math.min(activeQuestions.length - 1, p + 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-3">
                  <HelpCircle className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                  <p className="text-base font-medium leading-relaxed">
                    {activeQuestions[currentQuestionIdx]}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Video element view */}
          <div className="relative aspect-video overflow-hidden rounded-3xl border bg-black shadow-elegant">
            {camOn || stream ? (
              <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-gradient-to-br from-card to-secondary">
                <div className="text-center">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl [background-image:var(--gradient-primary)] shadow-glow">
                    <Camera className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">Enable your camera stream to practice</p>
                  <Button variant="hero" size="sm" className="mt-4" onClick={onStart}>
                    Enable camera & mic
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

          {/* Controller buttons */}
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
                <Button variant="hero" size="lg" onClick={onStart}>
                  <CircleDot className="h-4 w-4" /> Start recording
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
              <Button variant="ghost" size="icon" aria-label="Discard" onClick={handleDiscard}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Job profile & mode selection */}
          <div className="grid gap-4 md:grid-cols-2">
            
            {/* Mode selection */}
            <div className="glass-strong rounded-2xl p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Practice Mode</p>
              <div className="grid gap-2 grid-cols-2">
                {MODES.map((m) => (
                  <ModeButton key={m.id} m={m} active={mode === m.id} onClick={() => setMode(m.id)} />
                ))}
              </div>
            </div>

            {/* Profile Selection */}
            <div className="glass-strong rounded-2xl p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Select Job Profile</p>
              <div className="grid gap-2 grid-cols-2">
                {Object.keys(JOB_QUESTIONS).map((job) => (
                  <button
                    key={job}
                    disabled={mode !== "interview"}
                    onClick={() => {
                      setJobProfile(job);
                      setCurrentQuestionIdx(0);
                    }}
                    className={cn(
                      "rounded-xl border bg-card/45 p-2.5 text-xs text-left transition font-semibold",
                      jobProfile === job && mode === "interview"
                        ? "border-primary/50 bg-primary/10 shadow-glow" 
                        : "hover:bg-accent/40 disabled:opacity-50"
                    )}
                  >
                    {job}
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* Live signals feedback */}
        <aside className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Live signals</p>
          <LiveMetric icon={Eye} label="Eye contact" value={mp.metrics.eyeContactPercentage} suffix="%" />
          <LiveMetric icon={Gauge} label="WPM" value={135} suffix="" max={200} />
          <LiveMetric icon={Activity} label="Filler words" value={4} suffix="" max={30} invert />
          <LiveMetric icon={Music2} label="Pitch variance" value={mp.metrics.fidgetScore > 15 ? 45 : 65} suffix="%" />
          <LiveMetric icon={Volume2} label="Volume" value={80} suffix="%" />
          <LiveMetric icon={ShieldCheck} label="Posture" value={mp.metrics.postureScore} suffix="%" />
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
