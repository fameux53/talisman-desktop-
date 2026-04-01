import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useI18n } from '../i18n';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

function ErrorFallback() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-[var(--c-bg)] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <p className="text-5xl mb-4">⚠️</p>
        <h1 className="font-heading text-xl font-bold text-[var(--c-text)] mb-2">
          {t('error.boundary_title')}
        </h1>
        <p className="text-sm text-[var(--c-text2)] mb-6">
          {t('error.boundary_body')}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn h-12 px-8 rounded-xl gradient-primary text-white font-heading font-bold shadow-md"
        >
          {t('error.boundary_refresh')}
        </button>
      </div>
    </div>
  );
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[MarketMama] Unhandled error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
