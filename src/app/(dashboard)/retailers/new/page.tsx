"use client"

import { useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { ArrowLeft, Upload, Download, CheckCircle, AlertCircle, X } from "lucide-react"

const input = "w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"
const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"]
const CSV_COLUMNS = ["name","license_number","address","city","province","postal_code","contact_name","contact_email","contact_phone","notes"]

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function downloadTemplate() {
  const header = CSV_COLUMNS.join(",")
  const example = [
    "Green Cannabis Co.","CRSA-1234567","123 Main St","Calgary","AB","T2P 1J9","Jane Smith","jane@store.com","403-555-0100","Key account"
  ].join(",")
  const blob = new Blob([header + "\n" + example + "\n"], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = "retailers-import-template.csv"; a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"))
  return lines.slice(1).filter(l => l.trim()).map(line => {
    // Basic CSV parse — handles quoted fields
    const values: string[] = []
    let cur = "", inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === "," && !inQuote) { values.push(cur.trim()); cur = "" }
      else { cur += ch }
    }
    values.push(cur.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? "" })
    return row
  })
}

export default function NewRetailerPage() {
  const [tab, setTab] = useState<"single" | "bulk">("single")

  // ── Single form ──
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "", license_number: "", address: "", city: "",
    province: "", postal_code: "",
    contact_name: "", contact_email: "", contact_phone: "", notes: "",
  })

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const supabase = createClient()
    const { error } = await supabase.from("retailers").insert({
      name: form.name,
      license_number: form.license_number || null,
      address:        form.address || null,
      city:           form.city || null,
      province:       form.province || null,
      postal_code:    form.postal_code || null,
      contact_name:   form.contact_name || null,
      contact_email:  form.contact_email || null,
      contact_phone:  form.contact_phone || null,
      notes:          form.notes || null,
      status:         "active",
    })
    if (error) { setError(error.message); setLoading(false) }
    else { window.location.href = "/retailers" }
  }

  // ── Bulk CSV ──
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvRows, setCsvRows] = useState<Record<string, string>[] | null>(null)
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ added: number; errors: string[] } | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvRows(null); setCsvErrors([]); setImportResult(null)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      if (!rows.length) { setCsvErrors(["No data rows found. Make sure the file has a header row and at least one data row."]); return }
      // Validate
      const errs: string[] = []
      rows.forEach((row, i) => {
        if (!row.name?.trim()) errs.push(`Row ${i + 2}: "name" is required`)
        if (row.province && !PROVINCES.includes(row.province.toUpperCase())) {
          errs.push(`Row ${i + 2}: "${row.province}" is not a valid province code (use AB, BC, ON…)`)
        }
      })
      setCsvErrors(errs)
      setCsvRows(rows)
    }
    reader.readAsText(file)
  }

  async function runImport() {
    if (!csvRows?.length) return
    setImporting(true)
    const supabase = createClient()
    const rows = csvRows.map(r => ({
      name:           r.name?.trim(),
      license_number: r.license_number?.trim() || null,
      address:        r.address?.trim() || null,
      city:           r.city?.trim() || null,
      province:       r.province?.toUpperCase().trim() || null,
      postal_code:    r.postal_code?.trim() || null,
      contact_name:   r.contact_name?.trim() || null,
      contact_email:  r.contact_email?.trim() || null,
      contact_phone:  r.contact_phone?.trim() || null,
      notes:          r.notes?.trim() || null,
      status:         "active" as const,
    }))

    // Insert in batches of 50
    const errs: string[] = []
    let added = 0
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      const { error, data } = await supabase.from("retailers").insert(batch).select("id")
      if (error) errs.push(`Rows ${i + 1}–${i + batch.length}: ${error.message}`)
      else added += data?.length ?? 0
    }
    setImportResult({ added, errors: errs })
    setImporting(false)
  }

  return (
    <div className="px-8 py-8 max-w-2xl mx-auto">
      <Link href="/retailers" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-900 transition-colors mb-8">
        <ArrowLeft size={14} />
        Back to retailers
      </Link>

      <h1 className="font-serif text-2xl text-zinc-900 mb-6">Add retailers</h1>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-zinc-100 p-1 rounded-lg mb-6 w-fit">
        {(["single", "bulk"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === t ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t === "single" ? "Single retailer" : "Bulk CSV"}
          </button>
        ))}
      </div>

      {/* ── Single form ── */}
      {tab === "single" && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Store name" required>
              <input className={input} value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Green Cannabis Co." required />
            </Field>
            <Field label="Licence number">
              <input className={input} value={form.license_number} onChange={e => set("license_number", e.target.value)} placeholder="e.g. CRSA-1234567" />
            </Field>
          </div>

          <Field label="Address">
            <input className={input} value={form.address} onChange={e => set("address", e.target.value)} placeholder="123 Main St" />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="City">
              <input className={input} value={form.city} onChange={e => set("city", e.target.value)} placeholder="Calgary" />
            </Field>
            <Field label="Province">
              <select className={input} value={form.province} onChange={e => set("province", e.target.value)}>
                <option value="">—</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Postal code">
              <input className={input} value={form.postal_code} onChange={e => set("postal_code", e.target.value)} placeholder="T2P 1J9" />
            </Field>
          </div>

          <div className="border-t border-zinc-100 pt-5">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-4">Contact</p>
            <div className="space-y-4">
              <Field label="Contact name">
                <input className={input} value={form.contact_name} onChange={e => set("contact_name", e.target.value)} placeholder="Jane Smith" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email">
                  <input className={input} type="email" value={form.contact_email} onChange={e => set("contact_email", e.target.value)} placeholder="jane@store.com" />
                </Field>
                <Field label="Phone">
                  <input className={input} type="tel" value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)} placeholder="403-555-0100" />
                </Field>
              </div>
            </div>
          </div>

          <Field label="Internal notes">
            <textarea className={`${input} resize-none`} rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any internal context…" />
          </Field>

          {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors">
              {loading ? "Saving…" : "Add retailer"}
            </button>
            <Link href="/retailers" className="text-sm text-zinc-500 px-5 py-2.5 rounded-lg hover:bg-zinc-100 transition-colors">Cancel</Link>
          </div>
        </form>
      )}

      {/* ── Bulk CSV ── */}
      {tab === "bulk" && (
        <div className="space-y-5">

          {/* Download template */}
          <div className="flex items-center justify-between bg-zinc-50 border border-zinc-100 rounded-xl px-5 py-4">
            <div>
              <p className="text-sm font-medium text-zinc-700">CSV template</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Columns: name · licence · address · city · province · postal · contact name · email · phone · notes
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 bg-white border border-zinc-200 px-3 py-2 rounded-lg hover:bg-zinc-50 transition-colors flex-shrink-0"
            >
              <Download size={12} /> Download template
            </button>
          </div>

          {/* File upload */}
          <div
            className="border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center hover:border-zinc-400 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={20} className="mx-auto text-zinc-300 mb-2" />
            <p className="text-sm text-zinc-500">Click to upload a CSV file</p>
            <p className="text-xs text-zinc-400 mt-1">or drag and drop</p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </div>

          {/* Validation errors */}
          {csvErrors.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-1">
              <p className="text-xs font-medium text-red-600 flex items-center gap-1.5">
                <AlertCircle size={12} /> {csvErrors.length} issue{csvErrors.length !== 1 ? "s" : ""} found
              </p>
              {csvErrors.map((e, i) => (
                <p key={i} className="text-xs text-red-500 pl-4">{e}</p>
              ))}
            </div>
          )}

          {/* Preview table */}
          {csvRows && csvRows.length > 0 && !importResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Preview — {csvRows.length} retailer{csvRows.length !== 1 ? "s" : ""}
                </p>
                <button onClick={() => { setCsvRows(null); setCsvErrors([]); if (fileRef.current) fileRef.current.value = "" }} className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1">
                  <X size={11} /> Clear
                </button>
              </div>

              <div className="bg-white border border-zinc-100 rounded-xl overflow-auto max-h-72">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/60 sticky top-0">
                      <th className="text-left text-zinc-400 font-medium px-4 py-2.5">Store name</th>
                      <th className="text-left text-zinc-400 font-medium px-3 py-2.5">Licence</th>
                      <th className="text-left text-zinc-400 font-medium px-3 py-2.5">City</th>
                      <th className="text-left text-zinc-400 font-medium px-3 py-2.5">Prov.</th>
                      <th className="text-left text-zinc-400 font-medium px-3 py-2.5">Contact</th>
                      <th className="text-left text-zinc-400 font-medium px-3 py-2.5">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {csvRows.map((row, i) => (
                      <tr key={i} className={`hover:bg-zinc-50 ${!row.name?.trim() ? "bg-red-50" : ""}`}>
                        <td className="px-4 py-2 font-medium text-zinc-900">{row.name || <span className="text-red-400">missing</span>}</td>
                        <td className="px-3 py-2 text-zinc-500">{row.license_number || "—"}</td>
                        <td className="px-3 py-2 text-zinc-500">{row.city || "—"}</td>
                        <td className="px-3 py-2 text-zinc-500">{row.province?.toUpperCase() || "—"}</td>
                        <td className="px-3 py-2 text-zinc-500">{row.contact_name || "—"}</td>
                        <td className="px-3 py-2 text-zinc-500">{row.contact_email || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={runImport}
                disabled={importing || csvErrors.some(e => e.includes("required"))}
                className="flex items-center gap-2 bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                <Upload size={14} />
                {importing ? "Importing…" : `Import ${csvRows.length} retailer${csvRows.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div className={`rounded-xl border p-5 space-y-3 ${importResult.errors.length ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100"}`}>
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />
                <p className="text-sm font-medium text-zinc-900">
                  {importResult.added} retailer{importResult.added !== 1 ? "s" : ""} added successfully
                </p>
              </div>
              {importResult.errors.map((e, i) => (
                <p key={i} className="text-xs text-amber-700 pl-6">{e}</p>
              ))}
              <div className="flex gap-3 pt-1">
                <Link href="/retailers" className="text-sm font-medium text-zinc-900 underline underline-offset-2">
                  View all retailers
                </Link>
                <button onClick={() => { setImportResult(null); setCsvRows(null); setCsvErrors([]); if (fileRef.current) fileRef.current.value = "" }} className="text-sm text-zinc-500 hover:text-zinc-700">
                  Import more
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
