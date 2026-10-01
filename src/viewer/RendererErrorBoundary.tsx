import { Component, type ReactNode } from 'react'
import { asError } from '@lib/errors'

type RendererErrorBoundaryProps = {
  readonly children: ReactNode
  // Every caught error is reported to the owner, never swallowed: the owner
  // turns it into the store's failed status.
  readonly onError: (error: Error) => void
  readonly fallback: (error: Error) => ReactNode
}

type RendererErrorBoundaryState = {
  readonly error: Error | null
}

// React error boundaries need a class. This one exists so a renderer that
// cannot start reaches the store as a typed failure and the page shows the
// error state, instead of the tab staying blank.
export class RendererErrorBoundary extends Component<
  RendererErrorBoundaryProps,
  RendererErrorBoundaryState
> {
  override state: RendererErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): RendererErrorBoundaryState {
    return { error: asError(error) }
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError(asError(error))
  }

  override render(): ReactNode {
    const { error } = this.state
    return error === null ? this.props.children : this.props.fallback(error)
  }
}
