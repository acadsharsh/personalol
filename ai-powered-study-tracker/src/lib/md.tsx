import type { ReactNode } from "react";

/** Minimal markdown renderer for AI output: **bold**, "- " bullets, line breaks. */
export function renderMiniMd(text: string): ReactNode[] {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  let key = 0;

  const flushList = () => {
    if (list.length) {
      out.push(
        <ul key={`ul-${key++}`} className="my-1 space-y-1 pl-1">
          {list}
        </ul>
      );
      list = [];
    }
  };

  const renderInline = (s: string): ReactNode[] => {
    const nodes: ReactNode[] = [];
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    parts.forEach((p, i) => {
      if (!p) return;
      if (p.startsWith("**") && p.endsWith("**")) {
        nodes.push(<strong key={i}>{p.slice(2, -2)}</strong>);
      } else {
        nodes.push(<span key={i}>{p}</span>);
      }
    });
    return nodes;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim().startsWith("- ")) {
      list.push(
        <li key={`li-${key++}`} className="flex gap-2 text-sm leading-relaxed text-slate-300">
          <span className="mt-0.5 text-indigo-400">▸</span>
          <span>{renderInline(line.trim().slice(2))}</span>
        </li>
      );
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    const isHeading = /^\*\*[^*]+\*\*$/.test(line.trim());
    if (isHeading) {
      out.push(
        <p key={`p-${key++}`} className="mb-1 text-sm font-bold text-indigo-200">
          {renderInline(line.trim())}
        </p>
      );
    } else {
      out.push(
        <p key={`p-${key++}`} className="mb-1 text-sm leading-relaxed text-slate-300">
          {renderInline(line.trim())}
        </p>
      );
    }
  }
  flushList();
  return out;
}
