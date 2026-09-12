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
  const { data, error } = await supabase
    .from("weekend_settings")
    .select("access_code")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const expectedCode =
    typeof data?.access_code === "string" ? data.access_code.trim() : "";

  if (!expectedCode) {
    throw new Error("We couldn’t check the weekend code. Please try again.");
  }

  return expectedCode.toLowerCase() === code.trim().toLowerCase();
}
