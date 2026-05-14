import { supabase } from "./supabaseClient";

// ── AUTH ──────────────────────────────────────────────────────────────────────
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "https://system-matrix-approval.vercel.app",
    },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function getUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function updateUserRole(userId, updates) {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getRequests() {
  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createRequest(payload) {
  const { data, error } = await supabase
    .from("requests")
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRequest(id, updates) {
  const { data, error } = await supabase
    .from("requests")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRequest(id) {
  const { error } = await supabase.from("requests").delete().eq("id", id);
  if (error) throw error;
}

export async function addAudit(requestId, action, performedBy, detail) {
  await supabase.from("audit_log").insert([
    { request_id: requestId, action, performed_by: performedBy, detail },
  ]);
}

export async function getAuditLog() {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function getDashboardStats() {
  const { data: reqs } = await supabase
    .from("requests")
    .select("status, category, vp_required");
  const { data: audit } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(15);

  const rows = reqs || [];
  return {
    total: rows.length,
    pending: rows.filter((r) => r.status?.startsWith("Pending")).length,
    approved: rows.filter((r) => r.status === "Approved").length,
    rejected: rows.filter((r) => r.status === "Rejected").length,
    inDev: rows.filter((r) => r.status === "In Development").length,
    wms: rows.filter((r) => r.category === "WMS").length,
    byCategory: ["Application","WMS","Automation","Dashboard","Report"].map((c) => ({
      category: c,
      count: rows.filter((r) => r.category === c).length,
    })),
    recentAudit: audit || [],
  };
}