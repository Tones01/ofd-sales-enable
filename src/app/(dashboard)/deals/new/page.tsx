"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { ArrowLeft, Upload, FileText } from "lucide-react"

const input = "w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"

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
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""))
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values: string[] = []
    let cur = "", inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { values.push(cur.trim()); cur = "" }
      else cur += ch
    }
    values.push(cur.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i]?.replace(/^"|"$/g, "") ?? "" })
    return row
  })
}

export default function NewDealPage() {
  const [tab, setTab] = useState<"manual" | "csv">("manual")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Manual form
  const [form, setForm] = useState({
    lp_name: "", product_name: "", sku: "", credit_description: "",
    qty_total: "", category: "", list_price: "", deal_expiry: "", notes: "",
  })
  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  // CSV
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
      const rows = parseCSV(text)
      setCsvPreview(rows.slice(0, 5))
    }
    reader.readAsText(file)
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.from("deals").insert({
      lp_name: form.lp_name,
      product_name: form.product_name,
      sku: form.sku,
      credit_description: form.credit_description,
      qty_total: parseInt(form.qty_total, 10),
      category: form.category || null,
      list_price: form.list_price ? parseFloat(form.list_price) : null,
      deal_expiry: form.deal_expiry || null,
      notes: form.notes || null,
      status: "active",
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

    rows.forEach((row, i) => {
      const rowNum = i + 2
      if (!row["lp_name"]) { errs.push({ row: rowNum, error: "lp_name is required" }); return }
      if (!row["product_name"]) { errs.push({ row: rowNum, error: "product_name is required" }); return }
      if (!row["sku"]) { errs.push({ row: rowNum, error: "sku is required" }); return }
      if (!row["credit_description"]) { errs.push({ row: rowNum, error: "credit_description is required" }); return }
      const qty = parseInt(row["qty_total"], 10)
      if (isNaN(qty) || qty <= 0) { errs.push({ row: rowNum, error: `Invalid qty_total: "${row["qty_total"]}"` }); return }
      deals.push({
        lp_name: row["lp_name"],
        product_name: row["product_name"],
        sku: row["sku"],
        credit_description: row["credit_description"],
        qty_total: qty,
        status: row["status"] === "closed" ? "closed" : "active",
      })
    })

    if (errs.length > 0) { setCsvErrors(errs); setLoading(false); return }

    const supabase = createClient()
    const CHUNK = 50
    let inserted = 0
    for (let i = 0; i < deals.length; i += CHUNK) {
      const { error } = await supabase.from("deals").insert(deals.slice(i, i + CHUNK))
      if (error) { setError(error.message); setLoading(false); return }
      inserted += Math.min(CHUNK, deals.length - i)
    }

    setSuccess(`${inserted} deal${inserted !== 1 ? "s" : ""} imported successfully.`)
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

      {/* Tabs */}
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
            <Field label="LP name" required>
              <input className={input} value={form.lp_name} onChange={e => set("lp_name", e.target.value)} placeholder="e.g. Auxly Cannabis" required />
            </Field>
            <Field label="Category">
              <select className={input} value={form.category} onChange={e => set("category", e.target.value)}>
                <option value="">Select…</option>
                <option>Flower</option>
                <option>Pre-roll</option>
                <option>Vape</option>
                <option>Edible</option>
                <option>Concentrate</option>
                <option>Capsule</option>
                <option>Tincture</option>
                <option>Topical</option>
                <option>Accessory</option>
              </select>
            </Field>
          </div>

          <Field label="Product name" required>
            <input className={input} value={form.product_name} onChange={e => set("product_name", e.target.value)} placeholder="e.g. Kolab Project 28g Indica" required />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU" required>
              <input className={input} value={form.sku} onChange={e => set("sku", e.target.value)} placeholder="e.g. AUX-KLP-28-IND" required />
            </Field>
            <Field label="Total units" required>
              <input className={input} type="number" min="1" value={form.qty_total} onChange={e => set("qty_total", e.target.value)} placeholder="500" required />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="List price ($)" hint="Optional — for reference">
              <input className={input} type="number" step="0.01" min="0" value={form.list_price} onChange={e => set("list_price", e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Deal expiry" hint="Optional">
              <input className={input} type="date" value={form.deal_expiry} onChange={e => set("deal_expiry", e.target.value)} />
            </Field>
          </div>

          <Field label="Credit / markdown description" required>
            <textarea className={`${input} resize-none`} rows={3} value={form.credit_description} onChange={e => set("credit_description", e.target.value)} placeholder="e.g. $2.00/unit markdown on 90-day aged inventory" required />
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
          {/* Template download hint */}
          <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 text-sm text-zinc-500">
            <p className="font-medium text-zinc-700 mb-1">Required CSV columns:</p>
            <code className="text-xs bg-white border border-zinc-100 rounded px-2 py-1 block mt-1">
              lp_name, product_name, sku, credit_description, qty_total
            </code>
            <p className="mt-2 text-xs">Optional: <code>status</code> (active / closed)</p>
          </div>

          {/* File upload */}
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
              placeholder={"lp_name,product_name,sku,credit_description,qty_total\nAuxly Cannabis,Kolab 28g Indica,AUX-KLP-28-IND,$2/unit markdown,500"}
            />
          </Field>

          {/* Preview */}
          {csvPreview.length > 0 && (
            <div>
              <p className="text-xs text-zinc-400 mb-2">{parseCSV(csvText).length} rows detected — showing first {csvPreview.length}</p>
              <div className="overflow-x-auto border border-zinc-100 rounded-xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50">
                      {Object.keys(csvPreview[0]).map(h => (
                        <th key={h} className="text-left text-zinc-500 font-medium px-3 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {csvPreview.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-2 text-zinc-600 max-w-[160px] truncate">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CSV errors */}
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
