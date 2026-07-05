import React from "react";

// Minimal renderer for a guide step body (plain text authored with newlines).
// Handles numbered lists ("1. "), bullet lists ("- " / "• "), fenced code
// (``` … ```), inline `code`, and paragraphs — no markdown dependency.

function renderInline(text: string, keyBase: string): React.ReactNode {
  const parts = text.split(/`([^`]+)`/g);
  return parts.map((p, i) =>
    i % 2 === 1
      ? <code className="guide-code" key={keyBase + i}>{p}</code>
      : <React.Fragment key={keyBase + i}>{p}</React.Fragment>,
  );
}

const isNum = (l: string) => /^\s*\d+\.\s/.test(l);
const isBullet = (l: string) => /^\s*[-•]\s/.test(l);
const isFence = (l: string) => l.trim().startsWith("```");

export function GuideBody({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isFence(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !isFence(lines[i])) { buf.push(lines[i]); i++; }
      i++; // skip closing fence
      blocks.push(<pre className="guide-pre" key={k++}><code>{buf.join("\n")}</code></pre>);
      continue;
    }

    if (isNum(line)) {
      const items: string[] = [];
      while (i < lines.length && isNum(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s/, "")); i++; }
      blocks.push(<ol className="guide-list" key={k++}>{items.map((it, j) => <li key={j}>{renderInline(it, `${k}-${j}-`)}</li>)}</ol>);
      continue;
    }

    if (isBullet(line)) {
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i])) { items.push(lines[i].replace(/^\s*[-•]\s/, "")); i++; }
      blocks.push(<ul className="guide-list" key={k++}>{items.map((it, j) => <li key={j}>{renderInline(it, `${k}-${j}-`)}</li>)}</ul>);
      continue;
    }

    if (line.trim() === "") { i++; continue; }

    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isNum(lines[i]) && !isBullet(lines[i]) && !isFence(lines[i])) {
      buf.push(lines[i]); i++;
    }
    blocks.push(
      <p className="guide-p" key={k++}>
        {buf.map((b, j) => (
          <React.Fragment key={j}>{renderInline(b, `${k}-${j}-`)}{j < buf.length - 1 ? <br /> : null}</React.Fragment>
        ))}
      </p>,
    );
  }

  return <>{blocks}</>;
}
