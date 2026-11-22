'use client';

import React, { useState } from 'react';
import { Calculator as CalcIcon, Clock, Layers } from 'lucide-react';
import type { PracticeQuestion } from './bbplus';
import { MathText } from './math-text';

const DOMAIN_IQR_DEFAULTS: Record<string, { p25: number; p50: number; p75: number }> = {
  Algebra: { p25: 34, p50: 55, p75: 84 },
  'Advanced Math': { p25: 42, p50: 68, p75: 102 },
  'Problem-Solving and Data Analysis': { p25: 38, p50: 62, p75: 94 },
  'Geometry and Trigonometry': { p25: 40, p50: 66, p75: 98 },
  'Information and Ideas': { p25: 44, p50: 68, p75: 98 },
  'Craft and Structure': { p25: 36, p50: 56, p75: 82 },
  'Expression of Ideas': { p25: 38, p50: 58, p75: 86 },
  'Standard English Conventions': { p25: 24, p50: 38, p75: 58 },
};

export function SolverFeedbackAddons({
  question,
  studentSeconds,
  onOpenDesmos,
}: {
  question: PracticeQuestion;
  studentSeconds: number;
  onOpenDesmos?: (expressions: string[]) => void;
}) {
  const methods = question.explanationMethods && question.explanationMethods.length > 0
    ? question.explanationMethods
    : null;
  const [methodIdx, setMethodIdx] = useState(0);

  const activeMethod = methods ? methods[Math.min(methodIdx, methods.length - 1)] : null;
  const desmosExprs =
    activeMethod?.desmosExpressions && activeMethod.desmosExpressions.length > 0
      ? activeMethod.desmosExpressions
      : question.desmosExpressions;

  const iqr = question.peerTimeSeconds || DOMAIN_IQR_DEFAULTS[question.domain] || { p25: 36, p50: 58, p75: 88 };
  const maxAxis = Math.max(120, iqr.p75 * 1.45, studentSeconds + 10);
  const pct = (sec: number) => `${Math.max(2, Math.min(98, (sec / maxAxis) * 100)).toFixed(1)}%`;

  return (
    <div className="rb-feedback-addons">
      {methods ? (
        <div className="rb-methods-wrap">
          <div className="rb-methods-tabs" role="tablist" aria-label="Solution approaches">
            {methods.map((m, idx) => (
              <button
                key={m.title + idx}
                type="button"
                role="tab"
                aria-selected={methodIdx === idx}
                className={`pane-tab-btn ${methodIdx === idx ? 'active' : ''}`}
                onClick={() => setMethodIdx(idx)}
              >
                <Layers size={13} />
                <span>{m.title}</span>
                {m.badge && <em className="rb-method-badge">{m.badge}</em>}
              </button>
            ))}
          </div>
          {activeMethod && (
            <ol className="rb-method-steps">
              {activeMethod.steps.map((step, sIdx) => (
                <li key={sIdx}>
                  <MathText inline text={step} />
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : (
        <div className="result-explanation-body">
          <MathText text={question.explanation} />
        </div>
      )}

      {question.section === 'Math' && desmosExprs && desmosExprs.length > 0 && onOpenDesmos && (
        <div className="rb-desmos-shortcut-row">
          <button
            type="button"
            className="header-tool-btn active"
            onClick={() => onOpenDesmos(desmosExprs)}
          >
            <CalcIcon size={14} />
            <span>Open equations in Desmos ({desmosExprs.length})</span>
          </button>
        </div>
      )}

      <div className="rb-pacing-boxplot" aria-label="Time comparison against SAT pacing benchmarks">
        <div className="rb-pacing-head">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={13} /> Your pacing: <strong>{studentSeconds}s</strong>
          </span>
          <small>
            Benchmark IQR: {iqr.p25}s – {iqr.p75}s (median {iqr.p50}s)
          </small>
        </div>
        <div className="rb-boxplot-track">
          <div
            className="rb-boxplot-iqr"
            style={{
              left: pct(iqr.p25),
              width: `calc(${pct(iqr.p75)} - ${pct(iqr.p25)})`,
            }}
          />
          <div className="rb-boxplot-median" style={{ left: pct(iqr.p50) }} title={`Median ${iqr.p50}s`} />
          <div
            className={`rb-boxplot-you ${studentSeconds <= iqr.p75 ? 'is-fast' : 'is-slow'}`}
            style={{ left: pct(studentSeconds) }}
            title={`Your time: ${studentSeconds}s`}
          />
        </div>
      </div>
    </div>
  );
}
