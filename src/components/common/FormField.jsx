import { useId } from 'react';

export default function FormField({
  label,
  id,
  as: Control = 'input',
  type = 'text',
  error,
  hint,
  required = false,
  className = '',
  children,
  ...rest
}) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');
  const isCheckbox = Control === 'input' && type === 'checkbox';
  const commonProps = {
    id: fieldId,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
    'aria-required': required || undefined,
    ...rest,
  };

  const message = (
    <>
      {hint ? (
        <p className="form-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="form-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </>
  );

  if (isCheckbox) {
    return (
      <div
        className={`form-field form-field--checkbox${error ? ' has-error' : ''}${className ? ` ${className}` : ''}`}
      >
        <label className="form-field__checkbox-label" htmlFor={fieldId}>
          <input {...commonProps} type="checkbox" checked={Boolean(rest.checked)} />
          <span>{label}</span>
          {required ? <span className="sr-only"> (required)</span> : null}
        </label>
        {message}
      </div>
    );
  }

  return (
    <div className={`form-field${error ? ' has-error' : ''}${className ? ` ${className}` : ''}`}>
      <label className="form-field__label" htmlFor={fieldId}>
        {label}
        {required ? <span className="form-field__required" aria-hidden="true"> *</span> : null}
      </label>
      {Control === 'textarea' ? (
        <textarea {...commonProps} required={required} />
      ) : Control === 'select' ? (
        <select {...commonProps} required={required}>
          {children}
        </select>
      ) : (
        <Control {...commonProps} type={type} required={required} />
      )}
      {message}
    </div>
  );
}
