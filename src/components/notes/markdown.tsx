import { Fragment } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";

/** Текст для превью в карточках: убирает символы разметки, оставляя читаемые маркеры. */
export function stripMarkdown(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*[-*+]\s+\[( |x|X)\]\s+/, (_m, c: string) => (c === " " ? "○ " : "● "))
        .replace(/^\s*#{1,6}\s+/, "")
        .replace(/^\s*>\s?/, "")
        .replace(/^\s*[-*+]\s+/, "• ")
        .replace(/^\s*-{3,}\s*$/, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1$2")
        .replace(/`([^`]+)`/g, "$1"),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Инлайн-разметка: **жирный**, *курсив*, `код`. Всё остальное — обычный текст (React экранирует). */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g);
  return parts.map((p, i) => {
    const key = `${keyPrefix}-${i}`;
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={key}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2)
      return (
        <code key={key} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[0.9em]">
          {p.slice(1, -1)}
        </code>
      );
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={key}>{p.slice(1, -1)}</em>;
    return <Fragment key={key}>{p}</Fragment>;
  });
}

type Block =
  | { t: "h"; level: number; text: string }
  | { t: "p"; lines: string[] }
  | { t: "ul"; items: { text: string; line: number; check: null | boolean }[] }
  | { t: "ol"; items: { text: string; line: number }[] }
  | { t: "quote"; lines: string[] }
  | { t: "hr" };

function parse(src: string): Block[] {
  const lines = src.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push({ t: "h", level: h[1].length, text: h[2] });
      i++;
      continue;
    }
    if (/^\s*-{3,}\s*$/.test(line)) {
      blocks.push({ t: "hr" });
      i++;
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: Extract<Block, { t: "ul" }>["items"] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        const raw = lines[i].replace(/^\s*[-*+]\s+/, "");
        const c = /^\[( |x|X)\]\s+(.*)$/.exec(raw);
        items.push(c ? { text: c[2], line: i, check: c[1] !== " " } : { text: raw, line: i, check: null });
        i++;
      }
      blocks.push({ t: "ul", items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: Extract<Block, { t: "ol" }>["items"] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push({ text: lines[i].replace(/^\s*\d+[.)]\s+/, ""), line: i });
        i++;
      }
      blocks.push({ t: "ol", items });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push({ t: "quote", lines: q });
      continue;
    }
    const p: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|\s*[-*+]\s|\s*\d+[.)]\s|\s*>|\s*-{3,}\s*$)/.test(lines[i])
    ) {
      p.push(lines[i++]);
    }
    blocks.push({ t: "p", lines: p });
  }
  return blocks;
}

interface MarkdownProps {
  text: string;
  /** Клик по чекбоксу `- [ ]` — передаёт индекс строки в исходном тексте. */
  onToggleLine?: (line: number) => void;
  className?: string;
}

/** Простой безопасный рендер markdown: без dangerouslySetInnerHTML, весь ввод экранируется React. */
export function Markdown({ text, onToggleLine, className }: MarkdownProps) {
  const blocks = parse(text);
  if (blocks.length === 0) return <p className="text-sm text-fg-sub">Пока пусто</p>;
  return (
    <div className={clsx("flex flex-col gap-3 text-[15px] leading-relaxed", className)}>
      {blocks.map((b, bi) => {
        const k = `b${bi}`;
        switch (b.t) {
          case "h":
            return (
              <p
                key={k}
                role="heading"
                aria-level={b.level + 1}
                className={clsx("mt-2 font-bold tracking-[-0.01em]", b.level === 1 ? "text-2xl" : b.level === 2 ? "text-xl" : "text-lg")}
              >
                {inline(b.text, k)}
              </p>
            );
          case "p":
            return (
              <p key={k}>
                {b.lines.map((l, li) => (
                  <Fragment key={li}>
                    {li > 0 && <br />}
                    {inline(l, `${k}-${li}`)}
                  </Fragment>
                ))}
              </p>
            );
          case "ul":
            return (
              <ul key={k} className="flex flex-col gap-1.5">
                {b.items.map((it) =>
                  it.check === null ? (
                    <li key={it.line} className="flex gap-2.5">
                      <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-fg-sub" />
                      <span>{inline(it.text, `${k}-${it.line}`)}</span>
                    </li>
                  ) : (
                    <li key={it.line} className="flex items-start gap-2.5">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={it.check}
                        aria-label={it.text}
                        disabled={!onToggleLine}
                        onClick={() => onToggleLine?.(it.line)}
                        className={clsx(
                          "mt-[0.2em] flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.75px] transition-colors duration-150",
                          it.check ? "border-accent bg-accent text-white" : "border-fg-sub",
                        )}
                      >
                        {it.check && <Check size={11} strokeWidth={3.5} />}
                      </button>
                      <span className={clsx(it.check && "text-fg-sub line-through")}>{inline(it.text, `${k}-${it.line}`)}</span>
                    </li>
                  ),
                )}
              </ul>
            );
          case "ol":
            return (
              <ol key={k} className="flex list-decimal flex-col gap-1.5 pl-6 marker:text-fg-sub">
                {b.items.map((it) => (
                  <li key={it.line}>{inline(it.text, `${k}-${it.line}`)}</li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote key={k} className="border-l-[3px] border-line pl-4 text-fg-sub">
                {b.lines.map((l, li) => (
                  <Fragment key={li}>
                    {li > 0 && <br />}
                    {inline(l, `${k}-${li}`)}
                  </Fragment>
                ))}
              </blockquote>
            );
          case "hr":
            return <hr key={k} className="border-line" />;
        }
      })}
    </div>
  );
}
