'use client';

import React from 'react';

/**
 * Lightweight, zero-dependency Digital SAT Markdown + LaTeX + SVG renderer.
 * Supports:
 * - Inline `$...$` and display `$$...$$` math blocks
 * - Common SAT LaTeX: \frac{a}{b}, \sqrt{x}, \pi, \theta, \le, \ge, \neq, \times, \div, \pm, \cdot, ^{...}, _{...}
 * - Paragraphs (`\n\n`), bold `**...**`, italics `*...*`, underline `<u>...</u>`
 */

function latexToReadable(tex: string): string {
  let s = tex.trim();

  // Iteratively expand nested \frac{a}{b} up to 3 levels
  for (let i = 0; i < 3; i += 1) {
    s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
  }
  s = s
    .replace(/\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, '$1√($2)')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
    .replace(/\\text\{([^{}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^{}]+)\}/g, '$1')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\left\[/g, '[')
    .replace(/\\right\]/g, ']')
    .replace(/\\left\|/g, '|')
    .replace(/\\right\|/g, '|')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\leq?/g, '≤')
    .replace(/\\geq?/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\pi\b/g, 'π')
    .replace(/\\theta\b/g, 'θ')
    .replace(/\\alpha\b/g, 'α')
    .replace(/\\beta\b/g, 'β')
    .replace(/\\infty/g, '∞')
    .replace(/\\circ/g, '°')
    .replace(/\^\{\\circ\}/g, '°')
    .replace(/\^\\circ/g, '°')
    .replace(/\\degree/g, '°')
    .replace(/\\%/g, '%')
    .replace(/\\,/g, ' ');

  return s;
}

function renderInlineFormatting(text: string, keyPrefix: string): React.ReactNode[] {
  // Split out display math $$...$$, inline math $...$, underline <u>...</u>, bold **...**
  const tokenRe = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|<u>[\s\S]+?<\/u>|\*\*[^*]+\*\*)/g;
  const parts = text.split(tokenRe);

  return parts.map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (!part) return null;

    if (part.startsWith('$$') && part.endsWith('$$')) {
      const inner = latexToReadable(part.slice(2, -2));
      return (
        <span key={key} className="rb-math-display">
          {renderSupSub(inner, key)}
        </span>
      );
    }

    if (part.startsWith('$') && part.endsWith('$')) {
      const inner = latexToReadable(part.slice(1, -1));
      return (
        <span key={key} className="rb-math-inline">
          {renderSupSub(inner, key)}
        </span>
      );
    }

    if (part.startsWith('<u>') && part.endsWith('</u>')) {
      return <u key={key}>{part.slice(3, -4)}</u>;
    }

    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }

    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

function renderSupSub(expr: string, keyPrefix: string): React.ReactNode[] {
  const supSubRe = /(\^\{[^{}]+\}|\^[A-Za-z0-9\-]+|_\{[^{}]+\}|_[A-Za-z0-9]+)/g;
  const segments = expr.split(supSubRe);
  return segments.map((seg, i) => {
    const key = `${keyPrefix}-m-${i}`;
    if (!seg) return null;
    if (seg.startsWith('^{') && seg.endsWith('}')) {
      return <sup key={key}>{seg.slice(2, -1)}</sup>;
    }
    if (seg.startsWith('^')) {
      return <sup key={key}>{seg.slice(1)}</sup>;
    }
    if (seg.startsWith('_{') && seg.endsWith('}')) {
      return <sub key={key}>{seg.slice(2, -1)}</sub>;
    }
    if (seg.startsWith('_')) {
      return <sub key={key}>{seg.slice(1)}</sub>;
    }
    return <React.Fragment key={key}>{seg}</React.Fragment>;
  });
}

export function MathText({
  text,
  className,
  inline = false,
}: {
  text: string;
  className?: string;
  inline?: boolean;
}) {
  if (!text) return null;

  if (inline) {
    return <span className={className}>{renderInlineFormatting(text, 'inline')}</span>;
  }

  const paragraphs = text.split(/\n{2,}/);
  return (
    <div className={className}>
      {paragraphs.map((para, pIdx) => (
        <p key={pIdx}>{renderInlineFormatting(para, `p-${pIdx}`)}</p>
      ))}
    </div>
  );
}

/**
 * Sanitizes and renders crisp SVG diagrams authored by our extraction pipeline.
 * Strips `<script>`, `<foreignObject>`, and inline event attributes before injection.
 */
export function SafeSvgDiagram({ svg, alt }: { svg: string; alt?: string }) {
  if (!svg || !svg.includes('<svg')) return null;
  const cleaned = svg
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, '');

  return (
    <figure className="rb-svg-diagram" aria-label={alt || 'Question geometric diagram'}>
      <div dangerouslySetInnerHTML={{ __html: cleaned }} />
    </figure>
  );
}
