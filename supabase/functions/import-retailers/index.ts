// =============================================================================
// Edge Function: import-retailers
// =============================================================================
// Accepts a CSV file and bulk-inserts retailer rows. Admin only.
//
// Expected CSV columns (order flexible, header row required):
//   name
//
// Optional columns:
//   license_number, address, city, province, postal_code,
//   contact_name, contact_email, contact_phone, notes, status
//
// Returns JSON: { inserted: number, skipped: number, errors: [...] }
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];

const KNOWN_COLS = [
  "name", "license_number", "address", "city", "province",
  "postal_code", "contact_name", "contact_email", "contact_phone",
  "notes", "status",
];

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

    if (profile?.role !== "admin") throw new Error("Only admins can import retailers");

    // ------------------------------------------------------------------
    // Read CSV body
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

    if (!headers.includes("name")) throw new Error('Missing required column: "name"');

    // Warn about unrecognised columns (don't fail — just ignore them)
    const unknown = headers.filter((h) => !KNOWN_COLS.includes(h));

    const retailers: Record<string, unknown>[] = [];
    const errors: { row: number; error: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => (row[h] = values[idx]?.trim() ?? ""));

      if (!row["name"]) {
        errors.push({ row: i + 1, error: '"name" is empty' });
        continue;
      }

      const province = row["province"]?.toUpperCase() || null;
      if (province && !VALID_PROVINCES.includes(province)) {
        errors.push({ row: i + 1, error: `Invalid province: "${row["province"]}"` });
        continue;
      }

      const status = row["status"] || "active";
      if (!["active", "inactive"].includes(status)) {
        errors.push({ row: i + 1, error: `Invalid status: "${status}" (must be active or inactive)` });
        continue;
      }

      retailers.push({
        name:           row["name"],
        license_number: row["license_number"]  || null,
        address:        row["address"]         || null,
        city:           row["city"]            || null,
        province:       province,
        postal_code:    row["postal_code"]     || null,
        contact_name:   row["contact_name"]    || null,
        contact_email:  row["contact_email"]   || null,
        contact_phone:  row["contact_phone"]   || null,
        notes:          row["notes"]           || null,
        status,
      });
    }

    // ------------------------------------------------------------------
    // Insert (chunked)
    // ------------------------------------------------------------------
    let inserted = 0;
    const CHUNK = 100;
    for (let i = 0; i < retailers.length; i += CHUNK) {
      const chunk = retailers.slice(i, i + CHUNK);
      const { data, error } = await supabase.from("retailers").insert(chunk).select("id");
      if (error) throw new Error(`DB insert error: ${error.message}`);
      inserted += data?.length ?? 0;
    }

    return json({ inserted, skipped: errors.length, errors, warnings: unknown.length ? `Unknown columns ignored: ${unknown.join(", ")}` : undefined });
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
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
