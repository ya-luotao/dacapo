import { Component, type ReactNode } from 'react';

/** A text whose code could not be downloaded (offline, or a new version replaced it). */
export class LoadBoundary extends Component<{ fallback: ReactNode; children: ReactNode }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
