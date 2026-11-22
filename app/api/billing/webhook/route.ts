import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Stripe webhook handler.
 * Updates Supabase `subscriptions` & `profiles.subscription_tier` when `SUPABASE_SERVICE_ROLE_KEY`
 * and `STRIPE_WEBHOOK_SECRET` are configured.
 */
export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret || !sig) {
    return NextResponse.json({ received: false, note: 'Webhook secret not configured.' }, { status: 400 });
  }

  try {
    const rawBody = await req.text();
    const event = JSON.parse(rawBody);
    const eventType = event?.type || '';
    const sessionObj = event?.data?.object;

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (
      supabaseUrl &&
      serviceKey &&
      (eventType === 'checkout.session.completed' || eventType === 'customer.subscription.updated')
    ) {
      const customerEmail = sessionObj?.customer_details?.email || sessionObj?.customer_email;
      const tier = sessionObj?.metadata?.tier === 'pro' ? 'pro' : 'plus';
      const sparksBalance = tier === 'pro' ? 9999 : 120;

      if (customerEmail) {
        await fetch(`${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(customerEmail)}`, {
          method: 'PATCH',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subscription_tier: tier,
            sparks_balance: sparksBalance,
          }),
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Invalid webhook payload.' }, { status: 400 });
  }
}
