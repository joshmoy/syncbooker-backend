import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const displayPictureBucket = process.env.SUPABASE_DISPLAY_PICTURE_BUCKET;
const bannerBucket = process.env.SUPABASE_BANNER_BUCKET;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file"
  );
}

// Use service role key for storage operations if available, otherwise use anon key
const storageKey = supabaseServiceKey || supabaseAnonKey;

if (!displayPictureBucket) {
  throw new Error(
    "Missing Supabase display picture bucket name. Please set SUPABASE_DISPLAY_PICTURE_BUCKET in your .env file"
  );
}

if (!bannerBucket) {
  throw new Error(
    "Missing Supabase banner bucket name. Please set SUPABASE_BANNER_BUCKET in your .env file"
  );
}

// Client for general operations (uses anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client for storage operations (uses service role key if available for better permissions)
export const supabaseStorage = createClient(supabaseUrl, storageKey);

export const DISPLAY_PICTURE_BUCKET = displayPictureBucket;
export const BANNER_BUCKET = bannerBucket;
