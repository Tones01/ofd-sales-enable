// =============================================================================
// Edge Function: import-deals
// =============================================================================
// Accepts a CSV file (multipart/form-data field "file", or raw text body)
// and bulk-inserts deal rows. Admin only.
//
// Expected CSV columns (order flexible, header row required):
//   lp_name, product_name, sku, credit_description, qty_total
//
// Optional columns:
//   status  (defaults to "active")
//
// Returns JSON: { inserted: number, skipped: number, errors: [...] }
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REQUIRED_COLS = ["lp_name", "product_name", "sku", "credit_description", "qty_total"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // ------------------------------------------------------------------
    // Auth — must be an admin
    // ------------------------------------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") throw new Error("Only admins can import deals");

    // ------------------------------------------------------------------
    // Read CSV body — supports raw text or multipart form
    // ------------------------------------------------------------------
    let csvText: string;
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!file || typeof file === "string") throw new Error('Form field "file" missing or not a file');
      csvText = await (file as File).text();
    } else {
      csvText = await req.text();
    }

    if (!csvText.trim()) throw new Error("Empty CSV body");

    // ------------------------------------------------------------------
    // Parse
    // ------------------------------------------------------------------
    const lines = csvText.trim().split(/\r?\n/);
    const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

    const missing = REQUIRED_COLS.filter((c) => !headers.includes(c));
    if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}`);

    const deals: Record<string, unknown>[] = [];
    const errors: { row: number; error: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => (row[h] = values[idx]?.trim() ?? ""));

      // Validate required text fields
      const emptyField = REQUIRED_COLS.filter((c) => c !== "qty_total").find((c) => !row[c]);
      if (emptyField) {
        errors.push({ row: i + 1, error: `"${emptyField}" is empty` });
        continue;
      }

      const qty = parseInt(row["qty_total"], 10);
      if (isNaN(qty) || qty <= 0) {
        errors.push({ row: i + 1, error: `Invalid qty_total: "${row["qty_total"]}"` });
        continue;
      }

      const status = row["status"] ?? "active";
      if (!["active", "closed"].includes(status)) {
        errors.push({ row: i + 1, error: `Invalid status: "${status}" (must be active or closed)` });
        continue;
      }

      deals.push({
        lp_name: row["lp_name"],
        product_name: row["product_name"],
        sku: row["sku"],
        credit_description: row["credit_description"],
        qty_total: qty,
        status,
      });
    }

    // ------------------------------------------------------------------
    // Insert (batched in chunks of 100 to avoid payload limits)
    // ------------------------------------------------------------------
    let inserted = 0;
    const CHUNK = 100;
    for (let i = 0; i < deals.length; i += CHUNK) {
      const chunk = deals.slice(i, i + CHUNK);
      const { data, error } = await supabase.from("deals").insert(chunk).select("id");
      if (error) throw new Error(`DB insert error: ${error.message}`);
      inserted += data?.length ?? 0;
    }

    return json({ inserted, skipped: errors.length, errors });
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** Handles quoted fields and commas inside quotes. */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Handle escaped quotes ("")
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
