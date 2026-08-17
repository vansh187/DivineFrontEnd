import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rendered in place of the crashed subtree. Defaults to rendering nothing,
   * so an isolated boundary (e.g. around ChatWidget) can fail silently
   * without taking the rest of the page down with it. */
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/** Catches render/lifecycle errors in its subtree so one broken component
 * (e.g. a bug in the chat widget) can't blank out the entire app. Does not
 * catch errors from event handlers or async code — those are handled at
 * their own call sites (see chatApi's ApiError handling). */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('ErrorBoundary caught an error:', error, info);
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
