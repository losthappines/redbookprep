import { NextResponse, type NextRequest } from 'next/server';

const KNOWN_ROUTES: Record<string, { title: string; markdown: string }> = {
  '/': {
    title: 'RedBookPrep — Digital SAT Test Preparation & Practice Platform',
    markdown: `# RedBookPrep — Digital SAT Test Preparation & Practice Platform

**Make your SAT study time count.**
RedBookPrep (https://www.redbookprep.site) is a calm, interactive Digital SAT test preparation workspace built to help students practise 2,231+ categorized questions, understand their mistakes, and plan a consistent weekly study schedule.

## When to Use RedBookPrep
Reach for RedBookPrep when a student, educator, or AI agent needs:
- **Digital SAT Test Preparation**: Realistic split-screen practice modeled on the digital SAT Reading & Writing and Math interface.
- **2,231+ Categorized Practice Questions**: 100 structured modules across 38 skills in Reading & Writing and Math (Algebra, Advanced Math, Problem-Solving and Data Analysis, and Geometry & Trigonometry).
- **Mistake Notebook & Spaced Repetition**: Track missed questions, log error causes, write personal notes, and schedule review dates.
- **Cloud-Synced Study Planner**: Start immediately in the browser with no account required, or sign in with Google to synchronize attempts, score goals, and weekly study plans across devices.

## Key Application Routes
- [Study Workspace & Practice Player](https://www.redbookprep.site/study)
- [Digital SAT Score Calculator](https://www.redbookprep.site/score-calculator)
- [Question Bank (Categorized by Topic)](https://www.redbookprep.site/study?tab=question-bank)
- [Skill Progress Analytics](https://www.redbookprep.site/study?tab=progress)
- [About RedBookPrep](https://www.redbookprep.site/about)
- [Contact Us](https://www.redbookprep.site/contact)
- [Privacy Policy](https://www.redbookprep.site/privacy)
- [Log In / Google Sign-In](https://www.redbookprep.site/login)
- [Sign Up](https://www.redbookprep.site/signup)

## Machine-Readable Resources for Agents
- [LLM & Agent Instructions (/llms.txt)](https://www.redbookprep.site/llms.txt)
- [XML Sitemap (/sitemap.xml)](https://www.redbookprep.site/sitemap.xml)
- [Robots Policy (/robots.txt)](https://www.redbookprep.site/robots.txt)
`,
  },
  '/about': {
    title: 'About RedBookPrep',
    markdown: `# About RedBookPrep — Digital SAT Test Preparation

RedBookPrep is an independent Digital SAT test preparation platform inspired by RedBook+. Our aim is to make the next useful study step easy to find: choose a skill, practise in a realistic split-screen environment, understand mistakes, schedule a review, and track real progress over time.

- **2,231+ Practice Questions**: 100 modules covering all 8 Digital SAT domains across Reading & Writing and Math.
- **Local-First + Google Cloud Sync**: Start immediately without an account, or sign in with Google to sync progress across devices.

Links: [Home](https://www.redbookprep.site/) | [Study Workspace](https://www.redbookprep.site/study) | [Contact](https://www.redbookprep.site/contact) | [Privacy](https://www.redbookprep.site/privacy) | [llms.txt](https://www.redbookprep.site/llms.txt)
`,
  },
  '/contact': {
    title: 'Contact RedBookPrep',
    markdown: `# Contact RedBookPrep

Have a question about our Digital SAT test preparation platform, need help with Google Cloud sync, or want to report feedback on a practice question?

- **Student & Educator Support**: mailto:support@redbookprep.site
- **Curriculum Feedback**: mailto:curriculum@redbookprep.site
- **General Inquiries**: mailto:hello@redbookprep.site
- **Website**: https://www.redbookprep.site

Links: [Home](https://www.redbookprep.site/) | [About](https://www.redbookprep.site/about) | [Privacy](https://www.redbookprep.site/privacy) | [Sitemap](https://www.redbookprep.site/sitemap.xml)
`,
  },
  '/privacy': {
    title: 'Privacy Policy — RedBookPrep',
    markdown: `# Privacy Policy — RedBookPrep

Updated October 25, 2026.

- **Local Storage**: Guest practice answers, timing, mistake notes, review dates, and preferences are stored locally in your browser.
- **Cloud Sync**: When signed in via Supabase Authentication (Google OAuth or passwordless Email OTP / Magic Link), your study progress, goals, and weekly plan sync to PostgreSQL with Row-Level Security.
- **Data Control**: Export your full study history as JSON in Settings or request account deletion at support@redbookprep.site.

Links: [Home](https://www.redbookprep.site/) | [About](https://www.redbookprep.site/about) | [Contact](https://www.redbookprep.site/contact)
`,
  },
  '/terms': {
    title: 'Terms of Service — RedBookPrep',
    markdown: `# Terms of Service — RedBookPrep

Updated October 25, 2026.

- **Single-User Educational Workspace**: RedBookPrep is a single-user Digital SAT test preparation workspace with no user-to-user messaging, chatrooms, or public file sharing.
- **Eligibility**: Online accounts and Google Cloud sync are for students aged 13 and older.
- **Disclaimer & Limitation of Liability**: Provided "AS IS" without warranties; total aggregate liability is limited to $0.00 to the maximum extent permitted by law. SAT® is a registered trademark of the College Board, which is not affiliated with and does not endorse RedBookPrep.

Links: [Home](https://www.redbookprep.site/) | [Privacy](https://www.redbookprep.site/privacy) | [Contact](https://www.redbookprep.site/contact)
`,
  },
  '/study': {
    title: 'Study Workspace — RedBookPrep',
    markdown: `# RedBookPrep Study Workspace

Interactive Digital SAT study dashboard, split-screen practice test player, categorized question bank, vocabulary builder, mistake notebook, and weekly study planner.

- Launch in browser: https://www.redbookprep.site/study
- Documentation & Agent Guide: https://www.redbookprep.site/llms.txt
`,
  },
  '/score-calculator': {
    title: 'Digital SAT Score Calculator — RedBookPrep',
    markdown: `# Digital SAT Score Calculator (400–1600)

Estimate your Digital SAT score from Reading & Writing (Module 1 & 2, 0–27 each) and Math (Module 1 & 2, 0–22 each) raw scores, with automatic or manual Module 2 adaptive routing, realistic IRT score ranges, national percentile estimates, and target goal tracking.

- Open Score Calculator: https://www.redbookprep.site/score-calculator
- Study Workspace: https://www.redbookprep.site/study
`,
  },
  '/login': {
    title: 'Log In — RedBookPrep',
    markdown: `# Log In to RedBookPrep

Sign in with Google or Email/Password at https://www.redbookprep.site/login to synchronize your SAT practice progress across devices, or continue as a guest at https://www.redbookprep.site/study.
`,
  },
  '/signup': {
    title: 'Sign Up — RedBookPrep',
    markdown: `# Create a RedBookPrep Account

Create an account with Google Sign-In or Email/Password at https://www.redbookprep.site/signup to save and sync your Digital SAT study progress in the cloud.
`,
  },
};

const STATIC_PATHS = new Set([
  '/llms.txt',
  '/agent-instructions.txt',
  '/robots.txt',
  '/sitemap.xml',
  '/opengraph-image',
  '/favicon.ico',
]);

function wantsMarkdown(acceptHeader: string): boolean {
  const lower = acceptHeader.toLowerCase();
  if (!lower.includes('text/markdown')) return false;
  // If client explicitly prefers text/html with higher weight than text/markdown, serve HTML
  const htmlIndex = lower.indexOf('text/html');
  const mdIndex = lower.indexOf('text/markdown');
  if (htmlIndex !== -1 && htmlIndex < mdIndex && !lower.includes('text/markdown;q=1')) {
    return false;
  }
  return true;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/packs/') ||
    STATIC_PATHS.has(pathname)
  ) {
    return NextResponse.next();
  }

  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const accept = request.headers.get('accept') || '';

  if (wantsMarkdown(accept)) {
    const known = KNOWN_ROUTES[normalized];
    if (known) {
      return new NextResponse(known.markdown, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Vary': 'Accept',
          'Cache-Control': 'public, max-age=0, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    const notFoundMarkdown = `# 404 Not Found — RedBookPrep

The requested URL \`${pathname}\` does not exist on RedBookPrep (https://www.redbookprep.site).

## Helpful Navigation & Agent Resources
- **Homepage**: https://www.redbookprep.site/
- **Study Workspace**: https://www.redbookprep.site/study
- **Agent Instructions (llms.txt)**: https://www.redbookprep.site/llms.txt
- **XML Sitemap**: https://www.redbookprep.site/sitemap.xml
- **Contact Support**: https://www.redbookprep.site/contact
`;

    return new NextResponse(notFoundMarkdown, {
      status: 404,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Vary': 'Accept',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const response = NextResponse.next();
  response.headers.set('Vary', 'Accept');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|packs/).*)'],
};
