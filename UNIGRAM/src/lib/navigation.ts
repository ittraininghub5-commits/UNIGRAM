import { NavigateFunction } from 'react-router-dom';

export function safeNavigateBack(navigate: NavigateFunction, fallbackPath: string = '/feed') {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    navigate(-1);
    return;
  }

  navigate(fallbackPath, { replace: true });
}
