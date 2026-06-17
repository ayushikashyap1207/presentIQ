import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ComponentProps } from "react";

const TOOLTIP_STYLE: ComponentProps<typeof Tooltip>["contentStyle"] = {
  background: "color-mix(in oklab, var(--card) 92%, transparent)",
  border: "1px solid color-mix(in oklab, var(--foreground) 10%, transparent)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--foreground)",
  backdropFilter: "blur(8px)",
};

const AXIS = { stroke: "var(--muted-foreground)", fontSize: 11 };
const GRID = { stroke: "color-mix(in oklab, var(--foreground) 8%, transparent)" };

export interface ChartPoint { name: string; [k: string]: number | string }

export function TrendArea({
  data,
  dataKey,
  color = "var(--primary)",
  height = 220,
}: {
  data: ChartPoint[];
  dataKey: string;
  color?: string;
  height?: number;
}) {
  const id = `g-${dataKey}-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" {...AXIS} tickLine={false} axisLine={false} />
        <YAxis {...AXIS} tickLine={false} axisLine={false} width={30} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: color, strokeOpacity: 0.3 }} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#${id})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({
  data,
  series,
  height = 240,
}: {
  data: ChartPoint[];
  series: { key: string; label: string; color: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid {...GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" {...AXIS} tickLine={false} axisLine={false} />
        <YAxis {...AXIS} tickLine={false} axisLine={false} width={30} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }} />
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TrendBar({
  data,
  dataKey,
  color = "var(--primary)",
  height = 220,
}: {
  data: ChartPoint[];
  dataKey: string;
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid {...GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" {...AXIS} tickLine={false} axisLine={false} />
        <YAxis {...AXIS} tickLine={false} axisLine={false} width={30} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "color-mix(in oklab, var(--foreground) 5%, transparent)" }} />
        <Bar dataKey={dataKey} fill={color} radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MetricRadar({
  data,
  height = 280,
}: {
  data: { metric: string; value: number; full: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data}>
        <PolarGrid stroke="color-mix(in oklab, var(--foreground) 10%, transparent)" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
        <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
        <Radar dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.35} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  height = 240,
}: {
  data: { name: string; value: number; color: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={88} paddingAngle={3} stroke="none">
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export const CHART_COLORS = {
  primary: "oklch(0.66 0.21 285)",
  violet: "oklch(0.7 0.2 305)",
  indigo: "oklch(0.66 0.2 265)",
  cyan: "oklch(0.72 0.16 210)",
  success: "oklch(0.74 0.17 155)",
  warning: "oklch(0.8 0.16 80)",
};
