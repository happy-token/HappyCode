import React, { useState } from 'react'
import type { ValidWidgetConfig } from '../widget-schema'

type FormField = { type: string; label: string; options?: string[]; validation?: Record<string, unknown> }
type FormData = { fields: FormField[] }

export function FormWidget({ config }: { config: ValidWidgetConfig }): React.JSX.Element {
  const data = config.data as FormData
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    for (const field of data.fields) {
      const val = values[field.label] ?? ''
      if (field.validation?.required && !val) {
        newErrors[field.label] = 'Required'
      }
      if (field.validation?.minLength && val.length < (field.validation.minLength as number)) {
        newErrors[field.label] = `Min ${field.validation.minLength} characters`
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validate()) setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="widget widget-form">
        <div className="widget-header">
          <span className="widget-title">{config.title}</span>
          <span className="widget-type-badge">FORM</span>
        </div>
        <div className="widget-form-success">Form submitted successfully!</div>
        <pre className="widget-form-data">{JSON.stringify(values, null, 2)}</pre>
      </div>
    )
  }

  return (
    <div className="widget widget-form">
      <div className="widget-header">
        <span className="widget-title">{config.title}</span>
        <span className="widget-type-badge">FORM</span>
      </div>
      <div className="widget-form-fields">
        {data.fields.map((field) => (
          <div key={field.label} className="widget-form-field">
            <label>{field.label}</label>
            {field.type === 'select' && field.options ? (
              <select
                value={values[field.label] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.label]: e.target.value }))}
                className="widget-form-select"
              >
                <option value="">Select...</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea
                value={values[field.label] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.label]: e.target.value }))}
                className="widget-form-textarea"
                rows={3}
              />
            ) : field.type === 'checkbox' ? (
              <input
                type="checkbox"
                checked={!!values[field.label]}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.label]: e.target.checked ? 'true' : '' }))}
              />
            ) : (
              <input
                type={field.type === 'number' ? 'number' : 'text'}
                value={values[field.label] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.label]: e.target.value }))}
                className="widget-form-input"
              />
            )}
            {errors[field.label] && (
              <span className="widget-form-error">{errors[field.label]}</span>
            )}
          </div>
        ))}
      </div>
      <button className="widget-btn-primary" onClick={handleSubmit}>Submit</button>
    </div>
  )
}
