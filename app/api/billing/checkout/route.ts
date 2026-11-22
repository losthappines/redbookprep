import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const stripeSecret = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!stripeSecret) {
    return NextResponse.json(
      {
        error: 'Stripe billing is ready for configuration. Add STRIPE_SECRET_KEY in environment variables.',
        demoUrl: '/study?tab=settings&upgrade=preview',
      },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { tier = 'plus', email = '', sponsorEmail = '', origin = 'https://www.redbookprep.site' } = body || {};
    const priceId =
      tier === 'pro'
        ? (process.env.STRIPE_PRICE_PRO_MONTHLY || '').trim()
        : (process.env.STRIPE_PRICE_PLUS_MONTHLY || '').trim();

    if (!priceId) {
      return NextResponse.json(
        { error: `Missing STRIPE_PRICE_${tier === 'pro' ? 'PRO' : 'PLUS'}_MONTHLY env variable.` },
        { status: 503 }
      );
    }

    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${origin}/study?tab=settings&checkout=success&tier=${tier}`,
      cancel_url: `${origin}/study?tab=settings&checkout=canceled`,
      'metadata[tier]': tier,
    });
    if (sponsorEmail || email) {
      params.set('customer_email', (sponsorEmail || email).trim());
    }

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const session = await res.json();
    if (!res.ok || !session?.url) {
      return NextResponse.json(
        { error: session?.error?.message || 'Unable to start Stripe Checkout.' },
        { status: 502 }
      );
    }
    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Checkout failed.' }, { status: 500 });
  }
}
