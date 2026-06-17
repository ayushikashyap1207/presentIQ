import { motion } from "framer-motion";
import type { TimelineEvent } from "@/types";
import { cn } from "@/lib/utils";

const KIND = {
  positive: "bg-[color:var(--success)]/20 text-[color:var(--success)] ring-[color:var(--success)]/30",
  warning: "bg-[color:var(--warning)]/20 text-[color:var(--warning)] ring-[color:var(--warning)]/30",
  neutral: "bg-accent text-muted-foreground ring-border",
};

interface Props {
  events: TimelineEvent[];
  onSeek?: (t: string) => void;
}

export function Timeline({ events, onSeek }: Props) {
  return (
    <ol className="relative ml-3 border-l border-border/60">
      {events.map((e, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -6 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.04 }}
          className="relative mb-6 ml-6"
        >
          <span
            className={cn(
              "absolute -left-[34px] grid h-5 w-5 place-items-center rounded-full ring-2",
              KIND[e.kind],
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          </span>
          <button
            onClick={() => onSeek?.(e.start)}
            className="group text-left"
          >
            <p className="font-mono text-xs text-muted-foreground group-hover:text-foreground">
              {e.start} – {e.end}
            </p>
            <p className="mt-0.5 text-sm font-medium">{e.label}</p>
          </button>
        </motion.li>
      ))}
    </ol>
  );
}
