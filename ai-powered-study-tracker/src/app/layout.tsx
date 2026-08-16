import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Nav from "@/components/nav";

export const metadata: Metadata = {
  title: "Lakshya JEE 2027 — Daily Tracker & AI Mentor",
  description:
    "Track your 13h/day JEE timetable, log every slot, and let the built-in AI mentor coach you to better adherence.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
