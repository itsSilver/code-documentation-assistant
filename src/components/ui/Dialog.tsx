"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "@/components/ui/Icons";

type Props = { title: string; description?: string; onClose: () => void; children: ReactNode };

export function Dialog({ title, description, onClose, children }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("input, button:not([aria-label='Close'])")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        ref={panel}
      >
        <header className="dialog-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descId}>{description}</p>}
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
