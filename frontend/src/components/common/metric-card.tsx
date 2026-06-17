import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useCountUp } from "@/hooks/use-counter";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number;
  suffix?: string;
  icon?: LucideIcon;
  trend?: number; // +/- %
  gradient?: "primary" | "violet" | "indigo" | "cyan" | "success" | "warning";
  decimals?: number;
}

const GRAD: Record<NonNullable<Props["gradient"]>, string> = {
  primary: "[background-image:var(--gradient-primary)]",
  violet: "[background-image:var(--gradient-violet)]",
  indigo: "[background-image:var(--gradient-indigo)]",
  cyan: "[background-image:var(--gradient-cyan)]",
  success: "[background-image:var(--gradient-success)]",
  warning: "[background-image:var(--gradient-warning)]",
};

export function MetricCard({
  label,
  value,
  suffix,
  icon: Icon,
  trend,
  gradient = "primary",
  decimals = 0,
}: Props) {
  const n = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group relative overflow-hidden rounded-2xl border bg-card/60 p-5 shadow-card backdrop-blur"
    >
      <div className={cn("absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-30 blur-2xl transition-opacity group-hover:opacity-50", GRAD[gradient])} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
            {n.toFixed(decimals)}
            {suffix && <span className="ml-1 text-base text-muted-foreground">{suffix}</span>}
          </p>
          {typeof trend === "number" && (
            <p className={cn("mt-1 text-xs font-medium", trend >= 0 ? "text-[color:var(--success)]" : "text-destructive")}>
              {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}% vs last period
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn("grid h-10 w-10 place-items-center rounded-xl text-primary-foreground shadow-glow", GRAD[gradient])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
