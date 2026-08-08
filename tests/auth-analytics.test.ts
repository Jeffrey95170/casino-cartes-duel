import assert from "node:assert/strict";
import test from "node:test";

import { AuthAnalyticsCoordinator } from "../lib/analytics/auth.ts";
import type { SignupMethod } from "../lib/analytics/events.ts";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function createCoordinator() {
  const events: Array<{ name: string; method: SignupMethod }> = [];
  const identified: string[] = [];
  let resets = 0;
  const coordinator = new AuthAnalyticsCoordinator({
    trackSignupStarted: (method) => events.push({ name: "signup_started", method }),
    trackSignupCompleted: (method) => events.push({ name: "signup_completed", method }),
    trackLoginCompleted: (method) => events.push({ name: "login_completed", method }),
    identify: (userId) => identified.push(userId),
    reset: () => { resets += 1; },
  }, new MemoryStorage());
  return { coordinator, events, identified, get resets() { return resets; } };
}

test("signup OAuth préserve le parcours anonyme puis identifie le compte", () => {
  const output = createCoordinator();
  output.coordinator.startSignup("google");
  output.coordinator.handleAuthStateChange("SIGNED_IN", {
    id: "internal-user-id",
    isAnonymous: false,
    provider: "google",
  });

  assert.deepEqual(output.identified, ["internal-user-id"]);
  assert.deepEqual(output.events, [
    { name: "signup_started", method: "google" },
    { name: "signup_completed", method: "google" },
  ]);
});

test("login identifie l’utilisateur sans le confondre avec un signup", () => {
  const output = createCoordinator();
  output.coordinator.handleAuthStateChange("SIGNED_IN", {
    id: "returning-user-id",
    isAnonymous: false,
    provider: "email",
  });
  output.coordinator.handleAuthStateChange("SIGNED_IN", {
    id: "returning-user-id",
    isAnonymous: false,
    provider: "email",
  });

  assert.deepEqual(output.identified, ["returning-user-id"]);
  assert.deepEqual(output.events, [{ name: "login_completed", method: "email" }]);
});

test("logout réinitialise l’identité analytics", () => {
  const output = createCoordinator();
  output.coordinator.handleAuthStateChange("SIGNED_OUT", null);
  assert.equal(output.resets, 1);
});
