"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/tracker.html", label: "Tracker", icon: "📋" },
  { href: "/stats", label: "Stats", icon: "📈" },
  { href: "/mentor", label: "AI Mentor", icon: "🧠" },
  { href: "/timetable", label: "Timetable", icon: "🗓️" },
];

function useIstClock(): string {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).formatToParts(new Date());
      const h = parts.find((p) => p.type === "hour")?.value ?? "00";
      const m = parts.find((p) => p.type === "minute")?.value ?? "00";
      const s = parts.find((p) => p.type === "second")?.value ?? "00";
      setNow(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Nav() {
  const pathname = usePathname();
  const ist = useIstClock();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-[#070a14]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg shadow-lg shadow-indigo-500/30">
            🎯
          </span>
          <span className="hidden sm:block">
            <span className="block text-sm font-bold leading-tight tracking-tight text-slate-100">
              Lakshya <span className="text-indigo-300">JEE 2027</span>
            </span>
            <span className="block text-[11px] leading-tight text-slate-500">Daily Tracker · AI Coach</span>
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = l.href === "/tracker.html" ? pathname === "/tracker.html" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-500/15 text-indigo-300"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <span className="text-base">{l.icon}</span>
                <span className="hidden md:inline">{l.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 rounded-lg border border-slate-800 px-3 py-1.5 lg:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-400 pulse-dot" />
          <span className="text-xs font-medium text-slate-400">IST</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-slate-200">{ist || "--:--:--"}</span>
        </div>
      </div>
    </header>
  );
}
