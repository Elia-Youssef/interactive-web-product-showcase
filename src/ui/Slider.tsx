// The range slider: a native input of type range over the unit interval,
// so keyboard, touch and screen readers work as the platform built them.
// The accessible name and the value text are required: an unnamed slider
// is an unlabeled control, and the value text is what assistive tech
// announces instead of the raw value, so the caller formats it and the
// readout beside the slider says the same thing. The caller owns the copy
// and the formatting; the primitive never formats numbers.

import type { ComponentProps } from 'react'
import styles from './Slider.module.css'
import { joinClassNames } from './joinClassNames'

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
  | 'aria-label'
  | 'aria-valuetext'
>

export type SliderProps = SliderBase & {
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
}

export function Slider({
  value,
  step,
  valueText,
  className,
  onChange,
  ...rest
}: SliderProps) {
  return (
    <input
      {...rest}
      type="range"
      min={0}
      max={1}
      step={step}
      value={value}
      aria-valuetext={valueText}
      className={joinClassNames(styles.slider, className)}
      style={{ '--slider-fill': `${value * 100}%` }}
      onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
    />
  )
}
