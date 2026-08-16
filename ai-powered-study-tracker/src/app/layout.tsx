import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Lakshya JEE 2027 — Daily Tracker",
  description: "Log your daily timetable adherence and get AI-powered mentor insights for the JEE 2027 study plan.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Nav />
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</div>
      </body>
    </html>
  );
}
