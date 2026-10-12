import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.1";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !anonKey || !serviceRoleKey) {
    return Response.json({ error: "Server configuration error" }, { status: 500 });
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  const user = userData.user;

  if (userError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Storage objects must be deleted through the API before deleting their owner.
  const { error: photoError } = await admin.storage.from('profile-photos').remove([`${user.id}/avatar.jpg`]);
  if (photoError) {
    return Response.json({ error: "Could not remove profile photo. Please try again." }, { status: 500 });
  }
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return Response.json({ error: "Could not delete account" }, { status: 500 });
  }

  return Response.json({ deleted: true });
});
