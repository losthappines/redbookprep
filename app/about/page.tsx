import Link from 'next/link';

export const metadata = {
  title: 'About Us — RedBookPrep Digital SAT Test Preparation',
  description: 'Learn how RedBookPrep helps students prepare for the Digital SAT with 410+ practice questions, a split-screen practice player, mistake tracking, and study planning.',
  alternates: { canonical: 'https://www.redbookprep.site/about' },
};

export default function About() {
  return (
    <article className="public-document">
      <Link href="/">← RedBookPrep</Link>
      <span className="eyebrow">ABOUT US</span>
      <h1>A little practice.<br />More possibility.</h1>
      <p>
        RedBookPrep is an independent Digital SAT test preparation platform inspired by RedBook+. Our aim is to make the next useful study step easy to find: choose a skill, practise in a realistic split-screen environment, understand mistakes, schedule a review, and track real progress over time.
      </p>
      <h2>What you can use today</h2>
      <p>
        RedBookPrep includes over 410 Mathbook 3.0 practice questions across 21 modules covering Algebra, Advanced Math, Problem-Solving and Data Analysis, and Geometry &amp; Trigonometry, alongside Reading and Writing practice passages, step-by-step explanations, a mistake notebook, personal notes, review dates, a weekly study planner, and topic-level progress analytics.
      </p>
      <h2>Local-first speed with Google Cloud sync</h2>
      <p>
        You can start practising immediately in your browser without creating an account. When you want to back up your progress or switch between your laptop and tablet, you can sign in with Google or an email account to automatically synchronize your attempts, mistake notes, score goals, and weekly study schedule across devices.
      </p>
      <h2>Learning comes first</h2>
      <p>
        Grading uses verified answer keys and detailed explanations. Accuracy and pacing reflect your practice attempts; they are not official SAT score predictions. RedBookPrep is an independent educational project and is not affiliated with or endorsed by College Board.
      </p>
      <p>
        <Link className="public-button" href="/study">Explore the Study Workspace →</Link>
      </p>
      <p>
        <Link href="/contact">Contact us</Link> · <Link href="/privacy">Read our privacy policy</Link>
      </p>
    </article>
  );
}
