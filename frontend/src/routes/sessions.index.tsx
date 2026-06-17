import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, ArrowUpDown, Inbox } from "lucide-react";
import { useMemo, useState } from "react";
import { useSessionStore } from "@/store";
import { SessionCard } from "@/components/common/session-card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MODE_LABEL } from "@/constants";
import type { SessionMode } from "@/types";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/sessions/")({
  head: () => ({
    meta: [
      { title: "Sessions · PresentIQ" },
      { name: "description", content: "Browse, filter, and review every practice session you've recorded." },
    ],
  }),
  component: SessionsPage,
});

function SessionsPage() {
  const sessions = useSessionStore((s) => s.sessions);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<SessionMode | "all">("all");
  const [sort, setSort] = useState<"recent" | "score" | "duration">("recent");

  const filtered = useMemo(() => {
    let list = sessions.filter((s) => {
      if (mode !== "all" && s.mode !== mode) return false;
      if (q && !`${MODE_LABEL[s.mode]} ${s.id}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "score") return b.overallScore - a.overallScore;
      if (sort === "duration") return b.duration - a.duration;
      return +new Date(b.date) - +new Date(a.date);
    });
    return list;
  }, [sessions, q, mode, sort]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Library</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Sessions</h1>
          <p className="mt-1 text-sm text-muted-foreground">{filtered.length} of {sessions.length} sessions</p>
        </div>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sessions" className="pl-9 glass" />
        </div>
        <Select value={mode} onValueChange={(v) => setMode(v as any)}>
          <SelectTrigger className="w-[180px] glass">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <SelectValue placeholder="All modes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modes</SelectItem>
            <SelectItem value="interview">Interview</SelectItem>
            <SelectItem value="technical">Technical</SelectItem>
            <SelectItem value="presentation">Presentation</SelectItem>
            <SelectItem value="elevator">Elevator pitch</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as any)}>
          <SelectTrigger className="w-[180px] glass">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most recent</SelectItem>
            <SelectItem value="score">Highest score</SelectItem>
            <SelectItem value="duration">Longest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((s) => <SessionCard key={s.id} session={s} />)}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="mt-8">
          <EmptyState
            icon={Inbox}
            title="No sessions found"
            description="Try clearing your filters or record a fresh session."
            action={<Button variant="hero" asChild><a href="/recorder">Record a session</a></Button>}
          />
        </div>
      )}
    </div>
  );
}
