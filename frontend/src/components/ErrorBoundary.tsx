import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Card } from './ui';

interface ErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string;
  title?: string;
  body?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && this.props.resetKey !== prevProps.resetKey) {
      this.setState({ hasError: false });
    }
  }

  private handleGoHome = () => {
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-[60vh] items-center justify-center py-12">
        <Card variant="glass" padding="lg" className="w-full max-w-md text-center">
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-accent-focus)]">
              Something glitched
            </p>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {this.props.title ?? 'This page needs a reset.'}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              {this.props.body ?? "Anchor hit an unexpected error. You can head home and keep going."}
            </p>
          </div>

          <div className="mt-6">
            <Button fullWidth size="lg" onClick={this.handleGoHome}>
              Go Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }
}
