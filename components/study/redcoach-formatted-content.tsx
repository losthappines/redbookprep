"use client";

import React, { useEffect, useState, useMemo } from "react";

// KaTeX hook: loads KaTeX JS from CDN dynamically once and tracks ready state
function useKaTeX() {
  const [ready, setReady] = useState(
    typeof window !== "undefined" && Boolean((window as unknown as { katex?: unknown }).katex)
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as unknown as { katex?: unknown };
    if (win.katex) {
      setReady(true);
      return;
    }

    // Ensure KaTeX stylesheet is present in head
    if (!document.getElementById("katex-cdn-css")) {
      const link = document.createElement("link");
      link.id = "katex-cdn-css";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }

    // Load KaTeX script
    if (!document.getElementById("katex-cdn-js")) {
      const script = document.createElement("script");
      script.id = "katex-cdn-js";
      script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js";
      script.async = true;
      script.onload = () => setReady(true);
      document.head.appendChild(script);
    } else {
      const checkInterval = setInterval(() => {
        if (win.katex) {
          setReady(true);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }
  }, []);

  return ready;
}

// Math Formula component with KaTeX rendering and graceful fallback
function MathView({
  math,
  display = false,
  katexReady,
}: {
  math: string;
  display?: boolean;
  katexReady: boolean;
}) {
  const renderedHtml = useMemo(() => {
    if (!katexReady || typeof window === "undefined") return null;
    const win = window as unknown as {
      katex?: {
        renderToString: (
          tex: string,
          opts: { displayMode?: boolean; throwOnError?: boolean }
        ) => string;
      };
    };
    if (!win.katex) return null;
    try {
      return win.katex.renderToString(math.trim(), {
        displayMode: display,
        throwOnError: false,
      });
    } catch {
      return null;
    }
  }, [math, display, katexReady]);

  if (renderedHtml) {
    return (
      <span
        className={display ? "redcoach-block-math" : "redcoach-inline-math"}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    );
  }

  // Clean fallback while KaTeX is initializing (no dollar signs)
  return (
    <span className={display ? "redcoach-block-math-fallback" : "redcoach-inline-math-fallback"}>
      {math}
    </span>
  );
}

// Inline token types
type InlineToken =
  | { type: "text"; content: string }
  | { type: "math"; content: string }
  | { type: "boldItalic"; content: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "code"; content: string }
  | { type: "link"; text: string; href: string };

function parseInlines(text: string): InlineToken[] {
  // Regex to match math ($...$), boldItalic (***...***), bold (**...**), italic (*...*), code (`...`), link ([text](url))
  const regex =
    /(\$([^\s$](?:[^$]*?[^\s$])?)\$)|(\*\*\*(.*?)\*\*\*)|(\*\*(.*?)\*\*)|(\*(.*?)\*)|(`([^`]+)`)|(\[(.*?)\]\((https?:\/\/[^\s)]+)\))/g;
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      tokens.push({ type: "math", content: match[2] });
    } else if (match[3] !== undefined) {
      tokens.push({ type: "boldItalic", content: match[4] });
    } else if (match[5] !== undefined) {
      tokens.push({ type: "bold", content: match[6] });
    } else if (match[7] !== undefined) {
      tokens.push({ type: "italic", content: match[8] });
    } else if (match[9] !== undefined) {
      tokens.push({ type: "code", content: match[10] });
    } else if (match[11] !== undefined) {
      tokens.push({ type: "link", text: match[12], href: match[13] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", content: text.slice(lastIndex) });
  }

  return tokens;
}

function InlineRenderer({ text, katexReady }: { text: string; katexReady: boolean }) {
  const tokens = useMemo(() => parseInlines(text), [text]);

  return (
    <>
      {tokens.map((token, idx) => {
        switch (token.type) {
          case "math":
            return <MathView key={idx} math={token.content} display={false} katexReady={katexReady} />;
          case "boldItalic":
            return (
              <strong key={idx}>
                <em>{token.content}</em>
              </strong>
            );
          case "bold":
            return <strong key={idx}>{token.content}</strong>;
          case "italic":
            return <em key={idx}>{token.content}</em>;
          case "code":
            return (
              <code key={idx} className="redcoach-inline-code">
                {token.content}
              </code>
            );
          case "link":
            return (
              <a
                key={idx}
                href={token.href}
                target="_blank"
                rel="noopener noreferrer"
                className="redcoach-link"
              >
                {token.text}
              </a>
            );
          case "text":
          default:
            return <React.Fragment key={idx}>{token.content}</React.Fragment>;
        }
      })}
    </>
  );
}

// Block token types
type BlockToken =
  | { type: "heading"; level: number; text: string }
  | { type: "blockMath"; content: string }
  | { type: "codeBlock"; lang?: string; content: string }
  | { type: "divider" }
  | { type: "blockquote"; text: string }
  | {
      type: "list";
      items: { indent: number; isOrdered: boolean; markerNumber?: string; text: string }[];
    }
  | { type: "paragraph"; text: string };

function parseBlocks(markdown: string): BlockToken[] {
  const raw = markdown.replace(/\r\n/g, "\n");
  const lines = raw.split("\n");
  const blocks: BlockToken[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 1. Skip completely blank lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // 2. Block Math: $$ ... $$
    if (line.trim().startsWith("$$")) {
      const trimmed = line.trim();
      if (trimmed.endsWith("$$") && trimmed.length > 3) {
        // Single-line block math
        const content = trimmed.slice(2, -2).trim();
        blocks.push({ type: "blockMath", content });
        i++;
        continue;
      }

      // Multi-line block math
      const mathLines: string[] = [trimmed.slice(2)];
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        if (nextLine.trim().endsWith("$$")) {
          mathLines.push(nextLine.trim().slice(0, -2));
          i++;
          break;
        } else {
          mathLines.push(nextLine);
          i++;
        }
      }
      blocks.push({ type: "blockMath", content: mathLines.join("\n").trim() });
      continue;
    }

    // 3. Fenced Code Block: ```
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      blocks.push({ type: "codeBlock", lang, content: codeLines.join("\n") });
      continue;
    }

    // 4. Horizontal Dividers: --- or *** or ___
    if (/^(?:---|\*\*\*|___)\s*$/.test(line.trim())) {
      blocks.push({ type: "divider" });
      i++;
      continue;
    }

    // 5. Headings: #, ##, ###, ####
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // 6. Blockquotes: > ...
    if (line.trim().startsWith(">")) {
      const quoteLines: string[] = [line.trim().replace(/^>\s?/, "")];
      i++;
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join("\n") });
      continue;
    }

    // 7. Unordered & Ordered Lists
    const listMatch = line.match(/^(\s*)([-*+]|(\d+)\.)\s+(.*)$/);
    if (listMatch) {
      const items: { indent: number; isOrdered: boolean; markerNumber?: string; text: string }[] =
        [];
      while (i < lines.length) {
        const itemMatch = lines[i].match(/^(\s*)([-*+]|(\d+)\.)\s+(.*)$/);
        if (!itemMatch) break;
        const indentSpaces = itemMatch[1].length;
        const isOrdered = Boolean(itemMatch[3]);
        items.push({
          indent: Math.floor(indentSpaces / 2),
          isOrdered,
          markerNumber: itemMatch[3],
          text: itemMatch[4],
        });
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    // 8. Regular Paragraph (combine lines until next block element or empty line)
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("$$") &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].match(/^(?:---|\*\*\*|___)\s*$/) &&
      !lines[i].match(/^#{1,6}\s+/) &&
      !lines[i].trim().startsWith(">") &&
      !lines[i].match(/^(\s*)([-*+]|\d+\.)\s+/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", text: paraLines.join("\n") });
  }

  return blocks;
}

export function RedCoachFormattedContent({ content }: { content: string }) {
  const katexReady = useKaTeX();
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <div className="redcoach-formatted-body">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "heading": {
            const isProTip = block.text.toLowerCase().includes("pro-tip");
            const HeadingTag = `h${Math.min(block.level, 4)}` as keyof JSX.IntrinsicElements;
            return (
              <HeadingTag
                key={idx}
                className={`redcoach-heading redcoach-h${block.level} ${
                  isProTip ? "redcoach-heading-protip" : ""
                }`}
              >
                <InlineRenderer text={block.text} katexReady={katexReady} />
              </HeadingTag>
            );
          }

          case "blockMath":
            return (
              <div key={idx} className="redcoach-math-block-container">
                <MathView math={block.content} display={true} katexReady={katexReady} />
              </div>
            );

          case "codeBlock":
            return (
              <pre key={idx} className="redcoach-code-block">
                <code>{block.content}</code>
              </pre>
            );

          case "divider":
            return <hr key={idx} className="redcoach-divider" />;

          case "blockquote":
            return (
              <blockquote key={idx} className="redcoach-blockquote">
                <InlineRenderer text={block.text} katexReady={katexReady} />
              </blockquote>
            );

          case "list":
            return (
              <ul key={idx} className="redcoach-list">
                {block.items.map((item, itemIdx) => (
                  <li
                    key={itemIdx}
                    className={`redcoach-list-item ${
                      item.isOrdered ? "is-ordered" : "is-bullet"
                    } indent-${item.indent}`}
                  >
                    {item.isOrdered && (
                      <span className="redcoach-list-num">{item.markerNumber}.</span>
                    )}
                    <span className="redcoach-list-text">
                      <InlineRenderer text={item.text} katexReady={katexReady} />
                    </span>
                  </li>
                ))}
              </ul>
            );

          case "paragraph":
          default: {
            const paraLines = block.text.split("\n");
            return (
              <p key={idx} className="redcoach-paragraph">
                {paraLines.map((lineText, lineIdx) => (
                  <React.Fragment key={lineIdx}>
                    <InlineRenderer text={lineText} katexReady={katexReady} />
                    {lineIdx < paraLines.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </p>
            );
          }
        }
      })}
    </div>
  );
}
