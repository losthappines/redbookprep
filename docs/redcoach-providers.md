# RedCoach provider operations

## Configuration

Set server-only `GEMINI_API_KEY`, `GROQ_API_KEY`, and `MISTRAL_API_KEY` in the
appropriate Vercel environment, then redeploy. `GEMMA_API_KEY` is an optional
Google AI Studio key; otherwise Gemma uses the Gemini key. Gemini also accepts
the existing server-only `GOOGLE_AI_API_KEY` alias. Migrate any
`NEXT_PUBLIC_GEMINI_API_KEY` to `GEMINI_API_KEY`; public-prefixed AI keys are no
longer read. Do not commit keys.

Gemma now uses Google's documented Gemma 4 endpoint. Groq, OpenRouter, and
Hugging Face keys are not accepted as Gemma credentials. A Groq key still works
for the two Groq options.

The shared registry in `lib/redcoach-models.ts` is the source of truth for model
IDs and labels. Old saved menu selections migrate to their replacements. The
response includes the provider-reported model version when supplied; otherwise
it includes the exact requested upstream model ID.

Model documentation checked on 2026-10-30:

- https://console.groq.com/docs/deprecations — retired Llama and Maverick IDs;
  replacements use GPT-OSS 20B and 120B.
- https://ai.google.dev/gemini-api/docs/models — Gemini 3.8 Flash.
- https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api — Gemma 4 31B.
- https://docs.mistral.ai/api/endpoint/chat — Mistral chat completions.

## Health and failures

`GET /api/chat` reports only whether credentials are configured, never whether
they are valid. A model's green indicator means its last actual request in this
browser session succeeded. It does not certify future uptime. Changing local
keys clears these results. Health results are per model, not per provider, so
one working Mistral model cannot mark another model healthy.

`POST /api/chat` returns safe `checks` with model, provider, status, HTTP status
when available, and check time. On fallback, the requested model remains failed
and the successful backup is named separately in the response and UI. Total
failure returns HTTP 503 or 504, not a successful assistant answer.

Search Vercel runtime logs for `redCoach provider failure`. Correlate using
`requestId`. Logs omit keys, student prompts and raw upstream response bodies.

- `invalid_key` / `access_denied`: check credentials and model/account access.
- `rate_limited`: check provider quota, rate limits and billing status.
- `model_unavailable`: verify the exact registry ID is available to the account.
- `timeout`: review provider latency; each attempt has a 6.5-second cap.
- `bad_request` / `upstream_error`: review the provider's API specification or status.

There is one primary attempt and at most one configured backup from a different
provider. Both share a 14.5-second budget. No arbitrary model discovery or silent
within-provider substitution occurs.

## Validation

Run `node --test tests/redcoach.cjs`, `tsc --noEmit`, and `next build` using the
project dependencies. The regression suite uses mocked provider responses and
never consumes live API credits. After deployment, send a short question to each
model with production credentials and inspect the returned checks. Mock tests
cannot verify live keys or account quotas.

Screenshot input is a separate existing limitation: the UI previews images but
does not yet send image content to the API. This change addresses text-model
routing, health reporting and response formatting; it does not add vision.
