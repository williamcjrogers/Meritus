"use client";

import { useId, useRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

type FieldContent = { label: ReactNode; help?: ReactNode; error?: string; className?: string };
export function Field({ label, help, error, id, className = "", ...props }: FieldContent & InputHTMLAttributes<HTMLInputElement>) {
  const generated = useId();
  const fieldId = id ?? generated;
  const describedBy = [props["aria-describedby"], help ? `${fieldId}-help` : null, error ? `${fieldId}-error` : null].filter(Boolean).join(" ") || undefined;
  return <div className="app-field-group"><label className="app-label" htmlFor={fieldId}>{label}</label><input {...props} id={fieldId} className={`app-field ${className}`} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={describedBy} />{help && <p className="app-field-help" id={`${fieldId}-help`}>{help}</p>}{error && <p className="app-field-error" role="alert" id={`${fieldId}-error`}>{error}</p>}</div>;
}

export function Textarea({ label, help, error, id, className = "", ...props }: FieldContent & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generated = useId();
  const fieldId = id ?? generated;
  return <div className="app-field-group"><label className="app-label" htmlFor={fieldId}>{label}</label><textarea {...props} id={fieldId} className={`app-field resize-none ${className}`} aria-invalid={error ? true : undefined} aria-describedby={[help ? `${fieldId}-help` : null, error ? `${fieldId}-error` : null].filter(Boolean).join(" ") || undefined} />{help && <p className="app-field-help" id={`${fieldId}-help`}>{help}</p>}{error && <p className="app-field-error" role="alert" id={`${fieldId}-error`}>{error}</p>}</div>;
}

export function SearchField({ value, onClear, label = "Search", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "value"> & { value: string; onClear: () => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return <div className="app-search"><input {...props} ref={ref} type="search" aria-label={label} value={value} className={`app-field ${props.className ?? ""}`} />{value && <button type="button" className="app-button app-button--ghost app-search-clear" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => { onClear(); ref.current?.focus(); }}>Clear</button>}</div>;
}
