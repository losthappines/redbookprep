'use client';

import { ArrowRight, BookOpen, BookmarkCheck, Clock } from 'lucide-react';

export function LessonsView({
  onPractice,
  onDashboard,
}: {
  onPractice: () => void;
  onDashboard: () => void;
}) {
  return (
    <section className="lessons-view" aria-labelledby="lessons-heading">
      <div className="rb-page-heading">
        <div>
          <span className="eyebrow">GUIDED LESSONS · IN DEVELOPMENT</span>
          <h1 id="lessons-heading">Lessons</h1>
          <p>Structured Digital SAT lessons are currently being worked on.</p>
        </div>
        <small>Coming soon</small>
      </div>

      <div className="rb-ib-frame rb-ib-frame-hover" data-in="true">
        <span className="rb-ib-c rb-ib-c-tl" aria-hidden="true" />
        <span className="rb-ib-c rb-ib-c-tr" aria-hidden="true" />
        <span className="rb-ib-c rb-ib-c-bl" aria-hidden="true" />
        <span className="rb-ib-c rb-ib-c-br" aria-hidden="true" />
        <article className="card rb-dash-surface lessons-empty-card">
          <div className="lessons-empty-badge" aria-hidden="true">
            <BookmarkCheck size={28} />
          </div>
          <span className="lessons-status-pill">
            <Clock size={13} />
            Being developed
          </span>
          <h2>Lessons are under construction.</h2>
          <p>
            We are building step-by-step Reading &amp; Writing and Math lessons for this space.
            In the meantime, you can practise 410+ categorized questions or review your study plan.
          </p>
          <div className="rb-actions">
            <button type="button" className="primary" onClick={onPractice}>
              <BookOpen size={17} />
              Go to Practice
            </button>
            <button type="button" onClick={onDashboard}>
              Back to Dashboard
              <ArrowRight size={16} />
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
