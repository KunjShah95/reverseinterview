import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * After an OAuth sign-in (client-side), call this server function to enforce
 * a single-account-per-email policy. If a different existing user already
 * exists with the same email, this function will remove the newly-created
 * duplicate account and return an error so the client can notify the user.
 */
export const postOAuthSignIn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string().min(1),
      email: z.string().email(),
    }),
  )
  .handler(async ({ data }) => {
    const { userId, email } = data;

    // List users via the admin API and look for same-email accounts.
    const res = await supabaseAdmin.auth.admin.listUsers();
    if (res.error) {
      throw new Error(`Failed to list users: ${res.error.message}`);
    }

    // normalize returned array shape defensively
    type MinimalUser = { id?: string; email?: string };
    const allUsers: MinimalUser[] = (res.data && (res.data.users ?? res.data)) || [];
    const matches = allUsers.filter(
      (u) => typeof u.email === "string" && u.email!.toLowerCase() === email.toLowerCase(),
    );

    // If another account exists with the same email but different id, do NOT auto-delete.
    // Instead return the existing user id and the newly-created duplicate id so the UI
    // can guide the user to link providers safely.
    const other = matches.find((u) => u.id !== userId);
    if (other) {
      return {
        ok: false,
        reason: "duplicate_exists",
        message: "An account with this email already exists.",
        existingUserId: other.id,
        duplicateUserId: userId,
      } as const;
    }

    return { ok: true };
  });

/** Link an OAuth-created (duplicate) user to the currently authenticated existing account.
 * This requires the user to be signed-in to their original account (server function will be called with that session).
 * Steps:
 *  - update the existing user's user_metadata to record the linked provider
 *  - delete the duplicate OAuth-created user
 */
export const linkProviderToExisting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      duplicateUserId: z.string().min(1),
      provider: z.string().min(1),
      providerUserId: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    // context.userId is set by requireSupabaseAuth middleware
    const ctx = context as { userId?: string };
    const currentUserId = ctx.userId;
    if (!currentUserId) throw new Error("Not authenticated");
    const { duplicateUserId, provider, providerUserId } = data;

    // Read existing user to preserve metadata
    const getRes = await supabaseAdmin.auth.admin.getUserById(currentUserId);
    if (getRes.error) throw new Error(`Failed to fetch current user: ${getRes.error.message}`);
    const existing = getRes.data.user;

    const existingMeta = (existing?.user_metadata as Record<string, unknown> | undefined) ?? {};
    const existingLinked = Array.isArray(existingMeta["linked_providers"])
      ? (existingMeta["linked_providers"] as Array<Record<string, unknown>>)
      : [];
    const linked = [...existingLinked, { provider, providerUserId }];

    // Update existing user's metadata to include linked provider
    const upd = await supabaseAdmin.auth.admin.updateUserById(currentUserId, {
      user_metadata: { ...existingMeta, linked_providers: linked },
    });
    if (upd.error) throw new Error(`Failed to update user metadata: ${upd.error.message}`);

    // Delete the duplicate user account now that we've linked
    const del = await supabaseAdmin.auth.admin.deleteUser(duplicateUserId);
    if (del.error) throw new Error(`Failed to delete duplicate user: ${del.error.message}`);

    return { ok: true };
  });
