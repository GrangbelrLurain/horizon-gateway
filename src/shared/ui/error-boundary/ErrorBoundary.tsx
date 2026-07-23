import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/shared/ui/button/Button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReport?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
    this.props.onReport?.(error, info);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    const title = this.props.fallbackTitle ?? "Something went wrong";

    return (
      <div className="flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-4 bg-base-200 p-8 text-center">
        <div className="max-w-md rounded-2xl border border-error/20 bg-base-100 p-8 shadow-sm">
          <h2 className="mb-2 text-xl font-bold text-base-content">{title}</h2>
          <p className="mb-4 text-sm text-base-content/60">
            The UI hit an unexpected error. You can try recovering without losing the rest of the session.
          </p>
          <pre className="mb-6 max-h-32 overflow-auto rounded-lg bg-base-200 p-3 text-left text-xs text-error/80">
            {error.message}
          </pre>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={this.handleReset}>
              Try again
            </Button>
            <Button variant="primary" onClick={this.handleReload}>
              Reload app
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
