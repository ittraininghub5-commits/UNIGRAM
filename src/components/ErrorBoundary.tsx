import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected application error.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('UI crash captured by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg-base text-text-primary flex items-center justify-center px-4">
          <div className="max-w-lg w-full bg-bg-card border border-white/10 rounded-3xl p-8 space-y-5 text-center">
            <h1 className="text-2xl font-display font-extrabold tracking-tight">Something went wrong</h1>
            <p className="text-sm text-text-secondary">
              A page error occurred, but your session is still safe. Try reloading this page.
            </p>
            {this.state.message && (
              <p className="text-xs text-accent-amber bg-accent-amber/10 border border-accent-amber/20 rounded-xl p-3 break-words">
                {this.state.message}
              </p>
            )}
            <button
              onClick={this.handleReload}
              className="bg-accent-teal hover:brightness-110 text-bg-base px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

