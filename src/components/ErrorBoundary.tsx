import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error inside React ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 font-sans">
          <div className="max-w-2xl w-full bg-slate-900 border border-red-500/30 rounded-3xl p-8 space-y-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-500">
              <span className="text-4xl">⚠️</span>
              <div>
                <h1 className="text-xl font-black uppercase tracking-wider">Erreur de rendu détectée</h1>
                <p className="text-xs text-slate-400">L'application a rencontré un problème inattendu lors de l'exécution.</p>
              </div>
            </div>

            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 font-mono text-xs text-red-400 overflow-auto max-h-60 space-y-2">
              <div className="font-bold text-sm text-red-500">
                {this.state.error?.name}: {this.state.error?.message}
              </div>
              {this.state.error?.stack && (
                <pre className="whitespace-pre-wrap text-[11px] leading-relaxed opacity-80">
                  {this.state.error.stack}
                </pre>
              )}
            </div>

            {this.state.errorInfo && (
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 font-mono text-[10px] text-slate-400 overflow-auto max-h-40">
                <div className="font-bold mb-1 text-slate-300">Composants concernés :</div>
                <pre className="whitespace-pre-wrap leading-tight">
                  {this.state.errorInfo.componentStack}
                </pre>
              </div>
            )}

            <div className="pt-4 flex justify-between items-center border-t border-slate-800">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition-all cursor-pointer active:scale-95"
              >
                Recharger l'application
              </button>
              <span className="text-[10px] font-mono text-slate-500">PD&I-TG • Diagnostic</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
