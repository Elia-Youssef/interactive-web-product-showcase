// Every primitive in every state: default, hover forced through the
// data-force-hover attribute the primitives accept, selected through its
// prop, and focus forced through the gallery's forceFocus class, which
// composes the focus tokens exactly as the global :focus-visible recipe
// does. The interactive controls run in ControlStates; this file holds
// the words and marks. The copy is neutral sample content of realistic
// length: product copy belongs only in src/products/.

import type { ReactNode } from 'react'
import {
  Card,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  Divider,
  Eyebrow,
  Marker,
  MinusIcon,
  PlusIcon,
  Readout,
  ResetIcon,
  Title,
} from '@ui/index'
import { controlSections } from './ControlStates'
import { State, StatesSection } from './States'
import styles from './gallery.module.css'

const noOp = () => {}

const cardProps = {
  eyebrow: 'A closer look',
  title: 'Ported acoustic chamber',
  bullets: ['Two-way crossover', 'Passive radiator', 'Front-firing port'],
  onClose: noOp,
  closeLabel: 'Close',
}

const eyebrowStates = (
  <>
    <State caption="default">
      <Eyebrow>Compact speaker</Eyebrow>
    </State>
    <State caption="with tail">
      <Eyebrow tail="/ 000">Compact speaker</Eyebrow>
    </State>
  </>
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
  Icons: iconStates,
  Marker: markerStates,
  Divider: dividerStates,
  Readout: readoutStates,
  ...controlSections,
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
