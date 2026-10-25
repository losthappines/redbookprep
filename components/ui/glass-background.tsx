'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const GlassBackgroundInner = dynamic(
  () => import('./glass-background-inner'),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full"
        style={{
          background: 'linear-gradient(135deg, #e6e2ff 0%, #d4cbff 50%, #bdb2ff 100%)',
        }}
      />
    ),
  }
);

export function GlassBackground() {
  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-auto"
      style={{
        zIndex: -1,
        width: '100vw',
        height: '100vh',
      }}
      aria-hidden="true"
    >
      <GlassBackgroundInner />
      {/* Subtle grain texture overlay for tactile depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "url('/dashboard-grain.svg')",
          opacity: 0.25,
          mixBlendMode: 'multiply',
        }}
      />
      {/* Dark theme dimming wash to preserve contrast and legibility */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 dark-theme-shader-wash"
      />
    </div>
  );
}

export default GlassBackground;
