import { getAttributionProperties, getSanitizedCurrentUrl } from "./analytics/attribution.ts";
import { AnalyticsClient, type AnalyticsAdapter } from "./analytics/client.ts";
import type { AnalyticsEventMap, AnalyticsEventName } from "./analytics/events.ts";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
const requested = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true";
const debug = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true";
const enabled = requested && Boolean(projectToken);

export const analyticsClient = new AnalyticsClient({
  enabled,
  debug,
  context: () => ({ ...getAttributionProperties() }),
});

let initialization: Promise<void> | null = null;
let lastPageViewUrl: string | null = null;

export function initAnalytics(): Promise<void> {
  if (initialization) return initialization;
  if (!enabled || typeof window === "undefined") {
    if (debug && requested && !projectToken) {
      console.debug("[Casino Analytics] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN manquant : aucun événement envoyé.");
    }
    initialization = Promise.resolve();
    return initialization;
  }

  initialization = import("posthog-js").then(({ default: posthog }) => {
    posthog.init(projectToken!, {
      api_host: apiHost,
      defaults: "2026-05-30",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      person_profiles: "identified_only",
      respect_dnt: true,
      secure_cookie: window.location.protocol === "https:",
      debug,
    });

    const adapter: AnalyticsAdapter = {
      capture: (name, properties) => posthog.capture(name, properties),
      identify: (userId) => posthog.identify(userId),
      reset: () => posthog.reset(),
    };
    analyticsClient.setAdapter(adapter);
  }).catch((error: unknown) => {
    if (debug) console.debug("[Casino Analytics] Initialisation PostHog impossible.", error);
  });

  return initialization;
}

export function track<Name extends AnalyticsEventName>(
  name: Name,
  properties: AnalyticsEventMap[Name],
): void {
  analyticsClient.track(name, properties);
}

export function identifyUser(userId: string): void {
  analyticsClient.identifyUser(userId);
}

export function resetUser(): void {
  analyticsClient.resetUser();
}

export function trackPageView(): void {
  const url = getSanitizedCurrentUrl();
  if (!url || url === lastPageViewUrl) return;
  lastPageViewUrl = url;
  analyticsClient.capturePageView(url);
}

export { AnalyticsClient } from "./analytics/client.ts";
export type { AnalyticsAdapter } from "./analytics/client.ts";
export type {
  AnalyticsEventMap,
  AnalyticsEventName,
  AttributionProperties,
  GameResult,
  SignupMethod,
} from "./analytics/events.ts";
