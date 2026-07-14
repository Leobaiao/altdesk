import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="pricing-field">
      <span className="pricing-field__label">{label}</span>
      {children}
      {hint && <small className="pricing-field__hint">{hint}</small>}
    </label>
  );
}
