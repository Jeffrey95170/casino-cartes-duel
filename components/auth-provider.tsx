"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { trackProductEvent } from "@/lib/analytics";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase/client";
import type { Achievement, MatchSummary, PlayerProfile, PlayerStats } from "@/types/game-api";

type UpgradeInput = { email: string; password: string; username: string };
type OAuthProvider = "google" | "github";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: PlayerProfile | null;
  stats: PlayerStats | null;
  achievements: Achievement[];
  matches: MatchSummary[];
  isAnonymous: boolean;
  loading: boolean;
  configured: boolean;
  error: string | null;
  signInGuest: () => Promise<void>;
  upgradeAccount: (input: UpgradeInput) => Promise<void>;
  linkProvider: (provider: OAuthProvider) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
  isUsernameAvailable: (username: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : "Une erreur Supabase est survenue.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = hasSupabaseConfig();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;
    const [profileResult, statsResult, achievementsResult, matchesResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", authData.user.id).single(),
      supabase.from("player_stats").select("*").eq("user_id", authData.user.id).single(),
      supabase
        .from("player_achievements")
        .select("unlocked_at, achievements(code,name,description,icon)"),
      supabase
        .from("matches")
        .select("id,status,player_score,opponent_score,winner,verified,started_at,finished_at")
        .order("started_at", { ascending: false })
        .limit(20),
    ]);
    const firstError = profileResult.error ?? statsResult.error ?? achievementsResult.error ?? matchesResult.error;
    if (firstError) throw firstError;
    setProfile(profileResult.data as PlayerProfile);
    setStats(statsResult.data as PlayerStats);
    setMatches((matchesResult.data ?? []) as MatchSummary[]);
    setAchievements(
      (achievementsResult.data ?? []).flatMap((row) => {
        const achievement = row.achievements as Achievement | Achievement[] | null;
        const value = Array.isArray(achievement) ? achievement[0] : achievement;
        return value ? [{ ...value, unlocked_at: row.unlocked_at }] : [];
      }),
    );
    setError(null);
  }, []);

  const signInGuest = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const current = await supabase.auth.getSession();
    if (current.data.session) return;
    const { error: authError } = await supabase.auth.signInAnonymously();
    if (authError) throw authError;
    trackProductEvent("anonymous_session_created");
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;

    const initialize = async () => {
      try {
        await signInGuest();
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        await refreshProfile();
      } catch (cause) {
        if (active) setError(readableError(cause));
      } finally {
        if (active) setLoading(false);
      }
    };
    void initialize();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      window.setTimeout(() => void refreshProfile().catch((cause) => setError(readableError(cause))), 0);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [refreshProfile, signInGuest]);

  const updateUsername = useCallback(async (username: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) throw new Error("Session indisponible.");
    const { error: updateError } = await supabase.from("profiles").update({ username }).eq("id", user.id);
    if (updateError) throw updateError;
    await refreshProfile();
  }, [refreshProfile, user]);

  const upgradeAccount = useCallback(async ({ email, password, username }: UpgradeInput) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user?.is_anonymous) throw new Error("Ce compte n’est pas un compte invité.");
    trackProductEvent("account_upgrade_started");
    await updateUsername(username);
    const { data, error: updateError } = await supabase.auth.updateUser({ email, password });
    if (updateError) throw updateError;
    if (data.user.id !== user.id) throw new Error("La conversion a créé un identifiant différent. Opération interrompue.");
    trackProductEvent("account_created");
    await refreshProfile();
  }, [refreshProfile, updateUsername, user]);

  const linkProvider = useCallback(async (provider: OAuthProvider) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user?.is_anonymous) throw new Error("La liaison exige un compte invité actif.");
    trackProductEvent("account_upgrade_started");
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: new URL("/compte", window.location.origin).toString() },
    });
    if (linkError) throw linkError;
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase n’est pas configuré.");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    trackProductEvent("login");
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
    trackProductEvent("logout");
    await signInGuest();
  }, [signInGuest]);

  const isUsernameAvailable = useCallback(async (username: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return false;
    const { data, error: rpcError } = await supabase.rpc("is_username_available", { candidate: username });
    if (rpcError) throw rpcError;
    return Boolean(data);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    profile,
    stats,
    achievements,
    matches,
    isAnonymous: user?.is_anonymous ?? true,
    loading,
    configured,
    error,
    signInGuest,
    upgradeAccount,
    linkProvider,
    signIn,
    signOut,
    updateUsername,
    isUsernameAvailable,
    refreshProfile,
  }), [
    achievements, configured, error, isUsernameAvailable, linkProvider, loading, matches, profile,
    refreshProfile, session, signIn, signInGuest, signOut, stats, updateUsername, upgradeAccount, user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans AuthProvider.");
  return context;
}
