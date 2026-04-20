"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { ArrowLeft, Upload, FileText, Download } from "lucide-react"

const input = "w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"

const CSV_HEADERS = [
  "lp_name", "brand", "product_name", "format", "sku",
  "qty_available", "units_per_case", "regular_price", "sale_price",
  "thc", "minor_cannabinoids", "expiry_date", "credit_description", "notes",
]

const CSV_EXAMPLE_ROW = [
  "Auxly Cannabis", "Kolab Project", "Kolab Project Indica", "28g Flower",
  "AUX-KLP-28-IND", "240", "12", "19.99", "14.99", "22%", "CBD 0.5% | CBG 1%",
  "2026-12-31", "$2/unit markdown", "",
]

function downloadTemplate() {
  const header = CSV_HEADERS.join(",")
  const example = CSV_EXAMPLE_ROW.map(v => v.includes(",") ? `"${v}"` : v).join(",")
  const csv = `${header}\n${example}\n`
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "deals-import-template.csv"
  a.click()
  URL.revokeObjectURL(url)
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-zinc-400 mt-1">{hint}</p>}
    </div>
  )
}

function parseCSV(text: string): Record<string, string>[] {
  // Strip UTF-8 BOM (added by Excel on Windows)
  const cleaned = text.trim().replace(/^\ufeff/, "")
  const lines = cleaned.split(/\r?\n/)
  if (lines.length < 2) return []

  // Auto-detect delimiter: tab (spreadsheet paste) vs comma (CSV file)
  const delim = lines[0].includes("\t") ? "\t" : ","

  const headers = lines[0].split(delim).map(h => h.trim().toLowerCase().replace(/"/g, "").replace(/\s+/g, "_"))

  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values: string[] = []
    if (delim === "\t") {
      values.push(...line.split("\t"))
    } else {
      let cur = "", inQ = false
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ }
        else if (ch === ',' && !inQ) { values.push(cur.trim()); cur = "" }
        else cur += ch
      }
      values.push(cur.trim())
    }
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i]?.trim().replace(/^"|"$/g, "") ?? "" })
    return row
  })
}

export default function NewDealPage() {
  const [tab, setTab] = useState<"manual" | "csv">("manual")
  const [csvMode, setCsvMode] = useState<"insert" | "update">("insert")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [form, setForm] = useState({
    lp_name: "", brand: "", product_name: "", format: "",
    sku: "", qty_available: "", units_per_case: "",
    regular_price: "", sale_price: "",
    thc: "", minor_cannabinoids: "",
    deal_expiry: "", credit_description: "", notes: "",
  })
  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const [csvText, setCsvText] = useState("")
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([])
  const [csvErrors, setCsvErrors] = useState<{ row: number; error: string }[]>([])

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvText(text)
      setCsvPreview(parseCSV(text).slice(0, 5))
    }
    reader.readAsText(file)
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.from("deals").insert({
      lp_name:            form.lp_name,
      brand:              form.brand || null,
      product_name:       form.product_name,
      format:             form.format || null,
      sku:                form.sku,
      qty_total:          parseInt(form.qty_available, 10),
      units_per_case:     form.units_per_case ? parseInt(form.units_per_case, 10) : null,
      list_price:         form.regular_price ? parseFloat(form.regular_price) : null,
      sale_price:         form.sale_price ? parseFloat(form.sale_price) : null,
      thc:                form.thc || null,
      minor_cannabinoids: form.minor_cannabinoids || null,
      deal_expiry:        form.deal_expiry || null,
      credit_description: form.credit_description || null,
      notes:              form.notes || null,
      status:             "active",
    })
    if (error) { setError(error.message); setLoading(false) }
    else { window.location.href = "/deals" }
  }

  async function handleCsvSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!csvText.trim()) { setError("Please upload or paste a CSV first"); return }
    setLoading(true)
    setError(null)
    setCsvErrors([])

    const rows = parseCSV(csvText)
    const deals: any[] = []
    const errs: { row: number; error: string }[] = []

    // Helper: pick first non-empty value from a list of column name synonyms
    function col(row: Record<string, string>, ...keys: string[]): string {
      return keys.map(k => row[k]).find(v => v && v.trim() !== "") ?? ""
    }

    rows.forEach((row, i) => {
      const rowNum = i + 2
      if (!col(row, "lp_name", "licensed_producer")) { errs.push({ row: rowNum, error: "lp_name is required" }); return }
      if (!row["product_name"]) { errs.push({ row: rowNum, error: "product_name is required" }); return }
      if (!row["sku"]) { errs.push({ row: rowNum, error: "sku is required" }); return }

      const rawQty = col(row, "qty_total", "qty_available", "case_qty")
      const qty = parseInt(rawQty, 10)

      // In update mode qty is optional (you might only want to fix prices)
      if (csvMode === "insert" && (isNaN(qty) || qty <= 0)) {
        errs.push({ row: rowNum, error: `Invalid qty_available: "${rawQty}"` }); return
      }

      const rawListPrice  = col(row, "regular_price", "list_price", "price", "retail_price", "msrp")
      const rawSalePrice  = col(row, "sale_price", "promo_price", "discount_price")

      deals.push({
        lp_name:            col(row, "lp_name", "licensed_producer"),
        brand:              row["brand"] || null,
        product_name:       row["product_name"],
        format:             row["format"] || null,
        sku:                row["sku"],
        qty_total:          isNaN(qty) ? undefined : qty,
        units_per_case:     row["units_per_case"] ? parseInt(row["units_per_case"], 10) : null,
        list_price:         rawListPrice  ? parseFloat(rawListPrice)  : null,
        sale_price:         rawSalePrice  ? parseFloat(rawSalePrice)  : null,
        thc:                row["thc"] || null,
        minor_cannabinoids: row["minor_cannabinoids"] || null,
        deal_expiry:        col(row, "expiry_date", "deal_expiry") || null,
        credit_description: row["credit_description"] || null,
        notes:              row["notes"] || null,
        status:             row["status"] === "closed" ? "closed" : "active",
      })
    })

    if (errs.length > 0) { setCsvErrors(errs); setLoading(false); return }

    const supabase = createClient()

    if (csvMode === "update") {
      // Update existing deals by SKU — only set fields that are present in the CSV
      let updated = 0
      let notFound: string[] = []
      for (const deal of deals) {
        const patch: Record<string, any> = {}
        if (deal.list_price  != null) patch.list_price  = deal.list_price
        if (deal.sale_price  != null) patch.sale_price  = deal.sale_price
        if (deal.qty_total   != null) patch.qty_total   = deal.qty_total
        if (deal.units_per_case != null) patch.units_per_case = deal.units_per_case
        if (deal.thc)         patch.thc         = deal.thc
        if (deal.format)      patch.format      = deal.format
        if (deal.brand)       patch.brand       = deal.brand
        if (deal.deal_expiry) patch.deal_expiry = deal.deal_expiry
        if (deal.credit_description) patch.credit_description = deal.credit_description
        if (deal.notes)       patch.notes       = deal.notes
        if (Object.keys(patch).length === 0) continue

        const { data, error } = await supabase
          .from("deals").update(patch).eq("sku", deal.sku).select("id")
        if (error) { setError(error.message); setLoading(false); return }
        if (!data?.length) notFound.push(deal.sku)
        else updated++
      }
      const msg = `${updated} deal${updated !== 1 ? "s" : ""} updated.${notFound.length ? ` SKUs not found: ${notFound.join(", ")}` : ""}`
      setSuccess(msg)
    } else {
      const CHUNK = 50
      let inserted = 0
      for (let i = 0; i < deals.length; i += CHUNK) {
        const { error } = await supabase.from("deals").insert(deals.slice(i, i + CHUNK))
        if (error) { setError(error.message); setLoading(false); return }
        inserted += Math.min(CHUNK, deals.length - i)
      }
      setSuccess(`${inserted} deal${inserted !== 1 ? "s" : ""} imported successfully.`)
    }

    setLoading(false)
    setCsvText("")
    setCsvPreview([])
  }

  return (
    <div className="px-8 py-8 max-w-2xl mx-auto">
      <Link href="/deals" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-900 transition-colors mb-8">
        <ArrowLeft size={14} />
        Back to deals
      </Link>

      <h1 className="font-serif text-2xl text-zinc-900 mb-6">Add deals</h1>

      <div className="flex gap-1 bg-zinc-100 p-1 rounded-lg w-fit mb-8">
        {(["manual", "csv"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t === "manual" ? <><FileText size={14} /> Single deal</> : <><Upload size={14} /> Bulk CSV</>}
          </button>
        ))}
      </div>

      {success && (
        <div className="mb-6 bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm px-4 py-3 rounded-lg flex items-center justify-between">
          {success}
          <Link href="/deals" className="underline underline-offset-2 font-medium">View deals →</Link>
        </div>
      )}

      {tab === "manual" ? (
        <form onSubmit={handleManualSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Licensed producer" required>
              <input className={input} value={form.lp_name} onChange={e => set("lp_name", e.target.value)} placeholder="e.g. Auxly Cannabis" required />
            </Field>
            <Field label="Brand">
              <input className={input} value={form.brand} onChange={e => set("brand", e.target.value)} placeholder="e.g. Kolab Project" />
            </Field>
          </div>

          <Field label="Product name" required>
            <input className={input} value={form.product_name} onChange={e => set("product_name", e.target.value)} placeholder="e.g. Kolab Project Indica" required />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Format">
              <input className={input} value={form.format} onChange={e => set("format", e.target.value)} placeholder="e.g. 28g Flower" />
            </Field>
            <Field label="SKU" required>
              <input className={input} value={form.sku} onChange={e => set("sku", e.target.value)} placeholder="e.g. AUX-KLP-28-IND" required />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Qty available" required hint="Total units in this deal">
              <input className={input} type="number" min="1" value={form.qty_available} onChange={e => set("qty_available", e.target.value)} placeholder="e.g. 240" required />
            </Field>
            <Field label="Units per case" hint="Pack size — how many units in one case">
              <input className={input} type="number" min="1" value={form.units_per_case} onChange={e => set("units_per_case", e.target.value)} placeholder="e.g. 12" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Regular price ($)">
              <input className={input} type="number" step="0.01" min="0" value={form.regular_price} onChange={e => set("regular_price", e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Sale price ($)">
              <input className={input} type="number" step="0.01" min="0" value={form.sale_price} onChange={e => set("sale_price", e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Expiry date">
              <input className={input} type="date" value={form.deal_expiry} onChange={e => set("deal_expiry", e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="THC" hint="e.g. 22% or 18–24%">
              <input className={input} value={form.thc} onChange={e => set("thc", e.target.value)} placeholder="e.g. 22%" />
            </Field>
            <Field label="Minor cannabinoids" hint="e.g. CBD 0.5% | CBG 1%">
              <input className={input} value={form.minor_cannabinoids} onChange={e => set("minor_cannabinoids", e.target.value)} placeholder="e.g. CBD 0.5% | CBG 1%" />
            </Field>
          </div>

          <Field label="Credit / markdown description" hint="Optional">
            <textarea className={`${input} resize-none`} rows={2} value={form.credit_description} onChange={e => set("credit_description", e.target.value)} placeholder="e.g. $2.00/unit markdown on 90-day aged inventory" />
          </Field>

          <Field label="Internal notes">
            <textarea className={`${input} resize-none`} rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any internal context for the team…" />
          </Field>

          {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors">
              {loading ? "Creating…" : "Create deal"}
            </button>
            <Link href="/deals" className="text-sm text-zinc-500 px-5 py-2.5 rounded-lg hover:bg-zinc-100 transition-colors">Cancel</Link>
          </div>
        </form>
      ) : (
        <form onSubmit={handleCsvSubmit} className="space-y-6">

          {/* Mode toggle */}
          <div className="flex gap-1 bg-zinc-100 p-1 rounded-lg w-fit">
            {([["insert", "Import new deals"], ["update", "Update existing by SKU"]] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCsvMode(mode)}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  csvMode === mode ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {csvMode === "update" && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
              <strong>Update mode:</strong> matches rows by SKU and patches only the columns present in your CSV.
              Use this to fix prices, quantities, or any field without creating duplicates.
              Columns not in your CSV are left untouched.
            </div>
          )}

          <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 text-sm text-zinc-500">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-zinc-700 mb-1">Required columns:</p>
                <code className="text-xs bg-white border border-zinc-100 rounded px-2 py-1 block mt-1 break-all">
                  lp_name, product_name, sku, qty_available
                </code>
                <p className="mt-2 text-xs">
                  Optional: <code>brand</code>, <code>format</code>, <code>units_per_case</code>, <code>thc</code>, <code>minor_cannabinoids</code>, <code>expiry_date</code>, <code>credit_description</code>, <code>notes</code>
                </p>
                <p className="mt-1 text-xs">
                  Price columns (any name works): <code>regular_price</code> / <code>list_price</code> / <code>price</code> / <code>msrp</code> &nbsp;·&nbsp; <code>sale_price</code> / <code>promo_price</code>
                </p>
              </div>
              <button
                type="button"
                onClick={downloadTemplate}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium text-zinc-600 bg-white border border-zinc-200 px-3 py-2 rounded-lg hover:bg-zinc-50 transition-colors whitespace-nowrap"
              >
                <Download size={12} />
                Download template
              </button>
            </div>
          </div>

          <Field label="Upload CSV file">
            <label className="flex items-center justify-center gap-3 w-full h-28 border-2 border-dashed border-zinc-200 rounded-xl cursor-pointer hover:border-zinc-400 hover:bg-zinc-50 transition-colors">
              <Upload size={18} className="text-zinc-400" />
              <span className="text-sm text-zinc-400">Click to upload a .csv file</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} />
            </label>
          </Field>

          <div className="text-center text-xs text-zinc-400">— or paste CSV directly —</div>

          <Field label="Paste CSV">
            <textarea
              className={`${input} resize-none font-mono text-xs`}
              rows={6}
              value={csvText}
              onChange={e => { setCsvText(e.target.value); setCsvPreview(parseCSV(e.target.value).slice(0, 5)) }}
              placeholder={"lp_name,brand,product_name,format,sku,qty_available,units_per_case,regular_price,sale_price,thc,minor_cannabinoids,expiry_date\nAuxly Cannabis,Kolab Project,Kolab Indica,28g Flower,AUX-KLP-28-IND,240,12,19.99,14.99,22%,CBD 0.5%,2026-12-31"}
            />
          </Field>

          {csvPreview.length > 0 && (
            <div>
              <p className="text-xs text-zinc-400 mb-2">{parseCSV(csvText).length} rows detected — showing first {csvPreview.length}</p>
              <div className="overflow-x-auto border border-zinc-100 rounded-xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50">
                      {Object.keys(csvPreview[0]).map(h => (
                        <th key={h} className="text-left text-zinc-500 font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {csvPreview.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-2 text-zinc-600 max-w-[140px] truncate">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {csvErrors.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-1">
              <p className="text-xs font-medium text-red-600 mb-2">Fix these errors before importing:</p>
              {csvErrors.map((e, i) => (
                <p key={i} className="text-xs text-red-500">Row {e.row}: {e.error}</p>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading || !csvText.trim()} className="bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors">
              {loading ? "Importing…" : "Import deals"}
            </button>
            <Link href="/deals" className="text-sm text-zinc-500 px-5 py-2.5 rounded-lg hover:bg-zinc-100 transition-colors">Cancel</Link>
          </div>
        </form>
      )}
    </div>
  )
}
