import './globals.css';
import './redbook-public.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.redbookprep.site'),
  title: {
    default: 'RedBookPrep — Digital SAT Test Preparation & Practice Platform',
    template: '%s | RedBookPrep',
  },
  description:
    'RedBookPrep test preparation for the Digital SAT: practise 410+ Mathbook 3.0 questions and Reading & Writing skills in a split-screen workspace, track mistakes, and sync your study plan across devices.',
  keywords: [
    'RedBookPrep',
    'RedBookPrep test preparation',
    'Digital SAT practice',
    'SAT test preparation',
    'SAT math practice questions',
    'Bluebook SAT practice',
    'Mathbook 3.0',
  ],
  alternates: {
    canonical: 'https://www.redbookprep.site/',
  },
  openGraph: {
    type: 'website',
    url: 'https://www.redbookprep.site/',
    siteName: 'RedBookPrep',
    title: 'RedBookPrep — Digital SAT Test Preparation & Practice Platform',
    description:
      'RedBookPrep test preparation for the Digital SAT: 410+ categorized practice questions, split-screen test player, mistake notebook, and weekly study planner.',
    images: [
      {
        url: 'https://www.redbookprep.site/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'RedBookPrep — Digital SAT Test Preparation',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RedBookPrep — Digital SAT Test Preparation & Practice Platform',
    description:
      'Practice with purpose on RedBookPrep: Digital SAT test preparation, 410+ Mathbook 3.0 questions, mistake notebook, and cloud-synced study planner.',
    images: ['https://www.redbookprep.site/opengraph-image'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://www.redbookprep.site/#organization',
      name: 'RedBookPrep',
      url: 'https://www.redbookprep.site',
      description:
        'Independent Digital SAT test preparation platform providing interactive practice modules, mistake analysis, and personalized study planning.',
      sameAs: ['https://www.redbookprep.site'],
      contactPoint: [
        {
          '@type': 'ContactPoint',
          email: 'support@redbookprep.site',
          telephone: '+1-800-555-0199',
          contactType: 'customer support',
          url: 'https://www.redbookprep.site/contact',
          availableLanguage: ['English'],
        },
      ],
      address: {
        '@type': 'PostalAddress',
        streetAddress: '548 Market St',
        addressLocality: 'San Francisco',
        addressRegion: 'CA',
        postalCode: '94104',
        addressCountry: 'US',
      },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://www.redbookprep.site/#application',
      name: 'RedBookPrep',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      url: 'https://www.redbookprep.site',
      description:
        'RedBookPrep test preparation web application for the Digital SAT with 410+ practice questions across 21 modules, split-screen question solver, built-in graphing calculator, mistake notebook, and Google Cloud progress sync.',
      author: {
        '@id': 'https://www.redbookprep.site/#organization',
      },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="canonical" href="https://www.redbookprep.site/" />
        <link rel="llms-txt" href="https://www.redbookprep.site/llms.txt" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
          crossOrigin="anonymous"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var p=JSON.parse(localStorage.getItem('redbookprep-settings')||'{}');var d=p.theme==='dark'||(p.theme!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light';document.documentElement.dataset.motion=p.reduced?'reduced':'normal'}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
