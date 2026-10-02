import { supabase } from "@/lib/supabase";

export const WEEKEND_ACCESS_STORAGE_KEY = "brookes_bach_access_granted";

export function hasWeekendAccess() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(WEEKEND_ACCESS_STORAGE_KEY) === "true";
}

export function grantWeekendAccess() {
  window.localStorage.setItem(WEEKEND_ACCESS_STORAGE_KEY, "true");
}

export async function verifyWeekendAccessCode(code: string) {
  const { data, error } = await supabase.rpc("validate_weekend_code", {
    candidate_code: code,
  });

  if (error) {
    throw error;
  }

  if (typeof data !== "boolean") {
    throw new Error("We couldn’t check the weekend code. Please try again.");
  }

  return data;
}
