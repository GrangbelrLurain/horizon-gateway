import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const safeUrl = isValidUrl(supabaseUrl) ? supabaseUrl : "https://placeholder-project.supabase.co";
const safeKey = supabaseAnonKey || "placeholder-key";

export const supabase = createClient(safeUrl, safeKey);
