import { listen } from "@tauri-apps/api/event";
import { useSetAtom } from "jotai";
import { useCallback, useEffect } from "react";
import { domainsAtom, fetchDomains } from "@/entities/domain";
import { apiLoggingLinksAtom, fetchApiLoggingLinks } from "@/entities/domain-api-logging";
import { fetchInspectorEnabled, inspectorEnabledAtom } from "@/entities/inspector";
import { fetchMockingEnabled, mockingEnabledAtom } from "@/entities/mocking";
import { savedPipelinesAtom } from "@/entities/pipeline";
import { fetchProxyStatus, proxyStatusAtom } from "@/entities/proxy";
import {
  migrateSandboxLibrariesFromLocalStorage,
  savedCryptoPresetsAtom,
  savedJsonSchemasAtom,
} from "@/entities/sandbox";
import { supabase } from "@/shared/api/supabase";
import { HUB_DATA_CHANGED } from "@/shared/lib/tauri/hubEvents";
import { appStatusLoadedAtom, appStatusLoadingAtom } from "./status/store";
import { type DBProfile, supabaseProfileAtom, supabaseSessionAtom } from "./user/store";

interface GithubIdentityInfo {
  githubId: string | null;
  githubLogin: string | null;
}

/**
 * Extracts a stable GitHub id/login from a Supabase session user so `profiles` can be
 * matched by the GitHub Sponsors webhook. Prefers `user_metadata`, falls back to scanning
 * `identities` for the `github` provider.
 */
function extractGithubIdentity(user: {
  user_metadata?: Record<string, unknown> | null;
  identities?: Array<{ provider?: string; id?: string }> | null;
}): GithubIdentityInfo {
  const meta = user.user_metadata ?? {};
  const githubLogin = (meta.user_name as string | undefined) || (meta.preferred_username as string | undefined) || null;

  let githubId: string | null = meta.provider_id ? String(meta.provider_id) : null;
  if (!githubId) {
    const githubIdentity = user.identities?.find((identity) => identity.provider === "github");
    if (githubIdentity?.id) {
      githubId = String(githubIdentity.id);
    }
  }

  return { githubId, githubLogin };
}

export function useAppBootstrap() {
  const setDomains = useSetAtom(domainsAtom);
  const setApiLoggingLinks = useSetAtom(apiLoggingLinksAtom);
  const setProxyStatus = useSetAtom(proxyStatusAtom);
  const setMockingEnabled = useSetAtom(mockingEnabledAtom);
  const setInspectorEnabled = useSetAtom(inspectorEnabledAtom);
  const setSavedPipelines = useSetAtom(savedPipelinesAtom);
  const setSavedJsonSchemas = useSetAtom(savedJsonSchemasAtom);
  const setSavedCryptoPresets = useSetAtom(savedCryptoPresetsAtom);
  const setLoading = useSetAtom(appStatusLoadingAtom);
  const setLoaded = useSetAtom(appStatusLoadedAtom);
  const setSession = useSetAtom(supabaseSessionAtom);
  const setSupaProfile = useSetAtom(supabaseProfileAtom);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [domains, links, proxy, mocking, inspector, sandboxLibs] = await Promise.all([
        fetchDomains(),
        fetchApiLoggingLinks(),
        fetchProxyStatus(),
        fetchMockingEnabled(),
        fetchInspectorEnabled(),
        migrateSandboxLibrariesFromLocalStorage(),
      ]);
      setDomains(domains);
      setApiLoggingLinks(links);
      setProxyStatus(proxy);
      setMockingEnabled(mocking);
      setInspectorEnabled(inspector);
      setSavedPipelines(
        sandboxLibs.pipelines.map((p) => ({
          ...p,
          createdAt: p.createdAt ?? 0,
          updatedAt: p.updatedAt ?? 0,
        })),
      );
      setSavedJsonSchemas(
        sandboxLibs.schemas.map((s) => ({
          ...s,
          createdAt: s.createdAt ?? 0,
          updatedAt: s.updatedAt ?? 0,
        })),
      );
      setSavedCryptoPresets(
        sandboxLibs.presets.map((p) => ({
          ...p,
          action: p.action as import("@/entities/sandbox").CryptoAction,
          createdAt: p.createdAt ?? 0,
          updatedAt: p.updatedAt ?? 0,
        })),
      );
      setLoaded(true);
    } catch (e) {
      console.error("useAppBootstrap:", e);
    } finally {
      setLoading(false);
    }
  }, [
    setDomains,
    setApiLoggingLinks,
    setProxyStatus,
    setMockingEnabled,
    setInspectorEnabled,
    setSavedPipelines,
    setSavedJsonSchemas,
    setSavedCryptoPresets,
    setLoading,
    setLoaded,
  ]);

  useEffect(() => {
    void refresh();

    const unlistenProxy = listen<{ running: boolean; local_routing_enabled: boolean }>(
      "proxy-status-changed",
      (event) => {
        if (event.payload) {
          setProxyStatus((prev) => ({
            running: event.payload.running,
            local_routing_enabled: event.payload.local_routing_enabled,
            port: prev?.port ?? null,
            reverse_http_port: prev?.reverse_http_port ?? null,
            reverse_https_port: prev?.reverse_https_port ?? null,
          }));
        }
      },
    );

    const unlistenMocking = listen<{ enabled: boolean }>("mocking-status-changed", (event) => {
      if (event.payload) {
        setMockingEnabled(event.payload.enabled);
      }
    });

    const unlistenHub = listen(HUB_DATA_CHANGED, () => {
      void refresh();
    });

    const unlistenDeepLink = listen<string>("deep-link-received", async (event) => {
      const urlStr = event.payload;
      if (urlStr && urlStr.startsWith("horizon-gateway://")) {
        let paramsString = "";
        if (urlStr.includes("#")) {
          paramsString = urlStr.split("#")[1];
        } else if (urlStr.includes("?")) {
          paramsString = urlStr.split("?")[1];
        }
        if (paramsString) {
          const params = new URLSearchParams(paramsString);
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) {
              console.error("Failed to set session from deep link:", error.message);
            } else {
              console.log("Supabase session established successfully from deep link!");
            }
          }
        }
      }
    });

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      console.log("Supabase AuthStateChange triggered. Session User:", session?.user?.id);
      if (session?.user) {
        const metaName =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          session.user.user_metadata?.user_name ||
          null;
        const metaAvatar = session.user.user_metadata?.avatar_url || null;
        const { githubId, githubLogin } = extractGithubIdentity(session.user);
        console.log("GitHub Auth User Metadata:", { metaName, metaAvatar, githubId, githubLogin });

        const { data, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();

        let currentProfile: DBProfile | null = null;

        if (!error && data) {
          currentProfile = data as DBProfile;
          console.log("Existing Profile loaded from database:", currentProfile);
          if (
            !currentProfile.display_name ||
            !currentProfile.avatar_url ||
            (!currentProfile.github_id && githubId) ||
            (!currentProfile.github_login && githubLogin)
          ) {
            const updatedFields: Partial<DBProfile> = {};
            if (!currentProfile.display_name && metaName) {
              updatedFields.display_name = metaName;
            }
            if (!currentProfile.avatar_url && metaAvatar) {
              updatedFields.avatar_url = metaAvatar;
            }
            if (!currentProfile.github_id && githubId) {
              updatedFields.github_id = githubId;
            }
            if (!currentProfile.github_login && githubLogin) {
              updatedFields.github_login = githubLogin;
            }

            if (Object.keys(updatedFields).length > 0) {
              console.log("Attempting to sync missing fields in database profile:", updatedFields);
              const { data: updatedData, error: updateError } = await supabase
                .from("profiles")
                .update(updatedFields)
                .eq("id", session.user.id)
                .select()
                .single();
              if (updateError) {
                console.error(
                  "Database profile update FAILED (check RLS policies?):",
                  updateError.message,
                  updateError.details,
                );
              } else if (updatedData) {
                console.log("Database profile successfully updated from GitHub Metadata!", updatedData);
                currentProfile = updatedData as DBProfile;
              }
            }
          }
          setSupaProfile(currentProfile);
        } else if (error && (error as any).code === "PGRST116") {
          console.log("No profile row found. Creating a new profile for user:", session.user.id);
          const newProfile = {
            id: session.user.id,
            email: session.user.email || "",
            display_name: metaName,
            avatar_url: metaAvatar,
            is_sponsor: false,
            github_id: githubId,
            github_login: githubLogin,
          };
          const { data: createdData, error: createError } = await supabase
            .from("profiles")
            .upsert(newProfile)
            .select()
            .single();
          if (createError) {
            console.error("Failed to create new profile (check insert RLS?):", createError.message);
          } else if (createdData) {
            console.log("Successfully created database profile:", createdData);
            currentProfile = createdData as DBProfile;
            setSupaProfile(currentProfile);
          }
        } else if (error) {
          console.error("Failed to fetch profiles table:", error.message);
        }
      } else {
        setSupaProfile(null);
      }
    });

    const interval = setInterval(() => {
      void refresh();
    }, 60_000);

    return () => {
      clearInterval(interval);
      authSubscription.unsubscribe();
      void unlistenProxy.then((fn) => fn());
      void unlistenMocking.then((fn) => fn());
      void unlistenHub.then((fn) => fn());
      void unlistenDeepLink.then((fn) => fn());
    };
  }, [refresh, setProxyStatus, setMockingEnabled, setSession, setSupaProfile]);

  return { refresh };
}
