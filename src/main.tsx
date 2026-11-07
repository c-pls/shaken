import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Prevent browser/Android system context menu & selection toolbar on long-press (except in inputs & textareas)
window.addEventListener(
  'contextmenu',
  (e) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }
    e.preventDefault();
  },
  { passive: false }
);

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('[Hagane] Uncaught render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f2f4f7] flex items-center justify-center p-5 text-slate-900">
          <div className="bg-white rounded-[24px] p-6 max-w-sm w-full shadow-lg border border-red-100 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <div className="space-y-1">
              <h1 className="font-extrabold text-base text-slate-900">
                Đã xảy ra lỗi hiển thị / Display Error
              </h1>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ứng dụng gặp dữ liệu không hợp lệ. Bạn có thể tải lại hoặc đặt lại bộ nhớ đệm.
              </p>
            </div>
            {this.state.errorMessage && (
              <pre className="text-[11px] bg-slate-100 text-slate-600 p-2.5 rounded-xl overflow-x-auto text-left">
                {this.state.errorMessage}
              </pre>
            )}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                Tải lại ứng dụng / Reload App
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    const raw = localStorage.getItem('hagane_routines_v1');
                    const existingBak = localStorage.getItem('hagane_routines_v1_corrupt_bak');
                    if (existingBak && raw) {
                      localStorage.setItem(`hagane_routines_v1_corrupt_bak_${Date.now()}`, existingBak);
                    }
                    if (raw) {
                      localStorage.setItem('hagane_routines_v1_corrupt_bak', raw);
                    }
                    localStorage.removeItem('hagane_routines_v1');
                  } catch {
                    // ignore
                  }
                  window.location.reload();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Đặt lại dữ liệu lỗi / Reset Corrupted Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
