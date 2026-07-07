'use client'

import { Component, type ReactNode } from 'react'
import ErrorCard from './ErrorCard'

type Props = { children: ReactNode; label?: string }
type State = { error: Error | null }

// Catches render errors in one admin section so the rest of the page keeps working.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    // Hook point for error reporting (Sentry et al.) once wired up.
    console.error('[admin] section render failed:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorCard
          message={this.props.label ? `${this.props.label} failed to load.` : 'This section failed to load.'}
          onRetry={() => this.setState({ error: null })}
        />
      )
    }
    return this.props.children
  }
}
