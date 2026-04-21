// Shared env defaults for the test suite.
//
// We set these BEFORE any source module is imported so that modules which
// read env at import time (e.g. utils/email.ts, config/supabase.ts) see a
// deterministic baseline and don't accidentally pick up a developer's
// real `.env` values.

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-do-not-use-in-prod";

// Email: force the "no key configured, skip send" branch by default.
// Tests that want to exercise the send path set this explicitly and
// re-import the module.
process.env.MAILEROO_API_KEY = "";

// Supabase: unconfigured by default so settings upload tests hit the 503 path.
process.env.SUPABASE_URL = "";
process.env.SUPABASE_ANON_KEY = "";
process.env.SUPABASE_DISPLAY_PICTURE_BUCKET = "";
process.env.SUPABASE_BANNER_BUCKET = "";
