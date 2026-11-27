import React from 'react';
import { ShieldAlert, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Възникна неочаквана грешка в приложението.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyMsg = 'Възникна неочаквана грешка при зареждането на интерфейса. Моля, опитайте да презаредите страницата.';
      if (this.state.message.includes('401') || this.state.message.includes('403') || this.state.message.includes('Unauthorized')) {
        friendlyMsg = 'Нямате достатъчни права за тази операция. Влезте с вашия профил и опитайте отново.';
      } else if (this.state.message.includes('429') || this.state.message.includes('Quota exceeded')) {
        friendlyMsg = 'Сървърът е временно натоварен или дневният лимит е достигнат. Моля, опитайте отново след малко.';
      }

      return (
        <div className="min-h-screen bg-[#FBF9F5] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl border border-stone-200 shadow-xl p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h2 className="font-editorial text-2xl font-bold text-stone-950">
              Временна системна грешка
            </h2>
            <p className="text-sm text-stone-600 leading-relaxed">{friendlyMsg}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-liquid-amber px-6 py-2.5 rounded-full text-xs font-bold text-stone-950 inline-flex items-center gap-2 shadow-md cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Презареди приложението</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
