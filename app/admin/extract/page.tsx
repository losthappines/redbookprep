'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Check, Download, ChevronLeft, Eye, RefreshCw } from 'lucide-react';
import { MathText, SafeSvgDiagram } from '@/components/study/math-text';
import { SprInput } from '@/components/study/spr-input';

type PackKey = 'algebra' | 'advanced-math' | 'problem-solving' | 'geometry-trigonometry';

interface RawPackQuestion {
  prompt: string;
  passage?: string;
  questionType?: 'mcq' | 'spr';
  options?: string[];
  answer?: number;
  sprAnswers?: string[];
  explanation?: string;
  imageDataUrl?: string;
  svgDiagram?: string;
  desmosExpressions?: string[];
  explanationMethods?: any[];
  difficulty?: number;
  skill?: string;
  domain?: string;
}

interface RawPack {
  format: string;
  version: number;
  title: string;
  modules: {
    title: string;
    section: string;
    questions: RawPackQuestion[];
  }[];
}

export default function AdminExtractPage() {
  const [packKey, setPackKey] = useState<PackKey>('algebra');
  const [pack, setPack] = useState<RawPack | null>(null);
  const [selectedRef, setSelectedRef] = useState<{ mi: number; qi: number }>({ mi: 0, qi: 0 });
  const [onlyPending, setOnlyPending] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    setStatus('Loading pack…');
    fetch(`/packs/mathbook-3/${packKey}.bbplus`)
      .then((r) => r.json())
      .then((data: RawPack) => {
        setPack(data);
        setSelectedRef({ mi: 0, qi: 0 });
        setStatus('');
      })
      .catch(() => setError('Could not load Mathbook 3.0 pack.'));
  }, [packKey]);

  const flatItems =
    pack?.modules.flatMap((m, mi) =>
      m.questions.map((q, qi) => ({
        mi,
        qi,
        moduleTitle: m.title,
        q,
        needsExtraction:
          Boolean(q.imageDataUrl) &&
          ((q.options || []).some((o) => o.includes('(as printed)')) ||
            (q.prompt || '').includes('Question ') ||
            (q.prompt || '').includes('Select the correct printed answer choice')),
      }))
    ) || [];

  const filteredItems = onlyPending ? flatItems.filter((item) => item.needsExtraction) : flatItems;
  const currentMod = pack?.modules[selectedRef.mi];
  const currentQ = currentMod?.questions[selectedRef.qi];

  const updateCurrentQuestion = (patch: Partial<RawPackQuestion>) => {
    if (!pack) return;
    setPack({
      ...pack,
      modules: pack.modules.map((m, mi) =>
        mi !== selectedRef.mi
          ? m
          : {
              ...m,
              questions: m.questions.map((q, qi) =>
                qi !== selectedRef.qi ? q : { ...q, ...patch }
              ),
            }
      ),
    });
  };

  const runGeminiExtract = async () => {
    if (!currentQ?.imageDataUrl) {
      setError('This question has no cropped image to extract.');
      return;
    }
    setExtracting(true);
    setError('');
    setStatus('Running Gemini Vision OCR + LaTeX + SVG + Desmos synthesis…');
    try {
      const res = await fetch('/api/admin/extract-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: currentQ.imageDataUrl,
          promptHint: currentQ.prompt,
          moduleTitle: currentMod?.title,
          domain: pack?.title,
          answerHint: currentQ.answer,
          sprAnswersHint: currentQ.sprAnswers,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.extracted) {
        throw new Error(data?.error || 'Extraction failed.');
      }
      const ex = data.extracted;
      updateCurrentQuestion({
        questionType: ex.questionType || (currentQ.sprAnswers?.length ? 'spr' : 'mcq'),
        passage: ex.passage || '',
        prompt: ex.prompt || currentQ.prompt,
        options:
          (ex.questionType || (currentQ.sprAnswers?.length ? 'spr' : 'mcq')) === 'mcq' &&
          Array.isArray(ex.options) &&
          ex.options.length === 4
            ? ex.options
            : currentQ.options,
        sprAnswers: Array.isArray(ex.sprAnswers) && ex.sprAnswers.length ? ex.sprAnswers : currentQ.sprAnswers,
        svgDiagram: ex.svgDiagram || '',
        explanation: ex.explanation || currentQ.explanation,
        explanationMethods: Array.isArray(ex.explanationMethods) ? ex.explanationMethods : undefined,
        desmosExpressions: Array.isArray(ex.desmosExpressions) ? ex.desmosExpressions : undefined,
        difficulty: typeof ex.difficulty === 'number' ? ex.difficulty : undefined,
      });
      setStatus('Extracted native Markdown + LaTeX! Review carefully before exporting.');
    } catch (err: any) {
      setError(err?.message || 'Could not extract question.');
      setStatus('');
    } finally {
      setExtracting(false);
    }
  };

  const exportPackJson = () => {
    if (!pack) return;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${packKey}.bbplus`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <main className="rb-public" style={{ minHeight: '100dvh', padding: '24px' }}>
      <header style={{ maxWidth: '1280px', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link className="rb-public-button" href="/study">
            <ChevronLeft size={16} /> Back to Study
          </Link>
          <div>
            <span className="rb-eyebrow">ADMIN CONTENT PIPELINE</span>
            <h1 style={{ fontSize: '1.5rem', margin: '4px 0 0' }}>Mathbook 3.0 Native Extractor</h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            aria-label="Choose Mathbook pack"
            value={packKey}
            onChange={(e) => setPackKey(e.target.value as PackKey)}
            style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(128,128,128,.3)', background: 'transparent', color: 'inherit' }}
          >
            <option value="algebra">Algebra</option>
            <option value="advanced-math">Advanced Math</option>
            <option value="problem-solving">Problem-Solving & Data</option>
            <option value="geometry-trigonometry">Geometry & Trigonometry</option>
          </select>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '.85rem' }}>
            <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
            Pending only ({flatItems.filter((i) => i.needsExtraction).length}/{flatItems.length})
          </label>
          <button type="button" className="rb-public-button primary" onClick={exportPackJson} disabled={!pack}>
            <Download size={16} /> Export {packKey}.bbplus
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '280px minmax(0,1fr)', gap: '20px', alignItems: 'start' }}>
        <aside style={{ border: '1px solid rgba(128,128,128,.22)', borderRadius: '18px', padding: '12px', maxHeight: '78dvh', overflowY: 'auto', display: 'grid', gap: '6px' }}>
          {filteredItems.map((item) => {
            const active = item.mi === selectedRef.mi && item.qi === selectedRef.qi;
            return (
              <button
                key={`${item.mi}-${item.qi}`}
                type="button"
                onClick={() => setSelectedRef({ mi: item.mi, qi: item.qi })}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: active ? '1px solid #c96442' : '1px solid transparent',
                  background: active ? 'rgba(201,100,66,.14)' : 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: '.82rem',
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {item.moduleTitle} #{item.qi + 1}
                </div>
                <div style={{ opacity: 0.7, fontSize: '.74rem' }}>
                  {item.q.questionType === 'spr' ? 'SPR Grid-In' : 'MCQ'} ·{' '}
                  {item.needsExtraction ? 'Needs OCR' : 'Native Ready'}
                </div>
              </button>
            );
          })}
        </aside>

        {currentQ && (
          <section style={{ display: 'grid', gap: '18px' }}>
            <div style={{ border: '1px solid rgba(128,128,128,.22)', borderRadius: '18px', padding: '18px', display: 'grid', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <strong>
                  {currentMod?.title} — Question {selectedRef.qi + 1}
                </strong>
                <button
                  type="button"
                  className="rb-public-button primary"
                  disabled={extracting || !currentQ.imageDataUrl}
                  onClick={runGeminiExtract}
                >
                  {extracting ? <RefreshCw size={15} /> : <Sparkles size={15} />}
                  <span>{extracting ? 'Extracting…' : 'AI Extract with Gemini Vision'}</span>
                </button>
              </div>
              {status && <p style={{ margin: 0, fontSize: '.85rem', color: '#10b981' }}>{status}</p>}
              {error && <p style={{ margin: 0, fontSize: '.85rem', color: '#ef4444' }}>{error}</p>}

              {currentQ.imageDataUrl && (
                <div>
                  <span className="rb-eyebrow">SOURCE CROPPED IMAGE</span>
                  <img
                    src={currentQ.imageDataUrl}
                    alt="Source mathbook question"
                    style={{ maxWidth: '100%', maxHeight: '360px', borderRadius: '10px', marginTop: '8px', background: '#fff' }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
              <div style={{ border: '1px solid rgba(128,128,128,.22)', borderRadius: '18px', padding: '18px', display: 'grid', gap: '12px' }}>
                <span className="rb-eyebrow">EDIT EXTRACTED JSON FIELDS</span>
                <label style={{ display: 'grid', gap: '6px', fontSize: '.82rem' }}>
                  Prompt (Markdown + $LaTeX$)
                  <textarea
                    rows={4}
                    value={currentQ.prompt}
                    onChange={(e) => updateCurrentQuestion({ prompt: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid rgba(128,128,128,.28)', background: 'transparent', color: 'inherit' }}
                  />
                </label>

                {currentQ.questionType === 'spr' ? (
                  <label style={{ display: 'grid', gap: '6px', fontSize: '.82rem' }}>
                    SPR Answers (comma separated)
                    <input
                      value={(currentQ.sprAnswers || []).join(', ')}
                      onChange={(e) =>
                        updateCurrentQuestion({
                          sprAnswers: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid rgba(128,128,128,.28)', background: 'transparent', color: 'inherit' }}
                    />
                  </label>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {(currentQ.options || ['', '', '', '']).map((opt, idx) => (
                      <label key={idx} style={{ display: 'grid', gap: '4px', fontSize: '.8rem' }}>
                        Choice {'ABCD'[idx]} {currentQ.answer === idx ? '(Correct)' : ''}
                        <input
                          value={opt}
                          onChange={(e) => {
                            const next = [...(currentQ.options || ['', '', '', ''])];
                            next[idx] = e.target.value;
                            updateCurrentQuestion({ options: next });
                          }}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid rgba(128,128,128,.28)', background: 'transparent', color: 'inherit' }}
                        />
                      </label>
                    ))}
                  </div>
                )}

                <label style={{ display: 'grid', gap: '6px', fontSize: '.82rem' }}>
                  Worked Explanation
                  <textarea
                    rows={4}
                    value={currentQ.explanation || ''}
                    onChange={(e) => updateCurrentQuestion({ explanation: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid rgba(128,128,128,.28)', background: 'transparent', color: 'inherit' }}
                  />
                </label>

                <label style={{ display: 'grid', gap: '6px', fontSize: '.82rem' }}>
                  SVG Diagram (optional)
                  <textarea
                    rows={3}
                    value={currentQ.svgDiagram || ''}
                    onChange={(e) => updateCurrentQuestion({ svgDiagram: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid rgba(128,128,128,.28)', background: 'transparent', color: 'inherit', fontFamily: 'monospace' }}
                  />
                </label>
              </div>

              <div style={{ border: '1px solid rgba(128,128,128,.22)', borderRadius: '18px', padding: '18px', display: 'grid', gap: '14px', alignContent: 'start' }}>
                <span className="rb-eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Eye size={14} /> LIVE STUDENT PREVIEW
                </span>
                {currentQ.svgDiagram && <SafeSvgDiagram svg={currentQ.svgDiagram} />}
                <MathText text={currentQ.prompt} />
                {currentQ.questionType === 'spr' ? (
                  <SprInput
                    value=""
                    submitted={true}
                    isCorrect={true}
                    acceptableAnswers={currentQ.sprAnswers || []}
                    onChange={() => {}}
                  />
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {(currentQ.options || []).map((opt, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: currentQ.answer === idx ? '1px solid #10b981' : '1px solid rgba(128,128,128,.2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <strong>{'ABCD'[idx]}</strong>
                        <MathText inline text={opt} />
                        {currentQ.answer === idx && <Check size={14} className="text-emerald-500" />}
                      </div>
                    ))}
                  </div>
                )}
                {currentQ.explanation && (
                  <div style={{ borderTop: '1px solid rgba(128,128,128,.2)', paddingTop: '12px', fontSize: '.88rem' }}>
                    <strong>Explanation</strong>
                    <MathText text={currentQ.explanation} />
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
