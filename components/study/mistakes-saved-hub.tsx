'use client';

import React, { useState } from 'react';
import { Bookmark, CheckCircle2, StickyNote, AlertCircle, ArrowUpRight } from 'lucide-react';
import type { PracticeQuestion } from './bbplus';
import type { QuestionCollection } from './collections';
import { MathText } from './math-text';
import { evaluateSprResponse } from '@/lib/sat-spr';
import { normalizeSlipCause } from '@/lib/supabase';

const SLIP_CAUSES = ['Concept Gap', 'Misread Question', 'Calculation Slip', 'Guessed'] as const;

type HubAttempt = {
  id: string;
  choice: number;
  sprResponse?: string;
  isCorrect?: boolean;
  seconds: number;
  date: string;
  review: string;
  note: string;
  cause: string;
};

export function MistakesAndSavedHub({
  questions,
  attempts,
  collections,
  questionNotes,
  domainFilter,
  domains,
  onDomainChange,
  onUpdateAttempt,
  onPracticeQuestion,
}: {
  questions: PracticeQuestion[];
  attempts: HubAttempt[];
  collections: QuestionCollection[];
  questionNotes: Record<string, string>;
  domainFilter: string;
  domains: string[];
  onDomainChange: (d: string) => void;
  onUpdateAttempt: (a: HubAttempt, patch: Partial<HubAttempt>) => void;
  onPracticeQuestion: (index: number) => void;
}) {
  const [tab, setTab] = useState<'review' | 'resolved' | 'collections' | 'notes'>('review');

  const isCorrect = (a: HubAttempt, q?: PracticeQuestion) => {
    if (typeof a.isCorrect === 'boolean') return a.isCorrect;
    if (!q) return false;
    return q.questionType === 'spr'
      ? evaluateSprResponse(a.sprResponse || '', q.sprAnswers || [])
      : a.choice === q.answer;
  };

  // Auto-resolution: group attempts by questionId
  const needsReview: { q: PracticeQuestion; attempt: HubAttempt }[] = [];
  const resolved: { q: PracticeQuestion; attempt: HubAttempt }[] = [];

  for (const q of questions) {
    if (domainFilter !== 'All domains' && q.domain !== domainFilter) continue;
    const rows = attempts.filter((a) => a.id === q.id);
    if (!rows.length) continue;
    const last = rows[rows.length - 1];
    const everMissed = rows.some((r) => !isCorrect(r, q));
    if (!everMissed) continue;
    if (!isCorrect(last, q)) {
      needsReview.push({ q, attempt: last });
    } else {
      resolved.push({ q, attempt: last });
    }
  }

  const noteEntries = Object.entries(questionNotes)
    .map(([id, text]) => ({ q: questions.find((item) => item.id === id), id, text }))
    .filter((entry) => entry.q && entry.text.trim());

  return (
    <section className="rb-mistakes-hub">
      <span className="eyebrow">UNDERSTAND. REVISIT. GROW.</span>
      <h1>Mistakes &amp; Saved Hub</h1>
      <p>
        Missed questions auto-resolve into Resolved once your latest retry is correct. Browse saved collections and notes anytime.
      </p>

      <div className="rb-hub-controls">
        <div className="segmented" role="tablist" aria-label="Mistakes and Saved tabs">
          <button type="button" role="tab" aria-pressed={tab === 'review'} onClick={() => setTab('review')}>
            <AlertCircle size={14} /> Needs Review ({needsReview.length})
          </button>
          <button type="button" role="tab" aria-pressed={tab === 'resolved'} onClick={() => setTab('resolved')}>
            <CheckCircle2 size={14} /> Resolved ({resolved.length})
          </button>
          <button type="button" role="tab" aria-pressed={tab === 'collections'} onClick={() => setTab('collections')}>
            <Bookmark size={14} /> Collections ({collections.reduce((n, c) => n + c.questionIds.length, 0)})
          </button>
          <button type="button" role="tab" aria-pressed={tab === 'notes'} onClick={() => setTab('notes')}>
            <StickyNote size={14} /> Notes ({noteEntries.length})
          </button>
        </div>

        {(tab === 'review' || tab === 'resolved') && (
          <label className="filter" style={{ margin: 0 }}>
            Domain
            <select value={domainFilter} onChange={(e) => onDomainChange(e.target.value)}>
              <option>All domains</option>
              {domains.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {tab === 'review' && (
        <>
          {needsReview.length === 0 ? (
            <section className="card">
              <h2>All caught up</h2>
              <p>No active unresolved mistakes in this domain. Keep practising to sharpen weaker skills.</p>
            </section>
          ) : (
            needsReview.map(({ q, attempt }) => (
              <details className="card mistake-detail" key={q.id}>
                <summary>
                  <span className="eyebrow">
                    {q.section} / {q.domain}
                  </span>
                  <h2>{q.skill}</h2>
                  <span className="material-status">Needs review</span>
                  <span className="expand-hint">Review details ⌄</span>
                </summary>
                <div className="mistake-body">
                  <div>
                    <MathText text={q.passage || q.prompt} />
                    <MathText text={q.explanation} />
                  </div>
                  <div style={{ display: 'grid', gap: '12px', alignContent: 'start' }}>
                    <label>
                      What happened?
                      <select
                        value={normalizeSlipCause(attempt.cause)}
                        onChange={(e) => onUpdateAttempt(attempt, { cause: normalizeSlipCause(e.target.value) })}
                      >
                        <option value="">Choose a cause</option>
                        {SLIP_CAUSES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Personal note
                      <textarea
                        value={attempt.note}
                        onChange={(e) => onUpdateAttempt(attempt, { note: e.target.value })}
                      />
                    </label>
                    <label>
                      Review date
                      <input
                        type="date"
                        value={attempt.review}
                        onChange={(e) => onUpdateAttempt(attempt, { review: e.target.value })}
                      />
                    </label>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => onPracticeQuestion(questions.findIndex((item) => item.id === q.id))}
                    >
                      Retry &amp; resolve <ArrowUpRight size={15} />
                    </button>
                  </div>
                </div>
              </details>
            ))
          )}
        </>
      )}

      {tab === 'resolved' && (
        <>
          {resolved.length === 0 ? (
            <section className="card">
              <h2>No resolved mistakes yet</h2>
              <p>When you retry and correctly solve a question you previously missed, it automatically moves here.</p>
            </section>
          ) : (
            resolved.map(({ q }) => (
              <section className="card rb-resolved-row" key={q.id}>
                <div>
                  <span className="eyebrow">{q.section} · {q.domain}</span>
                  <h3>{q.skill}</h3>
                  <small>Cleared on latest retry</small>
                </div>
                <button
                  type="button"
                  onClick={() => onPracticeQuestion(questions.findIndex((item) => item.id === q.id))}
                >
                  Revisit <ArrowUpRight size={15} />
                </button>
              </section>
            ))
          )}
        </>
      )}

      {tab === 'collections' && (
        <div className="rb-collections-grid">
          {collections.map((col) => (
            <section className="card" key={col.id}>
              <span className="eyebrow">COLLECTION · {col.questionIds.length} SAVED</span>
              <h2>{col.name}</h2>
              {col.questionIds.length === 0 ? (
                <p>Save any question from the Practice Solver using the Save button.</p>
              ) : (
                <div className="rb-collection-items">
                  {col.questionIds.map((id) => {
                    const idx = questions.findIndex((item) => item.id === id);
                    const q = questions[idx];
                    if (!q) return null;
                    return (
                      <div key={id} className="rb-resolved-row">
                        <div>
                          <strong>{q.skill}</strong>
                          <small>{q.domain}</small>
                        </div>
                        <button type="button" onClick={() => onPracticeQuestion(idx)}>
                          Open <ArrowUpRight size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {tab === 'notes' && (
        <>
          {noteEntries.length === 0 ? (
            <section className="card">
              <h2>No personal question notes yet</h2>
              <p>Use the Notes tab inside any Practice question to capture takeaways and trap warnings.</p>
            </section>
          ) : (
            noteEntries.map(({ q, id, text }) => (
              <section className="card" key={id}>
                <span className="eyebrow">{q!.section} · {q!.domain}</span>
                <h2>{q!.skill}</h2>
                <p style={{ whiteSpace: 'pre-wrap' }}>{text}</p>
                <button
                  type="button"
                  onClick={() => onPracticeQuestion(questions.findIndex((item) => item.id === id))}
                >
                  Open question <ArrowUpRight size={15} />
                </button>
              </section>
            ))
          )}
        </>
      )}
    </section>
  );
}
