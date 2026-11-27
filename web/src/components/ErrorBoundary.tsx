// A render crash must never leave a phone on a blank screen during the demo: show it and offer a reload.
import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  override componentDidCatch(error: Error) { console.error('render crashed:', error); }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="screen" style={{ justifyContent: 'center' }}>
        <h1 className="t-h2">Something went wrong</h1>
        <p className="t-body text-2" data-error>{this.state.error.message}</p>
        <button type="button" className="btn btn--primary" onClick={() => location.assign('/')}>Reload</button>
      </main>
    );
  }
}
