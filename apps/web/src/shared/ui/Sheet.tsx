'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/** Bottom sheet on phones, centered dialog on wide screens, built on the native <dialog>. */
export function Sheet(props: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (props.open && !dialog.open) dialog.showModal();
    if (!props.open && dialog.open) dialog.close();
  }, [props.open]);
  return (
    <dialog ref={ref} className="sheet" aria-label={props.title} onClose={props.onClose}
      onClick={(event) => { if (event.target === ref.current) props.onClose(); }}>
      <div className="sheet-body">
        <span className="sheet-grip" aria-hidden />
        <h2>{props.title}</h2>
        {props.children}
      </div>
    </dialog>
  );
}
