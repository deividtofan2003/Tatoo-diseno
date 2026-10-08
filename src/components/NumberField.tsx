'use client';

import React, { useRef } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Campo de número con flechas propias (+1 / -1) más bonitas que las del navegador.
 * Se puede seguir escribiendo a mano. Acepta los mismos props que un <input>.
 */
export default function NumberField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null);

  const bump = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el || el.disabled || el.readOnly) return;
    const step = Number(props.step) || 1;
    const current = el.value === '' ? 0 : Number(el.value);
    let next = Math.round((current + dir * step) * 1000) / 1000;
    if (props.min !== undefined && next < Number(props.min)) next = Number(props.min);
    if (props.max !== undefined && next > Number(props.max)) next = Number(props.max);
    // Cambia el valor como si lo hubiera escrito el usuario, así React recibe el onChange normal
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(el, String(next));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  return (
    <div className="number-field">
      <input ref={ref} {...props} type="number" />
      <div className="number-field-arrows">
        <button type="button" tabIndex={-1} aria-label="Sumar" onClick={() => bump(1)}>
          <ChevronUp className="w-3 h-3" />
        </button>
        <button type="button" tabIndex={-1} aria-label="Restar" onClick={() => bump(-1)}>
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
