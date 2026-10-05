// The scaffolding of the gallery sections: one named section per primitive,
// one captioned state per figure. The captions come from the caller; the
// styling is the gallery's own.

import type { ReactNode } from 'react'
import { Eyebrow, Readout } from '@ui/index'
import styles from './gallery.module.css'

export function StatesSection({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <Eyebrow>{name}</Eyebrow>
      <div className={styles.states}>{children}</div>
    </section>
  )
}

export function State({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className={styles.state}>
      {children}
      <figcaption>
        <Readout>{caption}</Readout>
      </figcaption>
    </figure>
  )
}
