// Every primitive in every state: default, hover forced through the
// data-force-hover attribute the primitives accept, selected through its
// prop, and focus forced through the gallery's forceFocus class, which
// composes the focus tokens exactly as the global :focus-visible recipe
// does. The copy is neutral sample content of realistic length: product
// copy belongs only in src/products/.

import type { ReactNode } from 'react'
import {
  Card,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  Divider,
  Eyebrow,
  IconButton,
  Marker,
  MinusIcon,
  PlusIcon,
  Readout,
  ResetIcon,
  Swatch,
  TextButton,
  Title,
} from '@ui/index'
import styles from './gallery.module.css'

// The gallery is a static look review: closing a card has nothing to do.
const noOp = () => {}

const cardProps = {
  eyebrow: 'A closer look',
  title: 'Ported acoustic chamber',
  bullets: ['Two-way crossover', 'Passive radiator', 'Front-firing port'],
  onClose: noOp,
  closeLabel: 'Close',
}

function StatesSection({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <Eyebrow>{name}</Eyebrow>
      <div className={styles.states}>{children}</div>
    </section>
  )
}

function State({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className={styles.state}>
      {children}
      <figcaption>
        <Readout>{caption}</Readout>
      </figcaption>
    </figure>
  )
}

const eyebrowStates = (
  <State caption="default">
    <Eyebrow>Compact speaker / 000</Eyebrow>
  </State>
)

const titleStates = (
  <State caption="default">
    <Title brand="Sample" model="One" />
  </State>
)

const cardStates = (
  <>
    <State caption="default">
      <Card {...cardProps} />
    </State>
    <State caption="close hover">
      <Card {...cardProps} data-force-hover />
    </State>
    <State caption="close focus">
      <Card {...cardProps} data-force-focus />
    </State>
  </>
)

const textButtonStates = (
  <>
    <State caption="default">
      <TextButton>See inside</TextButton>
    </State>
    <State caption="hover">
      <TextButton data-force-hover>See inside</TextButton>
    </State>
    <State caption="selected">
      <TextButton selected>See inside</TextButton>
    </State>
    <State caption="focus">
      <TextButton className={styles.forceFocus}>See inside</TextButton>
    </State>
  </>
)

const iconButtonStates = (
  <>
    <State caption="default">
      <IconButton aria-label="Zoom in">
        <PlusIcon />
      </IconButton>
    </State>
    <State caption="hover">
      <IconButton aria-label="Zoom out" data-force-hover>
        <MinusIcon />
      </IconButton>
    </State>
    <State caption="focus">
      <IconButton aria-label="Reset view" className={styles.forceFocus}>
        <ResetIcon />
      </IconButton>
    </State>
  </>
)

const swatchStates = (
  <>
    <State caption="default">
      <Swatch color="#9db89d" label="Sage Green" />
    </State>
    <State caption="hover">
      <Swatch color="#9db89d" label="Sage Green" data-force-hover />
    </State>
    <State caption="selected">
      <Swatch color="#2b2e2c" label="Graphite" selected />
    </State>
    <State caption="focus">
      <Swatch color="#9db89d" label="Sage Green" className={styles.forceFocus} />
    </State>
    <State caption="selected + focus">
      <Swatch color="#2b2e2c" label="Graphite" selected className={styles.forceFocus} />
    </State>
  </>
)

const iconStates = (
  <>
    <State caption="close">
      <CloseIcon />
    </State>
    <State caption="plus">
      <PlusIcon />
    </State>
    <State caption="minus">
      <MinusIcon />
    </State>
    <State caption="reset">
      <ResetIcon />
    </State>
    <State caption="chevron left">
      <ChevronLeftIcon />
    </State>
    <State caption="chevron right">
      <ChevronRightIcon />
    </State>
  </>
)

const markerStates = (
  <>
    <State caption="default">
      <div className={styles.markerCell}>
        <Marker label="Ported chamber" />
      </div>
    </State>
    <State caption="active">
      <div className={styles.markerCell}>
        <Marker label="Ported chamber" active />
      </div>
    </State>
    <State caption="hover">
      <div className={styles.markerCell}>
        <Marker label="Ported chamber" data-force-hover />
      </div>
    </State>
    <State caption="focus">
      <div className={styles.markerCell}>
        <Marker label="Ported chamber" className={styles.forceFocus} />
      </div>
    </State>
  </>
)

const dividerStates = (
  <State caption="default">
    <div className={styles.ruleCell}>
      <Divider />
    </div>
  </State>
)

const readoutStates = (
  <State caption="default">
    <Readout>127 / 360</Readout>
  </State>
)

const sections: Record<string, ReactNode> = {
  Eyebrow: eyebrowStates,
  Title: titleStates,
  Card: cardStates,
  TextButton: textButtonStates,
  IconButton: iconButtonStates,
  Swatch: swatchStates,
  Icons: iconStates,
  Marker: markerStates,
  Divider: dividerStates,
  Readout: readoutStates,
}

export function PrimitiveStates() {
  return (
    <div className={styles.stack}>
      {Object.entries(sections).map(([name, states]) => (
        <StatesSection key={name} name={name}>
          {states}
        </StatesSection>
      ))}
    </div>
  )
}
