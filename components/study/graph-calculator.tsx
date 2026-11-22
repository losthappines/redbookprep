'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, X, Sparkles } from 'lucide-react';

export function GraphCalculator({
  open,
  onClose,
  expressions,
}: {
  open: boolean;
  onClose: () => void;
  expressions?: string[];
}) {
  const panel = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  const [wide, setWide] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<'graphing' | 'scientific'>('graphing');
  const lastInjectedRef = useRef<string>('');

  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  function buildSrc(calcMode: 'graphing' | 'scientific') {
    const initialTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const apiKey = process.env.NEXT_PUBLIC_DESMOS_API_KEY?.trim();
    const keyParam = apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : '';
    return `/calculator/index.html?theme=${initialTheme}&mode=${calcMode}${keyParam}`;
  }

  function sendTheme() {
    frame.current?.contentWindow?.postMessage(
      {
        type: 'redbook-graph-theme',
        theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
      },
      location.origin
    );
  }

  function sendResize() {
    frame.current?.contentWindow?.postMessage({ type: 'redbook-graph-resize' }, location.origin);
  }

  function pushExpressions(exprs: string[], replace = false) {
    if (!exprs.length) return;
    frame.current?.contentWindow?.postMessage(
      {
        type: 'redbook-graph-set-expressions',
        replace,
        expressions: exprs.map((latex, idx) => ({ id: `rb-expr-${idx + 1}`, latex })),
      },
      location.origin
    );
  }

  useEffect(() => {
    const dialog = panel.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      trigger.current = document.activeElement as HTMLElement;
      if (frame.current && !frame.current.getAttribute('src')) {
        frame.current.src = buildSrc(mode);
      }
      dialog.show();
      sendTheme();
      requestAnimationFrame(sendResize);
      frame.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      if (trigger.current?.isConnected) trigger.current.focus();
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open || !expressions?.length) return;
    const key = expressions.join('|');
    if (key !== lastInjectedRef.current && mode === 'graphing') {
      lastInjectedRef.current = key;
      pushExpressions(expressions, false);
    }
  }, [open, expressions, mode]);

  useEffect(() => {
    const observer = new MutationObserver(sendTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    function receive(event: MessageEvent) {
      if (
        event.source === frame.current?.contentWindow &&
        event.origin === location.origin &&
        event.data?.type === 'redbook-graph-close'
      ) {
        close.current();
      }
    }
    window.addEventListener('message', receive);
    const ro = new ResizeObserver(() => sendResize());
    if (panel.current) ro.observe(panel.current);
    return () => {
      observer.disconnect();
      window.removeEventListener('message', receive);
      ro.disconnect();
    };
  }, []);

  function switchMode(next: 'graphing' | 'scientific') {
    if (next === mode) return;
    setMode(next);
    if (frame.current) {
      frame.current.src = buildSrc(next);
    }
  }

  function toggleWide() {
    const dialog = panel.current;
    if (dialog) {
      dialog.style.width = '';
      dialog.style.height = '';
      if (!wide) {
        dialog.style.left = `${Math.max(
          12,
          Math.round((window.innerWidth - Math.min(1040, window.innerWidth - 24)) / 2)
        )}px`;
      } else {
        dialog.style.left = '';
      }
    }
    setWide((v) => !v);
    requestAnimationFrame(sendResize);
  }

  return (
    <dialog
      ref={panel}
      id="practice-graph-calculator"
      className="redbookprep-graph-calculator"
      data-wide={wide ? 'true' : 'false'}
      data-dragging={dragging ? 'true' : 'false'}
      aria-label="Desmos calculator"
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          close.current();
        }
        event.stopPropagation();
      }}
    >
      <div
        className="redbookprep-graph-bar"
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
          const dialog = panel.current!;
          const bounds = dialog.getBoundingClientRect();
          const dx = event.clientX - bounds.left;
          const dy = event.clientY - bounds.top;
          const bar = event.currentTarget;
          bar.setPointerCapture(event.pointerId);
          setDragging(true);
          const move = (pointer: PointerEvent) => {
            dialog.style.left = `${Math.max(
              0,
              Math.min(window.innerWidth - dialog.offsetWidth, pointer.clientX - dx)
            )}px`;
            dialog.style.top = `${Math.max(
              0,
              Math.min(window.innerHeight - 48, pointer.clientY - dy)
            )}px`;
          };
          const end = () => {
            setDragging(false);
            bar.removeEventListener('pointermove', move);
            bar.removeEventListener('pointerup', end);
            bar.removeEventListener('pointercancel', end);
          };
          bar.addEventListener('pointermove', move);
          bar.addEventListener('pointerup', end);
          bar.addEventListener('pointercancel', end);
        }}
      >
        <div className="redbookprep-graph-bar-title">
          <strong>Desmos</strong>
          <div style={{ display: 'inline-flex', gap: '4px' }}>
            <button
              type="button"
              className={mode === 'graphing' ? 'primary' : ''}
              onClick={() => switchMode('graphing')}
            >
              Graphing
            </button>
            <button
              type="button"
              className={mode === 'scientific' ? 'primary' : ''}
              onClick={() => switchMode('scientific')}
            >
              Scientific
            </button>
          </div>
        </div>
        <div className="redbookprep-graph-bar-actions">
          {expressions && expressions.length > 0 && mode === 'graphing' && (
            <button
              type="button"
              title="Load question equations into Desmos"
              onClick={() => pushExpressions(expressions, true)}
            >
              <Sparkles size={13} />
              <span>Plot equations</span>
            </button>
          )}
          <button
            type="button"
            aria-label={wide ? 'Collapse calculator width' : 'Expand calculator width'}
            title={wide ? 'Collapse' : 'Expand'}
            onClick={toggleWide}
          >
            {wide ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{wide ? 'Collapse' : 'Expand'}</span>
          </button>
          <button type="button" aria-label="Close calculator" title="Close calculator" onClick={onClose}>
            <X size={15} />
            <span>Close</span>
          </button>
        </div>
      </div>
      <iframe
        ref={frame}
        title="Desmos Calculator"
        onLoad={() => {
          sendTheme();
          sendResize();
          if (expressions?.length && mode === 'graphing') {
            pushExpressions(expressions, false);
          }
        }}
      />
    </dialog>
  );
}
