import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POULTRY HUB — Clerk Webhook Profile Provisioning Endpoint
 *
 * Handles real-time Clerk user lifecycle events:
 * - user.created -> Provisions a public.profiles row with role = 'STAFF' and is_active = true.
 * - user.updated -> Synchronizes full_name and avatar_url without modifying role or active status.
 * - user.deleted -> Soft deactivates profile (is_active = false) to preserve ledgers & audit trails.
 *
 * Idempotence: Handled safely via database lookups and ON CONFLICT (id).
 * Security: Uses SUPABASE_SERVICE_ROLE_KEY exclusively inside this server-side endpoint.
 * RBAC: Never trusts client/user metadata for role assignment; defaults to STAFF.
 */

export async function POST(req: NextRequest) {
  let evt;
  const signingSecret =
    process.env.CLERK_WEBHOOK_SIGNING_SECRET ||
    process.env.CLERK_WEBHOOK_SECRET;

  try {
    evt = await verifyWebhook(req, {
      signingSecret: signingSecret || undefined,
    });
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return new Response(
      "Webhook verification failed. Verify that CLERK_WEBHOOK_SIGNING_SECRET is set correctly.",
      { status: 400 }
    );
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (err) {
    console.error("Supabase service-role client error in webhook:", err);
    return new Response(
      "Database configuration error: SUPABASE_SERVICE_ROLE_KEY is missing or invalid.",
      { status: 500 }
    );
  }

  if (evt.type === "user.created") {
    const { id, first_name, last_name, email_addresses, image_url } = evt.data;
    const primaryEmail = email_addresses?.[0]?.email_address;
    const fullName =
      [first_name, last_name].filter(Boolean).join(" ").trim() ||
      primaryEmail ||
      "Poultry Hub User";

    // Check if profile already exists to prevent accidental demotion if event is replayed
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase.from("profiles").upsert(
      {
        id,
        role: existingProfile?.role || "STAFF", // Preserve existing role if replayed, otherwise default to STAFF
        full_name: fullName,
        avatar_url: image_url || null,
        is_active: existingProfile?.is_active ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("Error creating profile from Clerk webhook:", error);
      return new Response("Database profile provisioning failed", { status: 500 });
    }
  }

  if (evt.type === "user.updated") {
    const { id, first_name, last_name, email_addresses, image_url } = evt.data;
    const primaryEmail = email_addresses?.[0]?.email_address;
    const fullName =
      [first_name, last_name].filter(Boolean).join(" ").trim() || primaryEmail;

    // Check existing profile state
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", id)
      .maybeSingle();

    // If profile does not exist yet (e.g. user was created before webhook was active),
    // safely provision it with default STAFF role
    const { error } = await supabase.from("profiles").upsert(
      {
        id,
        role: existingProfile?.role || "STAFF",
        full_name: fullName || "Poultry Hub User",
        avatar_url: image_url || null,
        is_active: existingProfile?.is_active ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("Error updating profile from Clerk webhook:", error);
      return new Response("Database profile update failed", { status: 500 });
    }
  }

  if (evt.type === "user.deleted") {
    const { id } = evt.data;
    if (id) {
      // Soft deactivate: preserve historical audit & transaction ledgers
      const { error } = await supabase
        .from("profiles")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        console.error("Error deactivating profile from Clerk webhook:", error);
        return new Response("Database profile deactivation failed", { status: 500 });
      }
    }
  }

  return NextResponse.json({ message: "Webhook processed successfully" }, { status: 200 });
}
