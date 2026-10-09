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
      host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
    });
  }
  return _posthog;
}

/** Flush queued events before the process exits. */
export async function shutdownPostHog() {
  if (_posthog) await _posthog.shutdown();
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
