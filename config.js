/* =====================================================================
   Techtonics Club – Supabase configuration
   ---------------------------------------------------------------------
   1. Open your Supabase project → Project Settings → API.
   2. Copy the "Project URL" into SUPABASE_URL below.
   3. Copy the "anon public" key into SUPABASE_ANON_KEY below.

   The anon key is SAFE to expose in the browser ONLY because the
   row-level security policies in README.md allow the public to INSERT
   and nothing else. NEVER put the "service_role" key in this file.
   ===================================================================== */

window.TECHTONICS_CONFIG = {
  // ⬇️ Replace with your Project URL, e.g. "https://abcdefghijkl.supabase.co"
  SUPABASE_URL: "https://wnzqawhelehnsppviabs.supabase.co",

  // ⬇️ Replace with your anon public key (a long string starting with "eyJ...")
  SUPABASE_ANON_KEY: "sb_publishable_en_bUmmdf4eTFpCc_GLkhQ_rewO9jbw",

  // Name of the Storage bucket that holds member photos (see README.md).
  PHOTO_BUCKET: "photos",

  // Name of the database table that holds submissions (see README.md).
  TABLE: "submissions"
};
