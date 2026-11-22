'use client';

import React, { useState, useEffect } from 'react';
import { Check, X, Sparkles, Mail, Copy, Shield } from 'lucide-react';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    sparks: '10 Sparks / week (resets on 7-day streak)',
    features: [
      '2,231+ SAT Math & R&W Questions',
      'Official Grid-In (SPR) & Desmos Calculator',
      'Vocab Studio 2.0 (991+ words)',
      'Mistake Notebook + Full Activity Heatmap',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    price: '$14',
    period: '/month',
    badge: 'Most Popular',
    sparks: '120 Sparks / week · Fast AI',
    features: [
      'Everything in Free',
      'Full interactive Masterclasses & Guides',
      '1500+ Club Challenge Questions',
      'Unlimited RedBook Rush Arcade & +2 Streak Freezes',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    period: '/month',
    sparks: 'Unlimited AI Sparks · Flagship Models',
    features: [
      'Everything in Plus',
      'Unlimited Full-Length Adaptive Mock Tests',
      'AI Auto-Adapting Planner + Student Memory',
      'Guardian Weekly Digest & Parent Sponsor Billing',
    ],
  },
] as const;

export function PricingModal({
  open,
  currentTier,
  userEmail,
  onClose,
}: {
  open: boolean;
  currentTier: 'free' | 'plus' | 'pro';
  userEmail?: string;
  onClose: () => void;
}) {
  const [parentEmail, setParentEmail] = useState('');
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [copiedSponsor, setCopiedSponsor] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const startCheckout = async (tier: 'plus' | 'pro', sponsor = false) => {
    setBusyTier(tier);
    setNotice('');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          email: userEmail,
          sponsorEmail: sponsor ? parentEmail : '',
          origin: window.location.origin,
        }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.assign(data.url);
      } else {
        setNotice(data?.error || 'Checkout will open once Stripe keys are configured on the server.');
      }
    } catch {
      setNotice('Could not connect to billing right now.');
    } finally {
      setBusyTier(null);
    }
  };

  const copyParentLink = () => {
    const shareUrl = `${window.location.origin}/guardians?student=${encodeURIComponent(
      userEmail?.split('@')[0] || 'Student'
    )}&sponsor=true`;
    void navigator.clipboard?.writeText(shareUrl);
    setCopiedSponsor(true);
    setTimeout(() => setCopiedSponsor(false), 1800);
  };

  return (
    <div className="navigator-backdrop" onClick={onClose}>
      <section
        className="question-navigator rb-pricing-modal"
        role="dialog"
        aria-modal="true"
        aria-label="RedBookPrep Plans"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="navigator-heading">
          <div>
            <h2>Choose Your Study Plan</h2>
            <p>Upgrade Sparks, unlock unlimited adaptive mocks, or ask a parent/guardian to sponsor you.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close pricing">
            <X size={16} />
          </button>
        </div>

        <div className="rb-pricing-grid">
          {PLANS.map((plan) => (
            <article key={plan.id} className={`rb-plan-card ${currentTier === plan.id ? 'is-current' : ''}`}>
              <div className="rb-plan-head">
                <strong>{plan.name}</strong>
                {'badge' in plan && plan.badge && <span className="rb-rarity-tag rarity-rare">{plan.badge}</span>}
              </div>
              <div className="rb-plan-price">
                <span>{plan.price}</span>
                <small>{plan.period}</small>
              </div>
              <div className="rb-plan-sparks">
                <Sparkles size={13} /> {plan.sparks}
              </div>
              <ul>
                {plan.features.map((f) => (
                  <li key={f}>
                    <Check size={13} /> {f}
                  </li>
                ))}
              </ul>
              {plan.id !== 'free' && (
                <button
                  type="button"
                  className="primary"
                  disabled={currentTier === plan.id || busyTier === plan.id}
                  onClick={() => startCheckout(plan.id as 'plus' | 'pro')}
                >
                  {currentTier === plan.id ? 'Current Plan' : busyTier === plan.id ? 'Opening…' : `Get ${plan.name}`}
                </button>
              )}
            </article>
          ))}
        </div>

        <div className="rb-sponsor-box">
          <div>
            <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={14} /> Ask a parent or guardian to pay
            </strong>
            <p>Send a secure parent sponsor link or enter their email for Stripe checkout.</p>
          </div>
          <div className="rb-actions" style={{ flexWrap: 'wrap' }}>
            <input
              type="email"
              placeholder="parent@example.com"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
            />
            <button
              type="button"
              disabled={!parentEmail.trim() || Boolean(busyTier)}
              onClick={() => startCheckout('pro', true)}
            >
              <Mail size={14} /> Sponsor Checkout
            </button>
            <button type="button" onClick={copyParentLink}>
              <Copy size={14} /> {copiedSponsor ? 'Link Copied!' : 'Copy Parent Link'}
            </button>
          </div>
        </div>

        {notice && <p role="status" style={{ margin: '10px 0 0', fontSize: '.85rem' }}>{notice}</p>}
      </section>
    </div>
  );
}
