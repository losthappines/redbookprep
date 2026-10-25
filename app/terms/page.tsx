import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — RedBookPrep SAT Test Preparation',
  description: 'Terms of Service, acceptable use, educational disclaimers, and limitation of liability for RedBookPrep.',
  alternates: { canonical: 'https://www.redbookprep.site/terms' },
};

export default function TermsPage() {
  return (
    <article className="public-document">
      <Link href="/">← RedBookPrep</Link>
      <span className="eyebrow">TERMS OF SERVICE</span>
      <h1>Clear rules for a calm study space.</h1>
      <p>
        Updated October 25, 2026. By accessing or using RedBookPrep (<a href="https://www.redbookprep.site">https://www.redbookprep.site</a>), you agree to these Terms of Service. If you do not agree to these terms, please do not use the website.
      </p>

      <h2>1. Purpose &amp; Single-User Educational Workspace</h2>
      <p>
        RedBookPrep provides an independent, single-user educational study environment for Digital SAT® test preparation. The platform does not offer user-to-user messaging, chatrooms, public profiles, or public file sharing. Each student’s study workspace and optional cloud-synchronized data are strictly private to their own authenticated account or local browser.
      </p>

      <h2>2. Eligibility &amp; Age Requirements</h2>
      <p>
        Anyone may use the local browser-based guest practice mode without creating an account. Creating an online account or using Google Cloud synchronization requires that you are at least 13 years of age (or using the service with the consent and supervision of a parent, legal guardian, or school educator).
      </p>

      <h2>3. Acceptable Use</h2>
      <p>
        You agree to use RedBookPrep solely for lawful, personal educational and test-preparation purposes. You may not attempt to disrupt, overload, reverse-engineer, scrape, or bypass the security rules of the platform or its authentication and database infrastructure, nor use the platform to store or transmit unlawful content. We reserve the right to suspend or terminate any account that violates these terms.
      </p>

      <h2>4. No Official Affiliation &amp; Score Disclaimer</h2>
      <p>
        RedBookPrep is an independent educational project. SAT® is a registered trademark of the College Board, which is not affiliated with, and does not endorse, RedBookPrep. Practice accuracy, timing metrics, and study plans on RedBookPrep are educational estimates and do not guarantee any specific score on an official exam.
      </p>

      <h2>5. Disclaimer of Warranties (&ldquo;As-Is&rdquo; Service)</h2>
      <p>
        RedBookPrep is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without warranties of any kind, whether express or implied, including implied warranties of merchantability, fitness for a particular purpose, or non-infringement. While we offer both local browser storage and optional cloud backup, you are encouraged to periodically export a JSON study backup from Settings.
      </p>

      <h2>6. Limitation of Liability &amp; Indemnification</h2>
      <p>
        To the fullest extent permitted by applicable law, RedBookPrep and its creators, contributors, and operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of data, scores, or profits arising out of or related to your use of or inability to use the service, nor for any unauthorized or unlawful conduct by any user. Because RedBookPrep is provided free of charge, our total aggregate liability for any claim arising out of these terms or the service shall not exceed zero U.S. dollars ($0.00). You agree to indemnify and hold harmless RedBookPrep and its operators from any claims arising out of your misuse of the service or violation of these terms.
      </p>

      <h2>7. Contact</h2>
      <p>
        Questions regarding these Terms of Service may be sent to <a href="mailto:support@redbookprep.site">support@redbookprep.site</a>.
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
        <Link className="public-button" href="/study">Return to Study Workspace →</Link>
        <Link className="public-button" href="/privacy">Privacy Policy</Link>
        <Link className="public-button" href="/contact">Contact Us</Link>
      </div>
    </article>
  );
}
