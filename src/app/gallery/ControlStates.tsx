// The gallery sections of the interactive controls: text button, icon
// button, icon link, swatch, slider and disclosure, each in every state. The gallery
// is a static look review: pressing and moving have nothing to do here,
// so every control idles behind a no-op.

import type { ReactNode } from 'react'
import { highlightsLabel } from '@lib/copy/productPanel'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Disclosure,
  IconLink,
  IconButton,
  MinusIcon,
  PlusIcon,
  ResetIcon,
  Slider,
  Swatch,
  TextButton,
} from '@ui/index'
import type { LinkProps } from '@ui/index'
import { State } from './States'
import styles from './gallery.module.css'

const noOp = () => {}

// The gallery's stand-in for the app's link: a plain anchor with the
// contract's props, so the states render without a router.
function StandInLink({ to, children, ...rest }: LinkProps) {
  return (
    <a href={to} {...rest}>
      {children}
    </a>
  )
}

const sliderProps = {
  'aria-label': 'Sample amount',
  value: 0.5,
  step: 0.01,
  valueText: '50%',
  onChange: noOp,
}

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

const iconLinkStates = (
  <>
    <State caption="default">
      <IconLink link={StandInLink} to="/p/sample-one" aria-label="Previous: Sample One">
        <ChevronLeftIcon />
      </IconLink>
    </State>
    <State caption="hover">
      <IconLink
        link={StandInLink}
        to="/p/sample-one"
        aria-label="Previous: Sample One"
        data-force-hover
      >
        <ChevronLeftIcon />
      </IconLink>
    </State>
    <State caption="focus">
      <IconLink
        link={StandInLink}
        to="/p/sample-one"
        aria-label="Previous: Sample One"
        className={styles.forceFocus}
      >
        <ChevronLeftIcon />
      </IconLink>
    </State>
    <State caption="next">
      <IconLink link={StandInLink} to="/p/sample-two" aria-label="Next: Sample Two">
        <ChevronRightIcon />
      </IconLink>
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
    <State caption="checked">
      <Swatch color="#2b2e2c" label="Graphite" checked />
    </State>
    <State caption="focus">
      <Swatch color="#9db89d" label="Sage Green" className={styles.forceFocus} />
    </State>
    <State caption="checked + focus">
      <Swatch color="#2b2e2c" label="Graphite" checked className={styles.forceFocus} />
    </State>
  </>
)

const sliderStates = (
  <>
    <State caption="default">
      <div className={styles.sliderCell}>
        <Slider {...sliderProps} />
      </div>
    </State>
    <State caption="hover">
      <div className={styles.sliderCell}>
        <Slider {...sliderProps} data-force-hover />
      </div>
    </State>
    <State caption="focus">
      <div className={styles.sliderCell}>
        <Slider {...sliderProps} className={styles.forceFocus} />
      </div>
    </State>
    <State caption="disabled">
      <div className={styles.sliderCell}>
        <Slider {...sliderProps} disabled />
      </div>
    </State>
  </>
)

const disclosureContent = <p>Neutral sample content.</p>
const disclosureLabel = highlightsLabel(3)

const disclosureStates = (
  <>
    <State caption="closed">
      <Disclosure label={disclosureLabel} expanded={false} onToggle={noOp}>
        {disclosureContent}
      </Disclosure>
    </State>
    <State caption="hover">
      <Disclosure label={disclosureLabel} expanded={false} onToggle={noOp} data-force-hover>
        {disclosureContent}
      </Disclosure>
    </State>
    <State caption="focus">
      <Disclosure label={disclosureLabel} expanded={false} onToggle={noOp} data-force-focus>
        {disclosureContent}
      </Disclosure>
    </State>
    <State caption="open">
      <Disclosure label={disclosureLabel} expanded onToggle={noOp}>
        {disclosureContent}
      </Disclosure>
    </State>
  </>
)

export const controlSections: Record<string, ReactNode> = {
  TextButton: textButtonStates,
  IconButton: iconButtonStates,
  IconLink: iconLinkStates,
  Swatch: swatchStates,
  Slider: sliderStates,
  Disclosure: disclosureStates,
}
