import type { AnalyticsEventMap, AnalyticsEventName } from "@/lib/analytics/events";

type AnalyticsProperties = Record<string, string | number | boolean | undefined>;

export type AnalyticsAdapter = {
  capture: (name: string, properties: AnalyticsProperties) => void;
  identify: (userId: string) => void;
  reset: () => void;
};

type QueuedAction =
  | { kind: "capture"; name: string; properties: AnalyticsProperties }
  | { kind: "identify"; userId: string }
  | { kind: "reset" };

type AnalyticsClientOptions = {
  enabled: boolean;
  debug?: boolean;
  context?: () => AnalyticsProperties;
};

export class AnalyticsClient {
  private adapter: AnalyticsAdapter | null = null;
  private readonly queue: QueuedAction[] = [];
  private identifiedUserId: string | null = null;
  private readonly options: AnalyticsClientOptions;

  constructor(options: AnalyticsClientOptions) {
    this.options = options;
  }

  setAdapter(adapter: AnalyticsAdapter): void {
    if (!this.options.enabled) return;
    this.adapter = adapter;
    this.queue.splice(0).forEach((action) => this.dispatch(action));
  }

  track<Name extends AnalyticsEventName>(name: Name, properties: AnalyticsEventMap[Name]): void {
    this.capture(name, properties);
  }

  capturePageView(url: string): void {
    this.capture("$pageview", { $current_url: url });
  }

  identifyUser(userId: string): void {
    if (!userId || userId === this.identifiedUserId) return;
    this.identifiedUserId = userId;
    this.enqueueOrDispatch({ kind: "identify", userId });
  }

  resetUser(): void {
    this.identifiedUserId = null;
    this.enqueueOrDispatch({ kind: "reset" });
  }

  private capture(name: string, properties: AnalyticsProperties): void {
    const enriched = {
      ...this.options.context?.(),
      ...properties,
      $geoip_disable: true,
    };
    this.debug(name, enriched);
    this.enqueueOrDispatch({ kind: "capture", name, properties: enriched });
  }

  private enqueueOrDispatch(action: QueuedAction): void {
    if (!this.options.enabled) return;
    if (this.adapter) this.dispatch(action);
    else this.queue.push(action);
  }

  private dispatch(action: QueuedAction): void {
    if (!this.adapter) return;
    try {
      if (action.kind === "capture") this.adapter.capture(action.name, action.properties);
      else if (action.kind === "identify") this.adapter.identify(action.userId);
      else this.adapter.reset();
    } catch {
      // Analytics must never interrupt authentication or a game.
    }
  }

  private debug(name: string, properties: AnalyticsProperties): void {
    if (!this.options.debug) return;
    console.debug("[Casino Analytics]", {
      event: name,
      timestamp: new Date().toISOString(),
      properties,
      sent: this.options.enabled,
    });
  }
}
