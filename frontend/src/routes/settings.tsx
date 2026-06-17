import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, Globe, Lock, Palette, Trash2, User } from "lucide-react";
import { ChartCard } from "@/components/common/chart-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useThemeStore, useUserStore } from "@/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · PresentIQ" },
      { name: "description", content: "Manage theme, notifications, privacy, and account preferences." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { theme, toggle } = useThemeStore();
  const user = useUserStore((s) => s.user);
  const setName = useUserStore((s) => s.setName);
  const [emails, setEmails] = useState(true);
  const [push, setPush] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [lang, setLang] = useState("en");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Settings</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Preferences</h1>
      </header>

      <div className="mt-6 space-y-4">
        <ChartCard title={<span className="flex items-center gap-2"><Palette className="h-4 w-4" /> Theme</span>}>
          <Row label="Dark mode" description="Easier on the eyes for long sessions.">
            <Switch checked={theme === "dark"} onCheckedChange={toggle} />
          </Row>
        </ChartCard>

        <ChartCard title={<span className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</span>}>
          <Row label="Email summaries" description="Weekly progress email every Monday.">
            <Switch checked={emails} onCheckedChange={setEmails} />
          </Row>
          <Row label="Push notifications" description="Real-time alerts when a report is ready.">
            <Switch checked={push} onCheckedChange={setPush} />
          </Row>
        </ChartCard>

        <ChartCard title={<span className="flex items-center gap-2"><Lock className="h-4 w-4" /> Privacy</span>}>
          <Row label="Anonymous usage analytics" description="Help us improve without sharing your content.">
            <Switch checked={analytics} onCheckedChange={setAnalytics} />
          </Row>
        </ChartCard>

        <ChartCard title={<span className="flex items-center gap-2"><Globe className="h-4 w-4" /> Language</span>}>
          <div className="max-w-xs">
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </ChartCard>

        <ChartCard title={<span className="flex items-center gap-2"><User className="h-4 w-4" /> Account</span>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input value={user.name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input value={user.email} readOnly className="mt-1.5" />
            </div>
          </div>
        </ChartCard>

        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-destructive/20 text-destructive">
              <Trash2 className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Permanently delete your account, sessions, and reports. This cannot be undone.
              </p>
            </div>
            <Button variant="danger">Delete account</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-3 last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}
