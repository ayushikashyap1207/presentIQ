import { Link } from "@tanstack/react-router";
import { Github, Twitter, Linkedin, Sparkles } from "lucide-react";
import { APP_NAME } from "@/constants";

export function Footer() {
  return (
    <footer className="mt-24 border-t bg-card/30 backdrop-blur">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md [background-image:var(--gradient-primary)]">
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold">{APP_NAME}</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Private, on-device AI coaching for interviews and presentations.
          </p>
        </div>
        {[
          { title: "Product", links: [["Dashboard","/dashboard"], ["Recorder","/recorder"], ["Analytics","/analytics"], ["Reports","/reports"]] },
          { title: "Account", links: [["Profile","/profile"], ["Settings","/settings"], ["Sessions","/sessions"]] },
          { title: "Company", links: [["About","/"], ["Privacy","/"], ["Contact","/"]] },
        ].map((col) => (
          <div key={col.title}>
            <h4 className="text-sm font-semibold">{col.title}</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <Link to={href} className="hover:text-foreground">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
          <div className="flex gap-3 text-muted-foreground">
            <Twitter className="h-4 w-4 hover:text-foreground" />
            <Github className="h-4 w-4 hover:text-foreground" />
            <Linkedin className="h-4 w-4 hover:text-foreground" />
          </div>
        </div>
      </div>
    </footer>
  );
}
