# PrepDeck foundation

Next.js, TypeScript and Tailwind application with a browser-local sample practice loop: choose a skill, answer, read explanations, record mistakes and notes, schedule review, and view basic accuracy/pacing.

Run `pnpm install`, then `pnpm dev` from this folder. Validate with `pnpm typecheck` and `pnpm build`.

This is an early prototype, not a public-ready release. Two original demo questions have client-visible answer keys. Production questions and grading must move to protected server routes. No authentication, Supabase connection, AI calls, billing, or deployment is implemented yet. Local storage is not account storage. A refresh does not preserve an unfinished answer or session timer.

Next milestone: Supabase email/password authentication with custom SMTP, protected student routes, and row-level security verified with two separate accounts. Add server-only answer keys and persisted sessions before public practice.

Required deployment configuration: Supabase project URL/public key, backend secrets, Resend SMTP, Netlify project and GitHub repository. AI and payment secrets are server-only and should be connected in later milestones. Never commit credentials.

Testing checklist: submit each correct and incorrect answer; verify explanation and mistake records; edit a note/date and refresh; verify planner date changes; verify empty progress and sample-size messaging; test narrow screens and keyboard access. Production checks additionally require session autosave, persistent timers, cross-account isolation, and idempotent credit/payment accounting.
