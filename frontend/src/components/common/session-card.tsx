import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Calendar, Clock, Eye, Trash2, Mic2, ChevronRight } from "lucide-react";
import type { Session } from "@/types";
import { Button } from "@/components/ui/button";
import { MODE_LABEL } from "@/constants";
import { fmtDuration, fmtRelativeDay } from "@/lib/format";
import { useSessionStore } from "@/store";
import { cn } from "@/lib/utils";

export function SessionCard({ session }: { session: Session }) {
  const remove = useSessionStore((s) => s.remove);
  const score = session.overallScore;
  const scoreColor =
    score >= 80 ? "text-[color:var(--success)]" : score >= 60 ? "text-[color:var(--warning)]" : "text-destructive";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -2 }}
      className="group relative overflow-hidden rounded-2xl border bg-card/60 p-5 shadow-card backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl [background-image:var(--gradient-indigo)] text-primary-foreground">
            <Mic2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">{MODE_LABEL[session.mode]}</p>
            <p className="text-xs text-muted-foreground">{fmtRelativeDay(session.date)}</p>
          </div>
        </div>
        <div className={cn("text-right text-3xl font-semibold tabular-nums", scoreColor)}>
          {score}
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <Stat label="Eye contact" value={`${session.metrics.eyeContact}%`} />
        <Stat label="WPM" value={`${session.metrics.wpm}`} />
        <Stat label="Fillers" value={`${session.metrics.fillerWords}`} />
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {fmtRelativeDay(session.date)}</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtDuration(session.duration)}</span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2">
        <Button asChild variant="glass" size="sm">
          <Link to="/sessions/$id" params={{ id: session.id }}>
            <Eye className="h-3.5 w-3.5" />
            View Details
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" aria-label="Delete session" onClick={() => remove(session.id)}>
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-accent/40 px-2 py-2">
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
