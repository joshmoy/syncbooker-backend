import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const displayPictureBucket = process.env.SUPABASE_DISPLAY_PICTURE_BUCKET;
const bannerBucket = process.env.SUPABASE_BANNER_BUCKET;

/**
 * Whether all Supabase storage env vars required for avatar/banner uploads
 * are present. We deliberately DO NOT throw at import time — uploads are
 * a feature, not a prerequisite for the server to boot.
 */
const configured = Boolean(
  supabaseUrl && supabaseAnonKey && displayPictureBucket && bannerBucket
);

let cachedStorageClient: SupabaseClient | null = null;
if (configured) {
  // Prefer the service role key for storage writes when available; fall back
  // to the anon key, which only works if bucket policies allow it.
  const storageKey = supabaseServiceKey || supabaseAnonKey!;
  cachedStorageClient = createClient(supabaseUrl!, storageKey);
}

export const isSupabaseStorageConfigured = (): boolean => configured;

/**
 * Returns the Supabase storage client and configured bucket names.
 * Throws if Supabase is not configured; callers should gate this behind
 * `isSupabaseStorageConfigured()` and return a clean 503 to the client.
 */
export const getSupabaseStorage = (): {
  client: SupabaseClient;
  displayPictureBucket: string;
  bannerBucket: string;
} => {
  if (!configured || !cachedStorageClient) {
    throw new Error(
      "Supabase storage is not configured. Set SUPABASE_URL, SUPABASE_ANON_KEY, " +
        "SUPABASE_DISPLAY_PICTURE_BUCKET, and SUPABASE_BANNER_BUCKET in .env to enable uploads."
    );
  }
  return {
    client: cachedStorageClient,
    displayPictureBucket: displayPictureBucket!,
    bannerBucket: bannerBucket!,
  };
};
