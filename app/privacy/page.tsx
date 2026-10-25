import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — RedBookPrep SAT Test Preparation',
  description: 'How RedBookPrep stores and protects your SAT practice history, mistake notebook, and optional Google Cloud synchronized account data.',
  alternates: { canonical: 'https://www.redbookprep.site/privacy' },
};

export default function Privacy() {
  return (
    <article className="public-document">
      <Link href="/">← RedBookPrep</Link>
      <span className="eyebrow">PRIVACY POLICY</span>
      <h1>Your study data,<br />explained plainly.</h1>
      <p>
        Updated October 25, 2026. This policy explains what information RedBookPrep collects, how your SAT study progress is stored on your device and in the cloud, and the controls you have over your data.
      </p>
      <h2>Local browser storage</h2>
      <p>
        When you use RedBookPrep without signing in, your practice answers, question timing, mistake causes, personal notes, review dates, unfinished practice sessions, and appearance preferences are stored in your browser’s local storage on this website’s origin. Other people using the same browser profile on the same device can access that local data.
      </p>
      <h2>Google Sign-In and Cloud Synchronization</h2>
      <p>
        If you choose to sign in with Google or create an email/password account via Firebase Authentication, RedBookPrep stores your profile identifier, display name, email address, practice attempts, mistake notes, score goals, and weekly study plan in Google Cloud Firestore so your progress can be restored across devices. Each student’s cloud document is isolated to their authenticated user ID.
      </p>
      <h2>Third-party services and trackers</h2>
      <p>
        RedBookPrep is hosted on Vercel and uses Google Firebase for optional authentication and cloud progress synchronization. We do not sell student data or display third-party behavioral advertising.
      </p>
      <h2>Your controls and data deletion</h2>
      <p>
        You can export a complete JSON backup of your attempts, notes, and review dates at any time from Settings. You can clear local browser storage using your browser’s site-data controls, or request complete deletion of your cloud-synced account data by emailing <a href="mailto:support@redbookprep.site">support@redbookprep.site</a>.
      </p>
      <p>
        <Link className="public-button" href="/study">Return to Study Workspace →</Link>
      </p>
      <p>
        <Link href="/about">About RedBookPrep</Link> · <Link href="/contact">Contact support</Link>
      </p>
    </article>
  );
}
