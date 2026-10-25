'use client';

import React, { Component, type ReactNode, useEffect, useState, useRef } from 'react';
import { Shader, Swirl, ChromaFlow, FlutedGlass } from 'shaders/react';

// Error Boundary to safely catch any WebGPU / runtime shader initialization crashes
class ShaderErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[GlassBackground] WebGPU shader encountered an error, using fallback:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Canvas & CSS Fallback for browsers or devices without WebGPU
function FlutedGlassCanvasFallback() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      t += 0.008;
      const w = canvas.width;
      const h = canvas.height;

      // Base gradient
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#e6e2ff');
      grad.addColorStop(0.5, '#d4cbff');
      grad.addColorStop(1, '#bdb2ff');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Chroma swirl orbs
      const x1 = w * 0.45 + Math.sin(t) * w * 0.2;
      const y1 = h * 0.4 + Math.cos(t * 0.8) * h * 0.2;
      const rad1 = ctx.createRadialGradient(x1, y1, 10, x1, y1, Math.max(w, h) * 0.5);
      rad1.addColorStop(0, 'rgba(174, 0, 255, 0.45)');
      rad1.addColorStop(0.5, 'rgba(89, 0, 255, 0.25)');
      rad1.addColorStop(1, 'rgba(70, 66, 255, 0)');
      ctx.fillStyle = rad1;
      ctx.fillRect(0, 0, w, h);

      const x2 = w * 0.6 + Math.cos(t * 0.7) * w * 0.25;
      const y2 = h * 0.55 + Math.sin(t * 0.9) * h * 0.25;
      const rad2 = ctx.createRadialGradient(x2, y2, 20, x2, y2, Math.max(w, h) * 0.45);
      rad2.addColorStop(0, 'rgba(113, 5, 255, 0.35)');
      rad2.addColorStop(0.6, 'rgba(91, 79, 255, 0.15)');
      rad2.addColorStop(1, 'rgba(189, 178, 255, 0)');
      ctx.fillStyle = rad2;
      ctx.fillRect(0, 0, w, h);

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      {/* 30-degree fluted glass ribs overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'repeating-linear-gradient(30deg, rgba(255,255,255,0.45) 0px, rgba(255,255,255,0.45) 2px, transparent 2px, transparent 18px)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
}

export default function GlassBackgroundInner() {
  const [hasWebGPU, setHasWebGPU] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkWebGPU() {
      if (typeof navigator !== 'undefined' && 'gpu' in navigator && navigator.gpu) {
        try {
          const adapter = await navigator.gpu.requestAdapter();
          if (isMounted) {
            setHasWebGPU(!!adapter);
          }
        } catch {
          if (isMounted) setHasWebGPU(false);
        }
      } else {
        if (isMounted) setHasWebGPU(false);
      }
    }

    checkWebGPU();

    return () => {
      isMounted = false;
    };
  }, []);

  if (hasWebGPU === false) {
    return <FlutedGlassCanvasFallback />;
  }

  return (
    <ShaderErrorBoundary fallback={<FlutedGlassCanvasFallback />}>
      <Shader style={{ width: '100%', height: '100%', display: 'block' }}>
        {/* Ambient background */}
        <Swirl
          blend={50}
          detail={1.7}
          stops={['#e6e2ff', '#bdb2ff']}
        />
        {/* Interactive cursor effect */}
        <ChromaFlow
          baseColor="#ae00ff"
          downColor="#4642ff"
          leftColor="#5900ff"
          rightColor="#5b4fff"
          upColor="#7105ff"
        />
        {/* Glass-like distortion */}
        <FlutedGlass
          aberration={0.25}
          angle={30}
          frequency={8}
          highlightColor="#ffffff"
          refraction={4}
          softness={0.5}
        />
      </Shader>
    </ShaderErrorBoundary>
  );
}
