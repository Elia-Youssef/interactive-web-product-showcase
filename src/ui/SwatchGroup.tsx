import { useRef, type KeyboardEvent } from 'react'
import { radioKeyTarget } from './swatchGroup.logic'
import { Swatch } from './Swatch'
import styles from './SwatchGroup.module.css'
import { joinClassNames } from './joinClassNames'

export type SwatchGroupItem = {
  // The choice's key, handed back by onSelect.
  readonly key: string
  // The finish color, the one non-token color a swatch paints.
  readonly color: string
  // The choice's accessible name.
  readonly label: string
  // Whether this choice is the group's one checked one.
  readonly checked: boolean
}

export type SwatchGroupProps = {
  // The group's accessible name: the section the choices belong to.
  label: string
  // The choices, in the order the arrows walk.
  items: readonly SwatchGroupItem[]
  // Hands back the key of the choice the visitor chose, by click or arrow.
  onSelect: (key: string) => void
  className?: string
}

// A single-choice group of swatches: a radiogroup whose members are
// radios, per the ARIA radio pattern. The checked radio is the group's one
// tab stop, and the arrow keys move the choice with the focus, wrapping at
// the ends; Home and End jump there. The checked state comes from the
// caller with the items, and every move reports through onSelect, so the
// group owns the walk and the caller owns the choice.
export function SwatchGroup({ label, items, onSelect, className }: SwatchGroupProps) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const focused = event.target
    if (!(focused instanceof HTMLButtonElement)) {
      return
    }
    const target = radioKeyTarget(event.key, buttonsRef.current.indexOf(focused), items.length)
    if (target === null) {
      return
    }
    const item = items[target]
    if (item === undefined) {
      return
    }
    event.preventDefault()
    buttonsRef.current[target]?.focus()
    onSelect(item.key)
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={joinClassNames(styles.group, className)}
      onKeyDown={onKeyDown}
    >
      {items.map((item, index) => (
        <Swatch
          key={item.key}
          ref={(button) => {
            buttonsRef.current[index] = button
          }}
          color={item.color}
          label={item.label}
          checked={item.checked}
          tabIndex={item.checked ? 0 : -1}
          onClick={() => onSelect(item.key)}
        />
      ))}
    </div>
  )
}
