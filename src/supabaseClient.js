import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ybgzknbgyttrpdhgaylw.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliZ3prbmJneXR0cnBkaGdheWx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NDAwMzUsImV4cCI6MjA5NDMxNjAzNX0.ugfCD-Wr50vpiJWUA7_x9nkuLuI-1OdvwGk4YqBpcig";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
