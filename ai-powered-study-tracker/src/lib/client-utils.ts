"use client";

/** Client-side label for the AI engine (server resolves the real provider per request). */
export function detectProviderLabel(): string {
  return "AI Mentor";
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
