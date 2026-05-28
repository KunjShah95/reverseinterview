import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import type { AnalysisStatus, PartialAnalysisResult } from "./analysis-types";

async function getAuthUser() {
  const request = getRequest();
  if (!request?.headers) return null;
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getAuthUser();
  if (!user) return { authenticated: false, user: null };
  return {
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User",
      avatar: user.user_metadata?.avatar_url ?? null,
    },
  };
});

export const mergeAnonymousAnalyses = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string() }))
  .handler(async ({ data }) => {
    const user = await getAuthUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabaseAdmin
      .from("analyses")
      .update({ user_id: user.id })
      .eq("session_id", data.sessionId)
      .is("user_id", null);

    if (error) throw new Error(error.message);
    return { merged: true };
  });

export const listUserAnalyses = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getAuthUser();
  if (!user) throw new Error("Not authenticated");

  const { data: rows, error } = await supabaseAdmin
    .from("analyses")
    .select("id, company, created_at, status, result, error")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (rows ?? []).map((r) => ({
    id: r.id as string,
    company: (r.company as string | null) ?? "Unknown",
    createdAt: r.created_at as string,
    status: r.status as AnalysisStatus,
    error: r.error as string | null,
    recommendation:
      (r.result as PartialAnalysisResult | null)?.orchestrator?.recommendation ?? null,
  }));
});

export const getDashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getAuthUser();
  if (!user) throw new Error("Not authenticated");

  const { data: rows, error } = await supabaseAdmin
    .from("analyses")
    .select("status, result")
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  const all = rows ?? [];
  const total = all.length;
  let proceed = 0;
  let caution = 0;
  let avoid = 0;
  let running = 0;

  for (const r of all) {
    const status = r.status as string;
    if (status === "queued" || status === "running") {
      running++;
      continue;
    }
    const rec = (r.result as PartialAnalysisResult | null)?.orchestrator?.recommendation;
    if (rec === "proceed") proceed++;
    else if (rec === "avoid") avoid++;
    else if (rec === "caution") caution++;
  }

  return { total, proceed, caution, avoid, running };
});
