import type { ReactNode } from 'react'

export function Field({
  label,
  hint,
  children,
  wide,
}: {
  label: string
  hint?: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className={`field${wide ? ' field--wide' : ''}`}>
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  )
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  ariaLabel,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  ariaLabel?: string
}) {
  return (
    <span className="num">
      <input
        className="input"
        type="number"
        aria-label={ariaLabel}
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {suffix ? <span className="num__suffix">{suffix}</span> : null}
    </span>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  mono,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  mono?: boolean
}) {
  return (
    <input
      className={`input${mono ? ' input--mono' : ''}`}
      type="text"
      aria-label={ariaLabel ?? placeholder}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  small,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  ariaLabel?: string
  small?: boolean
}) {
  return (
    <select
      className={`select${small ? ' select--sm' : ''}`}
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__knob" />
      </span>
      <span className="toggle__label">{label}</span>
    </label>
  )
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  small,
  disabled,
  type = 'button',
  title,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle'
  small?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
  title?: string
}) {
  return (
    <button
      type={type}
      title={title}
      className={`btn btn--${variant}${small ? ' btn--sm' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'good' | 'warn' | 'bad'
}) {
  return (
    <div className={`stat${tone ? ` stat--${tone}` : ''}`}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {sub ? <span className="stat__sub">{sub}</span> : null}
    </div>
  )
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card${className ? ` ${className}` : ''}`}>
      {title || actions ? (
        <header className="card__head">
          <div>
            {title ? <h3 className="card__title">{title}</h3> : null}
            {subtitle ? <p className="card__sub">{subtitle}</p> : null}
          </div>
          {actions ? <div className="btn-row">{actions}</div> : null}
        </header>
      ) : null}
      <div className="card__body">{children}</div>
    </section>
  )
}

export function Badge({ children, tone }: { children: ReactNode; tone?: 'raw' | 'crafted' | 'ok' | 'warn' | 'bad' | 'info' }) {
  return <span className={`badge${tone ? ` badge--${tone}` : ''}`}>{children}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'good' | 'warn' | 'bad'
  title?: string
  children: ReactNode
}) {
  return (
    <div className={`callout callout--${tone}`}>
      {title ? <strong className="callout__title">{title}</strong> : null}
      <div>{children}</div>
    </div>
  )
}
