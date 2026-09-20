import { Component } from 'react';

/**
 * Keeps one page's failure from blanking the site. A report function that throws on unexpected data
 * should cost that demo its page, with the message on screen, and leave the navigation working.
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="callout error" role="alert">
        <strong>This page could not be drawn.</strong>
        <p>{String(this.state.error?.message ?? this.state.error)}</p>
        <p className="meta">The rest of the site still works. If this is a demo, its report or view threw on the recorded data; the message above says where to look.</p>
      </div>
    );
  }
}
