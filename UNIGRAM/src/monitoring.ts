import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';

type MonitoringProperties = Record<string, unknown>;

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';
const environment = import.meta.env.VITE_APP_ENV || import.meta.env.MODE;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

let initialized = false;
let fetchInstrumented = false;
let performanceInstrumented = false;
let errorsInstrumented = false;

function isBrowser() {
  return typeof window !== 'undefined';
}

function sanitizeUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl, isBrowser() ? window.location.origin : undefined);
    return url.pathname;
  } catch {
    return rawUrl.split('?')[0] || rawUrl;
  }
}

function classifyRequest(rawUrl: string): MonitoringProperties {
  const path = sanitizeUrl(rawUrl);

  if (supabaseUrl && rawUrl.startsWith(supabaseUrl)) {
    const table = path.match(/\/rest\/v1\/([^/]+)/)?.[1];
    const endpointType = path.includes('/auth/')
      ? 'auth'
      : path.includes('/storage/')
        ? 'storage'
        : path.includes('/rest/v1/')
          ? 'database'
          : path.includes('/realtime/')
            ? 'realtime'
            : 'supabase';

    return {
      service: 'supabase',
      endpoint_type: endpointType,
      table,
      path,
    };
  }

  if (path.startsWith('/api/')) {
    return {
      service: 'backend',
      path,
    };
  }

  if (rawUrl.includes('huggingface.co')) {
    return {
      service: 'ai_provider',
      provider: 'huggingface',
      path,
    };
  }

  return {
    service: 'external',
    path,
  };
}

function getFetchUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function getFetchMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input !== 'string' && !(input instanceof URL) && input.method) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

function track(event: string, properties?: MonitoringProperties) {
  if (!posthogKey) return;
  posthog.capture(event, {
    environment,
    ...properties,
  });
}

function instrumentFetch() {
  if (!isBrowser() || fetchInstrumented) return;
  fetchInstrumented = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const startedAt = performance.now();
    const url = getFetchUrl(input);
    const method = getFetchMethod(input, init);
    const requestContext = classifyRequest(url);

    try {
      const response = await originalFetch(input, init);
      const durationMs = Math.round(performance.now() - startedAt);
      const eventName = requestContext.service === 'supabase'
        ? 'supabase_request_completed'
        : 'api_request_completed';

      track(eventName, {
        ...requestContext,
        method,
        status: response.status,
        ok: response.ok,
        duration_ms: durationMs,
      });

      if (!response.ok) {
        const errorContext = {
          ...requestContext,
          method,
          status: response.status,
          duration_ms: durationMs,
        };
        const failureEventName = requestContext.service === 'supabase'
          ? 'supabase_request_failed'
          : 'api_request_failed';

        track(failureEventName, errorContext);
        Sentry.captureMessage('API request failed', {
          level: 'warning',
          extra: errorContext,
        });
      }

      return response;
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt);
      const eventName = requestContext.service === 'supabase'
        ? 'supabase_request_failed'
        : 'api_request_failed';
      const errorContext = {
        ...requestContext,
        method,
        duration_ms: durationMs,
        message: error instanceof Error ? error.message : String(error),
      };

      track(eventName, errorContext);
      Sentry.captureException(error, { extra: errorContext });
      throw error;
    }
  };
}

function instrumentPagePerformance() {
  if (!isBrowser() || performanceInstrumented) return;
  performanceInstrumented = true;

  const trackNavigation = () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!navigation) return;

    track('page_load_measured', {
      path: window.location.pathname,
      ttfb_ms: Math.round(navigation.responseStart),
      dom_content_loaded_ms: Math.round(navigation.domContentLoadedEventEnd),
      load_complete_ms: Math.round(navigation.loadEventEnd),
    });
  };

  if (document.readyState === 'complete') {
    trackNavigation();
  } else {
    window.addEventListener('load', trackNavigation, { once: true });
  }

  if (typeof PerformanceObserver === 'undefined') return;

  try {
    const paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        track('page_paint_measured', {
          path: window.location.pathname,
          name: entry.name,
          start_time_ms: Math.round(entry.startTime),
        });
      }
    });

    paintObserver.observe({ type: 'paint', buffered: true });
  } catch {
    // Older browsers may not support buffered paint observers.
  }
}

function instrumentGlobalErrors() {
  if (!isBrowser() || errorsInstrumented) return;
  errorsInstrumented = true;

  window.addEventListener('error', (event) => {
    track('frontend_error', {
      type: 'window_error',
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    track('frontend_error', {
      type: 'unhandled_rejection',
      message: event.reason instanceof Error ? event.reason.message : String(event.reason),
    });
    Sentry.captureException(event.reason);
  });
}

export const monitoring = {
  init() {
    if (initialized) return;
    initialized = true;

    if (sentryDsn) {
      Sentry.init({
        dsn: sentryDsn,
        environment,
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration(),
        ],
        tracesSampleRate: environment === 'production' ? 0.2 : 1.0,
        replaysSessionSampleRate: environment === 'production' ? 0.02 : 0.1,
        replaysOnErrorSampleRate: 1.0,
      });
    }

    if (posthogKey) {
      posthog.init(posthogKey, {
        api_host: posthogHost,
        capture_pageview: false,
        autocapture: false,
      });
    }

    instrumentFetch();
    instrumentPagePerformance();
    instrumentGlobalErrors();
  },

  track,

  identify(userId: string, properties?: MonitoringProperties) {
    Sentry.setUser({ id: userId });
    if (posthogKey) {
      posthog.identify(userId, properties);
    }
    track('user_identified', properties);
  },

  reset() {
    Sentry.setUser(null);
    if (posthogKey) {
      posthog.reset();
    }
  },

  captureException(error: unknown, context?: MonitoringProperties) {
    Sentry.captureException(error, { extra: context });
    track('frontend_error', {
      message: error instanceof Error ? error.message : String(error),
      ...context,
    });
  },
};

monitoring.init();

export { Sentry };
