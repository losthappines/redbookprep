import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'RedBookPrep — Digital SAT Test Preparation';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #311042 100%)',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', fontSize: '32px', fontWeight: 700 }}>
          <svg width="54" height="54" viewBox="0 0 192 192" fill="none">
            <rect x="6" y="6" width="180" height="180" rx="56" fill="#FA5216" />
            <rect x="45" y="34" width="102" height="124" rx="18" fill="#FFFFFF" />
            <path d="M90 45H122V90L106 80L90 90V45Z" fill="#FA5216" />
          </svg>
          <span>RedBookPrep</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ fontSize: '64px', fontWeight: 800, lineHeight: 1.1 }}>
            Digital SAT Test Preparation &amp; Practice Platform
          </div>
          <div style={{ fontSize: '28px', color: '#cbd5e1', maxWidth: '960px', lineHeight: 1.4 }}>
            410+ Mathbook 3.0 practice questions, split-screen Bluebook-style player, mistake notebook, and cloud study planner.
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '22px', color: '#94a3b8' }}>
          <span>www.redbookprep.site</span>
          <span>A little practice. More possibility.</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
