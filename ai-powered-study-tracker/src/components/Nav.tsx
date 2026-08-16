"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Tracker", icon: "📋" },
  { href: "/history", label: "History", icon: "📈" },
  { href: "/mentor", label: "AI Mentor", icon: "🧠" },
  { href: "/schedule", label: "Schedule", icon: "🗓️" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl">🎯</span>
          <div>
            <p className="text-sm font-semibold leading-tight text-slate-900">Lakshya JEE 2027</p>
            <p className="text-[11px] leading-tight text-slate-500">Daily Timetable Tracker</p>
          </div>
        </Link>
        <nav className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  active ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                <span className="mr-1">{l.icon}</span>
                <span className="hidden sm:inline">{l.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
