'use client';

import React, { useState } from 'react';
import { HelpCircle, Check, X } from 'lucide-react';
import { SAT_SPR_RULES, validateSprInput } from '@/lib/sat-spr';

export function SprInput({
  value,
  submitted,
  isCorrect,
  acceptableAnswers,
  onChange,
  onSubmit,
}: {
  value: string;
  submitted: boolean;
  isCorrect?: boolean;
  acceptableAnswers: string[];
  onChange: (next: string) => void;
  onSubmit?: () => void;
}) {
  const [showRules, setShowRules] = useState(false);
  const validation = value.trim() ? validateSprInput(value) : { valid: true };
  const isNeg = value.trim().startsWith('-');
  const maxChars = isNeg ? 6 : 5;

  return (
    <div className="rb-spr-box">
      <div className="rb-spr-header">
        <div>
          <span className="eyebrow">STUDENT-PRODUCED RESPONSE</span>
          <p className="rb-spr-sub">Enter a whole number, decimal, or fraction ({maxChars} chars max).</p>
        </div>
        <button
          type="button"
          className="header-tool-btn rb-spr-help-btn"
          aria-expanded={showRules}
          onClick={() => setShowRules((v) => !v)}
        >
          <HelpCircle size={14} />
          <span>SAT answer format</span>
        </button>
      </div>

      {showRules && (
        <div className="rb-spr-rules" role="region" aria-label="SAT Student-Produced Response format rules">
          <div className="rb-spr-rules-head">
            <strong>Official SAT Grid-In Directions</strong>
            <button type="button" aria-label="Close directions" onClick={() => setShowRules(false)}>
              <X size={14} />
            </button>
          </div>
          <ul>
            {SAT_SPR_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={`rb-spr-field-wrap ${submitted ? (isCorrect ? 'is-correct' : 'is-incorrect') : ''}`}>
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          disabled={submitted}
          maxLength={6}
          aria-label="Student-produced numeric response"
          className="rb-spr-input"
          placeholder="e.g. 24, 3/4, -1.5, .75"
          value={value}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9./-]/g, '');
            onChange(raw);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !submitted && validation.valid && value.trim() && onSubmit) {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
        <div className="rb-spr-meta">
          <span>
            {value.trim().length}/{maxChars} chars
          </span>
          {typeof validation.numericValue === 'number' && value.includes('/') && (
            <span className="rb-spr-preview">≈ {Number(validation.numericValue.toFixed(4))}</span>
          )}
        </div>
      </div>

      {value.trim() && !validation.valid && (
        <p className="rb-spr-error" role="alert">
          {validation.reason}
        </p>
      )}

      {submitted && acceptableAnswers.length > 0 && (
        <div className="rb-spr-accepted">
          <Check size={14} />
          <span>
            Accepted answer{acceptableAnswers.length > 1 ? 's' : ''}:{' '}
            <strong>{acceptableAnswers.join(' or ')}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
