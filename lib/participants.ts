import { supabase } from "@/lib/supabase";

export type Participant = {
  id: string;
  auth_user_id: string;
  name: string;
  role: string;
  created_at: string | null;
};

function isMissingAuthSession(error: { name?: string; message?: string } | null) {
  return (
    error?.name === "AuthSessionMissingError" ||
    error?.message === "Auth session missing!"
  );
}

export async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getSession();

  if (error && !isMissingAuthSession(error)) {
    throw error;
  }

  return data.session?.user.id ?? null;
}

export async function signInAnonymouslyIfNeeded() {
  const existingUserId = await getCurrentUserId();

  if (existingUserId) {
    return existingUserId;
  }

  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    throw error;
  }

  const userId = data.user?.id;

  if (!userId) {
    throw new Error("Anonymous sign-in did not return a user.");
  }

  return userId;
}

export async function getParticipantByAuthUserId(authUserId: string) {
  const { data, error } = await supabase
    .from("participants")
    .select("id, auth_user_id, name, role, created_at")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Participant | null;
}

export async function createGuestParticipant(authUserId: string, name: string) {
  const { data, error } = await supabase
    .from("participants")
    .insert({
      auth_user_id: authUserId,
      name,
      role: "guest",
    })
    .select("id, auth_user_id, name, role, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      const existing = await getParticipantByAuthUserId(authUserId);

      if (existing) {
        return existing;
      }
    }

    throw error;
  }

  return data as Participant;
}

export async function getOrCreateGuestParticipant(
  authUserId: string,
  name: string,
) {
  const existing = await getParticipantByAuthUserId(authUserId);

  if (existing) {
    return existing;
  }

  return createGuestParticipant(authUserId, name);
}
