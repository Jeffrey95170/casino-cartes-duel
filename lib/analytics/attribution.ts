import type { AttributionProperties } from "@/lib/analytics/events";

const FIRST_TOUCH_KEY = "casino-duel:analytics:first-touch:v1";
const CURRENT_TOUCH_KEY = "casino-duel:analytics:current-touch:v1";
const MAX_VALUE_LENGTH = 160;

export type AttributionTouch = {
  source: string;
  medium: string;
  campaign?: string;
  content?: string;
  term?: string;
  landingPage: string;
  referrer?: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function clean(value: string | null): string | undefined {
  const normalized = value?.trim().slice(0, MAX_VALUE_LENGTH);
  return normalized || undefined;
}

function externalReferrerOrigin(referrer: string, origin: string): string | undefined {
  if (!referrer) return undefined;
  try {
    const url = new URL(referrer);
    return url.origin === origin ? undefined : url.origin;
  } catch {
    return undefined;
  }
}

export function createAttributionTouch(input: {
  search: string;
  pathname: string;
  origin: string;
  referrer: string;
}): AttributionTouch {
  const params = new URLSearchParams(input.search);
  const referrer = externalReferrerOrigin(input.referrer, input.origin);
  const explicitSource = clean(params.get("utm_source"));
  const explicitMedium = clean(params.get("utm_medium"));

  return {
    source: explicitSource ?? (referrer ? new URL(referrer).hostname : "direct"),
    medium: explicitMedium ?? (referrer ? "referral" : "none"),
    campaign: clean(params.get("utm_campaign")),
    content: clean(params.get("utm_content")),
    term: clean(params.get("utm_term")),
    landingPage: input.pathname || "/",
    referrer,
  };
}

function readTouch(storage: StorageLike, key: string): AttributionTouch | null {
  try {
    const value = JSON.parse(storage.getItem(key) ?? "null") as AttributionTouch | null;
    return value?.source && value.medium && value.landingPage ? value : null;
  } catch {
    return null;
  }
}

function writeTouch(storage: StorageLike, key: string, touch: AttributionTouch): void {
  try {
    storage.setItem(key, JSON.stringify(touch));
  } catch {
    // Attribution is best-effort when storage is unavailable.
  }
}

function hasCampaign(search: string): boolean {
  const params = new URLSearchParams(search);
  return ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
    .some((key) => Boolean(clean(params.get(key))));
}

export function resolveAttribution(input: {
  touch: AttributionTouch;
  storedFirst: AttributionTouch | null;
  storedCurrent: AttributionTouch | null;
  campaignPresent: boolean;
}): { first: AttributionTouch; current: AttributionTouch } {
  return {
    first: input.storedFirst ?? input.touch,
    current: input.campaignPresent || !input.storedCurrent ? input.touch : input.storedCurrent,
  };
}

export function getAttributionProperties(): AttributionProperties | Record<string, never> {
  if (typeof window === "undefined") return {};

  const touch = createAttributionTouch({
    search: window.location.search,
    pathname: window.location.pathname,
    origin: window.location.origin,
    referrer: document.referrer,
  });
  const attribution = resolveAttribution({
    touch,
    storedFirst: readTouch(window.localStorage, FIRST_TOUCH_KEY),
    storedCurrent: readTouch(window.sessionStorage, CURRENT_TOUCH_KEY),
    campaignPresent: hasCampaign(window.location.search),
  });

  writeTouch(window.localStorage, FIRST_TOUCH_KEY, attribution.first);
  writeTouch(window.sessionStorage, CURRENT_TOUCH_KEY, attribution.current);

  return {
    first_touch_source: attribution.first.source,
    first_touch_medium: attribution.first.medium,
    ...(attribution.first.campaign ? { first_touch_campaign: attribution.first.campaign } : {}),
    current_touch_source: attribution.current.source,
    current_touch_medium: attribution.current.medium,
    ...(attribution.current.campaign ? { current_touch_campaign: attribution.current.campaign } : {}),
    ...(attribution.current.content ? { utm_content: attribution.current.content } : {}),
    ...(attribution.current.term ? { utm_term: attribution.current.term } : {}),
    landing_page: attribution.first.landingPage,
    ...(attribution.first.referrer ? { referrer: attribution.first.referrer } : {}),
  };
}

export function getSanitizedCurrentUrl(): string {
  if (typeof window === "undefined") return "";
  const allowed = new URLSearchParams();
  const current = new URLSearchParams(window.location.search);
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((key) => {
    const value = clean(current.get(key));
    if (value) allowed.set(key, value);
  });
  const query = allowed.toString();
  return `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ""}`;
}
