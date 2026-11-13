import type { LucideIcon } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  icon: LucideIcon
  error?: string
  registration?: UseFormRegisterReturn
}

export function FormField({
  id,
  label,
  icon: Icon,
  error,
  registration,
  ...inputProps
}: FormFieldProps) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
        <input id={id} {...registration} {...inputProps} aria-invalid={Boolean(error)} />
      </div>
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  )
}
