import { PostHog } from 'posthog-node';

let _posthog = null;

export function getPostHog() {
  if (!_posthog) {
    const key = process.env.POSTHOG_API_KEY;
    if (!key) {
      // Return a no-op client if PostHog not configured
      return {
        capture: () => {},
        shutdown: () => Promise.resolve(),
      };
    }
    _posthog = new PostHog(key, {
      host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
    });
  }
  return _posthog;
}

export function captureEvent(distinctId, event, properties = {}) {
  try {
    getPostHog().capture({
      distinctId,
      event,
      properties: {
        ...properties,
        app: 'ghost-sales-copilot',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.warn('[PostHog] Failed to capture event:', err.message);
  }
}
