'use client';

import {useEffect, useRef, useState} from 'react';
import {Maximize2, Minimize2, X} from 'lucide-react';

export function GraphCalculator({open, onClose}: {open: boolean; onClose: () => void}) {
  const panel = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  const [wide, setWide] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

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
    frame.current?.contentWindow?.postMessage({type: 'redbook-graph-resize'}, location.origin);
  }

  useEffect(() => {
    const dialog = panel.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      trigger.current = document.activeElement as HTMLElement;
      // Load Desmos host once, retaining expressions while closed or moving across questions.
      if (frame.current && !frame.current.getAttribute('src')) {
        const initialTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
        frame.current.src = `/calculator/index.html?theme=${initialTheme}`;
      }
      dialog.show();
      sendTheme();
      requestAnimationFrame(sendResize);
      frame.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      if (trigger.current?.isConnected) trigger.current.focus();
    }
  }, [open]);

  useEffect(() => {
    const observer = new MutationObserver(sendTheme);
    observer.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
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

  function toggleWide() {
    const dialog = panel.current;
    if (dialog) {
      dialog.style.width = '';
      dialog.style.height = '';
      if (!wide) {
        dialog.style.left = `${Math.max(12, Math.round((window.innerWidth - Math.min(1040, window.innerWidth - 24)) / 2))}px`;
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
      aria-label="Desmos graphing calculator"
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
            dialog.style.left = `${Math.max(0, Math.min(window.innerWidth - dialog.offsetWidth, pointer.clientX - dx))}px`;
            dialog.style.top = `${Math.max(0, Math.min(window.innerHeight - 48, pointer.clientY - dy))}px`;
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
          <strong>Graphing Calculator</strong>
          <span>Digital SAT Mode</span>
        </div>
        <div className="redbookprep-graph-bar-actions">
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
        title="Desmos Graphing Calculator"
        onLoad={() => {
          sendTheme();
          sendResize();
        }}
      />
    </dialog>
  );
}
