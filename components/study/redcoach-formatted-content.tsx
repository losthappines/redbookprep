"use client";

import React, { useMemo } from "react";

// Convert any accidental LaTeX delimiters/commands into clean, readable Unicode plain text
function cleanToPlainTextMath(text: string): string {
  if (!text) return "";
  return text
    // Strip block and inline dollar delimiters and math parentheses
    .replace(/\$\$/g, "")
    .replace(/\\\[|\\\]|\\\(|\\\)/g, "")
    // Fix malformed fragments like $}{(
    .replace(/\$\}\s*\{?/g, "")
    // Convert LaTeX fractions \frac{a}{b} -> (a)/(b)
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)")
    // Convert square roots \sqrt{x} -> √(x)
    .replace(/\\sqrt\{([^{}]+)\}/g, "√($1)")
    .replace(/\\sqrt\b/g, "√")
    // Convert math symbols
    .replace(/\\neq\b/g, "≠")
    .replace(/\\leq?\b/g, "≤")
    .replace(/\\geq?\b/g, "≥")
    .replace(/\\times\b/g, "×")
    .replace(/\\div\b/g, "÷")
    .replace(/\\pm\b/g, "±")
    .replace(/\\pi\b/g, "π")
    .replace(/\\cdot\b/g, "·")
    // Convert exponents ^2 -> ², ^3 -> ³
    .replace(/\^2\b/g, "²")
    .replace(/\^3\b/g, "³")
    // Convert cases environment
    .replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (_, body: string) =>
      body
        .split("\\\\")
        .map((s: string) => s.trim())
        .filter(Boolean)
        .join("\n")
    )
    // Strip any remaining lone dollar signs around mathematical terms
    .replace(/\$([^$\n]+)\$/g, "$1")
    .replace(/\$/g, "");
}

// Inline token types
type InlineToken =
  | { type: "text"; content: string }
  | { type: "boldItalic"; content: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "code"; content: string }
  | { type: "link"; text: string; href: string };

function parseInlines(text: string): InlineToken[] {
  const regex =
    /(\*\*\*(.*?)\*\*\*)|(\*\*(.*?)\*\*)|(\*(.*?)\*)|(`([^`]+)`)|(\[(.*?)\]\((https?:\/\/[^\s)]+)\))/g;
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      tokens.push({ type: "boldItalic", content: match[2] });
    } else if (match[3] !== undefined) {
      tokens.push({ type: "bold", content: match[4] });
    } else if (match[5] !== undefined) {
      tokens.push({ type: "italic", content: match[6] });
    } else if (match[7] !== undefined) {
      tokens.push({ type: "code", content: match[8] });
    } else if (match[9] !== undefined) {
      tokens.push({ type: "link", text: match[10], href: match[11] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", content: text.slice(lastIndex) });
  }

  return tokens;
}

function InlineRenderer({ text }: { text: string }) {
  const tokens = useMemo(() => parseInlines(text), [text]);

  return (
    <>
      {tokens.map((token, idx) => {
        switch (token.type) {
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

    // 2. Fenced Code Block: ```
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

    // 3. Horizontal Dividers: --- or *** or ___
    if (/^(?:---|\*\*\*|___)\s*$/.test(line.trim())) {
      blocks.push({ type: "divider" });
      i++;
      continue;
    }

    // 4. Headings: #, ##, ###, ####
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

    // 5. Blockquotes: > ...
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

    // 6. Unordered & Ordered Lists
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

    // 7. Regular Paragraph (combine lines until next block element or empty line)
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
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
  const cleanedContent = useMemo(() => cleanToPlainTextMath(content), [content]);
  const blocks = useMemo(() => parseBlocks(cleanedContent), [cleanedContent]);

  return (
    <div className="redcoach-formatted-body">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "heading": {
            const isProTip = block.text.toLowerCase().includes("pro-tip");
            const cls = `redcoach-heading redcoach-h${block.level} ${
              isProTip ? "redcoach-heading-protip" : ""
            }`;
            if (block.level <= 2) {
              return (
                <h2 key={idx} className={cls}>
                  <InlineRenderer text={block.text} />
                </h2>
              );
            }
            if (block.level === 3) {
              return (
                <h3 key={idx} className={cls}>
                  <InlineRenderer text={block.text} />
                </h3>
              );
            }
            return (
              <h4 key={idx} className={cls}>
                <InlineRenderer text={block.text} />
              </h4>
            );
          }

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
                <InlineRenderer text={block.text} />
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
                      <InlineRenderer text={item.text} />
                    </span>
                  </li>
                ))}
              </ul>
            );

          case "paragraph":
          default: {
            const lines = block.text.split("\n");
            return (
              <p key={idx} className="redcoach-paragraph">
                {lines.map((lineText, lineIdx) => (
                  <React.Fragment key={lineIdx}>
                    <InlineRenderer text={lineText} />
                    {lineIdx < lines.length - 1 && <br />}
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
