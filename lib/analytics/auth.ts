import { identifyUser, resetUser, track } from "../analytics.ts";
import type { SignupMethod } from "./events.ts";

const PENDING_SIGNUP_KEY = "casino-duel:analytics:pending-signup:v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type AuthAnalyticsActions = {
  trackSignupStarted: (method: SignupMethod) => void;
  trackSignupCompleted: (method: SignupMethod) => void;
  trackLoginCompleted: (method: SignupMethod) => void;
  identify: (userId: string) => void;
  reset: () => void;
};

export type AuthAnalyticsUser = {
  id: string;
  isAnonymous: boolean;
  provider: SignupMethod;
};

const defaultActions: AuthAnalyticsActions = {
  trackSignupStarted: (method) => track("signup_started", { method }),
  trackSignupCompleted: (method) => track("signup_completed", { method }),
  trackLoginCompleted: (method) => track("login_completed", { method }),
  identify: identifyUser,
  reset: resetUser,
};

export class AuthAnalyticsCoordinator {
  private readonly actions: AuthAnalyticsActions;
  private readonly storage: StorageLike | null;
  private loginRecordedForUserId: string | null = null;
  private identifiedUserId: string | null = null;

  constructor(
    actions: AuthAnalyticsActions = defaultActions,
    storage: StorageLike | null = typeof window === "undefined" ? null : window.sessionStorage,
  ) {
    this.actions = actions;
    this.storage = storage;
  }

  startSignup(method: SignupMethod): void {
    try {
      this.storage?.setItem(PENDING_SIGNUP_KEY, method);
    } catch {
      // Signup must continue when browser storage is unavailable.
    }
    this.actions.trackSignupStarted(method);
  }

  cancelSignup(): void {
    this.clearPendingSignup();
  }

  handleAuthStateChange(event: string, user: AuthAnalyticsUser | null): void {
    if (event === "SIGNED_OUT") {
      this.loginRecordedForUserId = null;
      this.identifiedUserId = null;
      this.actions.reset();
      return;
    }
    if (!user || user.isAnonymous) return;

    if (this.identifiedUserId !== user.id) {
      this.identifiedUserId = user.id;
      this.actions.identify(user.id);
    }
    const pendingMethod = this.pendingSignupMethod();
    if (pendingMethod) {
      this.clearPendingSignup();
      this.loginRecordedForUserId = user.id;
      this.actions.trackSignupCompleted(pendingMethod);
      return;
    }
    if (event === "SIGNED_IN" && this.loginRecordedForUserId !== user.id) {
      this.loginRecordedForUserId = user.id;
      this.actions.trackLoginCompleted(user.provider);
    }
  }

  private pendingSignupMethod(): SignupMethod | null {
    try {
      const value = this.storage?.getItem(PENDING_SIGNUP_KEY);
      return value === "email" || value === "google" || value === "github" ? value : null;
    } catch {
      return null;
    }
  }

  private clearPendingSignup(): void {
    try {
      this.storage?.removeItem(PENDING_SIGNUP_KEY);
    } catch {
      // Storage is best-effort and must not interrupt auth.
    }
  }
}

export const authAnalytics = new AuthAnalyticsCoordinator();
