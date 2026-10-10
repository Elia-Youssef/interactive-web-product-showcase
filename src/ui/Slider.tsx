// The range slider: a native input of type range over the unit interval,
// so keyboard, touch and screen readers work as the platform built them.
// The accessible name and the value text are required: an unnamed slider
// is an unlabeled control, and the value text is what assistive tech
// announces instead of the raw value, so the caller formats it and the
// readout beside the slider says the same thing. The caller owns the copy
// and the formatting; the primitive never formats numbers. A control that
// waits while it may hold focus takes `unavailable`, never the disabled
// attribute; the rule lives in unavailable.ts, shared with every primitive
// of the library.

import type { ComponentProps, ReactElement } from 'react'
import styles from './Slider.module.css'
import { joinClassNames } from './joinClassNames'
import {
  ignoresActivation,
  stopKeyAction,
  unavailableAttributes,
  type UnavailableProps,
} from './unavailable'

// The filled fraction of the slider's track, as the percentage the track's
// gradient stops read. The component writes it on the input; this widening
// names the one custom property the slider's stylesheet composes, so the
// style prop stays typed instead of cast.
declare module 'react' {
  export interface CSSProperties {
    '--slider-fill'?: string
  }
}

type SliderBase = Omit<
  ComponentProps<'input'>,
  | 'type'
  | 'min'
  | 'max'
  | 'step'
  | 'value'
  | 'defaultValue'
  | 'style'
  | 'onChange'
  | 'onKeyDown'
  | 'aria-label'
  | 'aria-valuetext'
  | 'aria-disabled'
>

export type SliderProps = SliderBase &
  UnavailableProps & {
    // The value in [0, 1].
    value: number
    // The granularity of the native steps, in progress units.
    step: number
    // The accessible name.
    'aria-label': string
    // What assistive tech announces as the value, the readout's own text.
    valueText: string
    // Hands back the value the input moved to.
    onChange: (value: number) => void
    // The keys of the slider while it is available: while it waits, the
    // primitive takes the keys on itself, because a range input moves to its
    // keys by their default action.
    onKeyDown?: ComponentProps<'input'>['onKeyDown']
  }

// The element return type is explicit, so the primitive is a plain function
// of its props to its element: the wiring a renderer would attach is the
// element's own props, which the contract tests read directly.
export function Slider({
  value,
  step,
  valueText,
  unavailable,
  disabled,
  className,
  onChange,
  onKeyDown,
  ...rest
}: SliderProps): ReactElement<SliderProps> {
  // While the control waits, its keys are held: the pointer half is the
  // stylesheet's pointer-events rule on the same state, and the field
  // declares itself read only, the word React takes for a controlled field
  // that answers no change handler.
  const holdKeys = ignoresActivation({ disabled, unavailable })
  return (
    <input
      {...rest}
      {...unavailableAttributes(unavailable)}
      type="range"
      min={0}
      max={1}
      step={step}
      value={value}
      aria-valuetext={valueText}
      disabled={disabled}
      readOnly={holdKeys || undefined}
      className={joinClassNames(styles.slider, className)}
      style={{ '--slider-fill': `${value * 100}%` }}
      onKeyDown={holdKeys ? stopKeyAction : onKeyDown}
      onChange={holdKeys ? undefined : (event) => onChange(event.currentTarget.valueAsNumber)}
    />
  )
}
