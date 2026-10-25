import Link from 'next/link';

export const metadata = {
  title: 'Page Not Found (404) — RedBookPrep',
  description: 'The page you requested could not be found on RedBookPrep.',
};

export default function NotFound() {
  return (
    <article className="public-document">
      <Link href="/">← RedBookPrep</Link>
      <span className="eyebrow">404 · PAGE NOT FOUND</span>
      <h1>We could not find that page.</h1>
      <p>
        The URL you requested does not exist on RedBookPrep. You can return to the homepage, open the digital SAT study workspace, or browse our machine-readable documentation and sitemap below.
      </p>
      <p>
        <Link className="public-button" href="/">Go to RedBookPrep Home →</Link>
      </p>
      <p>
        Helpful links: <Link href="/study">Study Workspace</Link> · <Link href="/about">About</Link> · <Link href="/contact">Contact</Link> · <Link href="/privacy">Privacy</Link> · <a href="/sitemap.xml">Sitemap</a> · <a href="/llms.txt">llms.txt</a>
      </p>
    </article>
  );
}
