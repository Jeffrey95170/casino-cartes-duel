import assert from "node:assert/strict";
import test from "node:test";

import { createAttributionTouch, resolveAttribution } from "../lib/analytics/attribution.ts";
import { AnalyticsClient, type AnalyticsAdapter } from "../lib/analytics/client.ts";

function createAdapter() {
  const captures: Array<{ name: string; properties: Record<string, unknown> }> = [];
  const identified: string[] = [];
  let resets = 0;
  const adapter: AnalyticsAdapter = {
    capture: (name, properties) => captures.push({ name, properties }),
    identify: (userId) => identified.push(userId),
    reset: () => { resets += 1; },
  };
  return { adapter, captures, identified, get resets() { return resets; } };
}

test("le wrapper envoie les événements typés avec le contexte de campagne", () => {
  const output = createAdapter();
  const client = new AnalyticsClient({
    enabled: true,
    context: () => ({ first_touch_source: "tiktok" }),
  });
  client.setAdapter(output.adapter);
  client.track("signup_started", { method: "google" });

  assert.deepEqual(output.captures, [{
    name: "signup_started",
    properties: {
      first_touch_source: "tiktok",
      method: "google",
      $geoip_disable: true,
    },
  }]);
});

test("analytics désactivé ne contacte jamais l’adaptateur", () => {
  const output = createAdapter();
  const client = new AnalyticsClient({ enabled: false });
  client.setAdapter(output.adapter);
  client.track("rules_viewed", { entry_point: "setup" });
  client.identifyUser("internal-user-id");
  client.resetUser();

  assert.equal(output.captures.length, 0);
  assert.equal(output.identified.length, 0);
  assert.equal(output.resets, 0);
});

test("identify est dédupliqué et reset sépare correctement les utilisateurs", () => {
  const output = createAdapter();
  const client = new AnalyticsClient({ enabled: true });
  client.setAdapter(output.adapter);
  client.identifyUser("user-1");
  client.identifyUser("user-1");
  client.resetUser();
  client.identifyUser("user-1");

  assert.deepEqual(output.identified, ["user-1", "user-1"]);
  assert.equal(output.resets, 1);
});

test("les appels précoces sont conservés jusqu’à l’initialisation du SDK", () => {
  const output = createAdapter();
  const client = new AnalyticsClient({ enabled: true });
  client.track("tutorial_skipped", { duration_seconds: 3 });
  client.setAdapter(output.adapter);

  assert.equal(output.captures.length, 1);
  assert.equal(output.captures[0].name, "tutorial_skipped");
});

test("l’attribution conserve le first-touch et remplace le current-touch avec une nouvelle campagne", () => {
  const first = createAttributionTouch({
    search: "?utm_source=tiktok&utm_medium=social&utm_campaign=validation_01",
    pathname: "/",
    origin: "https://casino-cartes-duel.vercel.app",
    referrer: "",
  });
  const next = createAttributionTouch({
    search: "?utm_source=instagram&utm_medium=social&utm_campaign=validation_02",
    pathname: "/compte",
    origin: "https://casino-cartes-duel.vercel.app",
    referrer: "https://casino-cartes-duel.vercel.app/",
  });
  const attribution = resolveAttribution({
    touch: next,
    storedFirst: first,
    storedCurrent: first,
    campaignPresent: true,
  });

  assert.equal(attribution.first.source, "tiktok");
  assert.equal(attribution.first.campaign, "validation_01");
  assert.equal(attribution.current.source, "instagram");
  assert.equal(attribution.current.campaign, "validation_02");
});
