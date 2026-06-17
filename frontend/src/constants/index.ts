import type { SessionMode } from "@/types";

export const APP_NAME = "PresentIQ";

export const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/recorder", label: "Recorder" },
  { to: "/analytics", label: "Analytics" },
  { to: "/sessions", label: "Sessions" },
  { to: "/reports", label: "Reports" },
] as const;

export const MODES: { id: SessionMode; label: string; description: string }[] = [
  { id: "interview", label: "Interview", description: "Behavioral interview practice" },
  { id: "technical", label: "Technical Interview", description: "Whiteboard & system design" },
  { id: "presentation", label: "Presentation", description: "Long-form talks & demos" },
  { id: "elevator", label: "Elevator Pitch", description: "Sharp 60-second pitch" },
];

export const MODE_LABEL: Record<SessionMode, string> = {
  interview: "Interview",
  technical: "Technical",
  presentation: "Presentation",
  elevator: "Elevator Pitch",
};
