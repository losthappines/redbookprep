'use client';

import {useEffect, useRef} from 'react';

export function GraphCalculator({open, onClose}: {open: boolean; onClose: () => void}) {
  const panel = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);

  function sendTheme() {
    frame.current?.contentWindow?.postMessage({
      type: 'redbook-graph-theme',
      theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
    }, location.origin);
  }

  useEffect(() => {
    const dialog = panel.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      trigger.current = document.activeElement as HTMLElement;
      // Load once, then retain the same document while closed or changing questions.
      if (frame.current && !frame.current.getAttribute('src')) frame.current.src = '/calculator/index.html';
      dialog.show();
      sendTheme();
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
      if (event.source === frame.current?.contentWindow && event.origin === location.origin && event.data?.type === 'redbook-graph-close') close.current();
    }
    window.addEventListener('message', receive);
    return () => { observer.disconnect(); window.removeEventListener('message', receive); };
  }, []);

  return <dialog ref={panel} id="practice-graph-calculator" className="redbookprep-graph-calculator" aria-label="Graphing calculator"
    onCancel={event => {event.preventDefault(); close.current();}}
    onKeyDown={event => {if (event.key === 'Escape') {event.preventDefault(); close.current();} event.stopPropagation();}}>
    <div className="redbookprep-graph-bar" onPointerDown={event => {
      if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
      const dialog = panel.current!;
      const bounds = dialog.getBoundingClientRect();
      const dx = event.clientX - bounds.left, dy = event.clientY - bounds.top;
      const bar = event.currentTarget;
      bar.setPointerCapture(event.pointerId);
      const move = (pointer: PointerEvent) => {
        dialog.style.left = `${Math.max(0, Math.min(innerWidth - dialog.offsetWidth, pointer.clientX - dx))}px`;
        dialog.style.top = `${Math.max(0, Math.min(innerHeight - 48, pointer.clientY - dy))}px`;
      };
      const end = () => {bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', end); bar.removeEventListener('pointercancel', end);};
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', end);
      bar.addEventListener('pointercancel', end);
    }}>
      <strong>Graphing calculator</strong>
      <button type="button" aria-label="Close calculator" onClick={onClose}>Close</button>
    </div>
    <iframe ref={frame} title="RedBook Graph calculator" onLoad={sendTheme} />
  </dialog>;
}
