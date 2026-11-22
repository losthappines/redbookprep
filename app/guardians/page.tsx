import Link from 'next/link';
import { ShieldCheck, Mail, Calendar, Award, ChevronLeft } from 'lucide-react';

export const metadata = {
  title: 'Guardian Progress Portal — RedBookPrep',
  description: 'Read-only SAT study progress snapshot and parent sponsorship portal on RedBookPrep.',
  alternates: { canonical: 'https://www.redbookprep.site/guardians' },
};

export default async function GuardiansPortalPage({
  searchParams,
}: {
  searchParams?: Promise<{ student?: string; target?: string; sponsor?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const studentName = params?.student || 'Student';
  const targetScore = params?.target || '1450';
  const sponsorPrompt = params?.sponsor === 'true';

  return (
    <article className="public-document" style={{ maxWidth: '760px' }}>
      <Link href="/study">
        <ChevronLeft size={16} style={{ display: 'inline' }} /> Back to Study Workspace
      </Link>
      <span className="eyebrow">GUARDIAN PORTAL · READ-ONLY PROGRESS &amp; SPONSORSHIP</span>
      <h1>{studentName}’s Digital SAT Progress</h1>
      <p>
        Parents and guardians can view weekly SAT consistency, target milestones, and optionally sponsor a Plus or Pro upgrade without touching the student’s study settings.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          margin: '24px 0',
        }}
      >
        <div style={{ padding: '18px', borderRadius: '16px', border: '1px solid rgba(128,128,128,.22)' }}>
          <Award size={18} />
          <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '6px' }}>{targetScore}</div>
          <small>Target SAT Score</small>
        </div>
        <div style={{ padding: '18px', borderRadius: '16px', border: '1px solid rgba(128,128,128,.22)' }}>
          <Calendar size={18} />
          <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '6px' }}>Weekly Digest</div>
          <small>Opt-in Sunday summary email</small>
        </div>
        <div style={{ padding: '18px', borderRadius: '16px', border: '1px solid rgba(128,128,128,.22)' }}>
          <ShieldCheck size={18} />
          <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '6px' }}>Private RLS</div>
          <small>Read-only student-controlled access</small>
        </div>
      </div>

      {sponsorPrompt && (
        <section
          style={{
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid rgba(201,100,66,.45)',
            background: 'rgba(201,100,66,.08)',
            margin: '20px 0',
          }}
        >
          <strong>{studentName} invited you to sponsor RedBookPrep Plus or Pro</strong>
          <p style={{ margin: '8px 0 14px' }}>
            Unlock unlimited AI coaching Sparks, unlimited full-length adaptive mock exams, and automated study schedule adjustments.
          </p>
          <Link className="public-button" href="/study?tab=settings">
            <Mail size={15} /> Open Billing &amp; Plans
          </Link>
        </section>
      )}

      <p>
        <Link className="public-button" href="/study">
          Open RedBookPrep Study Workspace →
        </Link>
      </p>
    </article>
  );
}
