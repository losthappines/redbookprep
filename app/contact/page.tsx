import Link from 'next/link';

export const metadata = {
  title: 'Contact Us — RedBookPrep SAT Test Preparation',
  description: 'Get in touch with the RedBookPrep team for support, feedback, partnership inquiries, or questions about our digital SAT practice platform.',
  alternates: { canonical: 'https://www.redbookprep.site/contact' },
};

export default function ContactPage() {
  return (
    <article className="public-document">
      <Link href="/">← RedBookPrep</Link>
      <span className="eyebrow">CONTACT US</span>
      <h1>We would love to hear from you.</h1>
      <p>
        RedBookPrep is an independent digital SAT test preparation workspace built to help students practise with purpose, review their mistakes thoughtfully, and plan a consistent study schedule. Whether you have a question about a practice module, found an issue in a question explanation, need help with Google Cloud account synchronization, or want to share feedback from your classroom, our team is ready to help.
      </p>

      <h2>Student &amp; Educator Support</h2>
      <p>
        For technical support, account recovery questions, `.bbplus` practice pack inquiries, or bug reports, please email us directly at{' '}
        <a href="mailto:support@redbookprep.site">support@redbookprep.site</a>. We respond to student and educator messages within one to two business days.
      </p>

      <h2>Content &amp; Curriculum Feedback</h2>
      <p>
        Notice a typo in a reading passage, a LaTeX math formatting question, or want to suggest new digital SAT skill drills? Reach our curriculum editors at{' '}
        <a href="mailto:curriculum@redbookprep.site">curriculum@redbookprep.site</a>. Please include the module name and question skill so we can review it quickly.
      </p>

      <h2>Mailing &amp; Organization Information</h2>
      <p>
        <strong>Organization:</strong> RedBookPrep Independent SAT Study Project<br />
        <strong>General Inquiries:</strong> <a href="mailto:hello@redbookprep.site">hello@redbookprep.site</a><br />
        <strong>Support Email:</strong> <a href="mailto:support@redbookprep.site">support@redbookprep.site</a><br />
        <strong>Website:</strong> <a href="https://www.redbookprep.site">https://www.redbookprep.site</a>
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
        <Link className="public-button" href="/study">Open Study Space →</Link>
        <Link className="public-button" href="/about">About RedBookPrep</Link>
        <Link className="public-button" href="/privacy">Privacy Policy</Link>
      </div>
    </article>
  );
}
