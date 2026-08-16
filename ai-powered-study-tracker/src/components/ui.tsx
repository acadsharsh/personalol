import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 ${className}`}>{children}</div>;
}

const CATEGORY_STYLES: Record<string, string> = {
  health: "bg-rose-100 text-rose-700",
  meal: "bg-amber-100 text-amber-700",
  break: "bg-slate-100 text-slate-600",
  study_11: "bg-sky-100 text-sky-700",
  study_12: "bg-violet-100 text-violet-700",
};

const CATEGORY_LABEL: Record<string, string> = {
  health: "Health",
  meal: "Meal",
  break: "Break",
  study_11: "11th Study",
  study_12: "12th Study",
};

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[category] ?? "bg-slate-100 text-slate-600"}`}>
      {CATEGORY_LABEL[category] ?? category}
    </span>
  );
}

const SUBJECT_STYLES: Record<string, string> = {
  physics: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  chemistry: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  maths: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  mixed: "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200",
};

export function SubjectBadge({ subject }: { subject: string | null }) {
  if (!subject) return null;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${SUBJECT_STYLES[subject] ?? "bg-slate-50 text-slate-600"}`}>
      {subject}
    </span>
  );
}

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = clamped >= 80 ? "bg-emerald-500" : clamped >= 50 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className={`h-2.5 w-full overflow-hidden rounded-full bg-slate-100 ${className}`}>
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </Card>
  );
}

const SEVERITY_STYLES: Record<string, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  critical: "border-rose-200 bg-rose-50 text-rose-900",
};

export function SuggestionItem({ severity, text }: { severity: string; text: string }) {
  return <div className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info}`}>{text}</div>;
}
