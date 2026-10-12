import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { ComponentType } from 'react'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CloseIcon,
  MinusIcon,
  PlusIcon,
  ResetIcon,
  type IconProps,
} from './index'

const icons: Record<string, ComponentType<IconProps>> = {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CloseIcon,
  MinusIcon,
  PlusIcon,
  ResetIcon,
}

test.each(Object.entries(icons))(
  '%s renders a decorative svg stroked in currentColor',
  (_name, Icon) => {
    const html = renderToString(<Icon />)

    expect(html).toMatch(/^<svg/)
    expect(html).toContain('stroke="currentColor"')
    expect(html).toContain('fill="none"')
    expect(html).toContain('aria-hidden="true"')
  },
)

test.each(Object.entries(icons))('%s takes a size', (_name, Icon) => {
  const html = renderToString(<Icon size={24} />)

  expect(html).toContain('width="24"')
  expect(html).toContain('height="24"')
})
