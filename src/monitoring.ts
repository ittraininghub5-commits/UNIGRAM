import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "",
  integrations: [],
  tracesSampleRate: 1.0,
});