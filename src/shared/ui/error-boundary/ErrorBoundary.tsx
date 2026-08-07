import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/shared/ui/button/Button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReport?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary caught crash]", error, info);
    this.setState({ errorInfo: info });
    this.props.onReport?.(error, info);
  }

  private handleReset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearStorageAndReload = () => {
    if (window.confirm("App storage will be reset to default. Continue?")) {
      try {
        localStorage.clear();
      } catch (e) {
        console.error("Failed to clear localStorage", e);
      }
      window.location.reload();
    }
  };

  render() {
    const { error, errorInfo } = this.state;
    if (!error) {
      return this.props.children;
    }

    const title = this.props.fallbackTitle ?? "Horizon Gateway Error";

    return (
      <div className="flex flex-1 h-full min-h-screen w-full flex-col items-center justify-center gap-4 bg-base-200 p-8 text-center">
        <div className="max-w-xl w-full rounded-2xl border border-error/30 bg-base-100 p-8 shadow-lg flex flex-col gap-4">
          <div className="flex flex-col gap-1 items-center">
            <h2 className="text-xl font-bold text-base-content">{title}</h2>
            <p className="text-xs text-base-content/60 max-w-sm leading-relaxed">
              The UI hit an unexpected error. You can try recovering or resetting local app state.
            </p>
          </div>

          <div className="flex flex-col gap-1 text-left">
            <span className="text-[10px] font-bold text-error uppercase tracking-wider">Error Details</span>
            <pre className="max-h-48 overflow-auto rounded-xl bg-base-200 p-3 text-xs font-mono text-error/90 border border-base-300 leading-relaxed whitespace-pre-wrap">
              {error.name}: {error.message}
              {error.stack ? `\n\nStack:\n${error.stack}` : ""}
              {errorInfo?.componentStack ? `\n\nComponent Stack:\n${errorInfo.componentStack}` : ""}
            </pre>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={this.handleReset}>
              Try again
            </Button>
            <Button variant="primary" size="sm" onClick={this.handleReload}>
              Reload app
            </Button>
            <Button variant="ghost" size="sm" className="text-error text-xs" onClick={this.handleClearStorageAndReload}>
              Reset local storage
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
