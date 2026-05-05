"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useParams } from "next/navigation"

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

export default function EditDealPage() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [form, setForm] = useState({
    lp_name: "", brand: "", product_name: "", format: "",
    sku: "", qty_available: "", units_per_case: "",
    regular_price: "", sale_price: "",
    thc: "", minor_cannabinoids: "",
    deal_expiry: "", credit_description: "", notes: "", status: "active",
  })

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("id", id)
        .single()

      if (error || !data) { setNotFound(true); setLoading(false); return }

      setForm({
        lp_name:            data.lp_name ?? "",
        brand:              (data as any).brand ?? "",
        product_name:       data.product_name ?? "",
        format:             (data as any).format ?? "",
        sku:                data.sku ?? "",
        qty_available:      String(data.qty_total ?? ""),
        units_per_case:     (data as any).units_per_case != null ? String((data as any).units_per_case) : "",
        regular_price:      (data as any).list_price != null ? String((data as any).list_price) : "",
        sale_price:         (data as any).sale_price != null ? String((data as any).sale_price) : "",
        thc:                (data as any).thc ?? "",
        minor_cannabinoids: (data as any).minor_cannabinoids ?? "",
        deal_expiry:        (data as any).deal_expiry ?? "",
        credit_description: data.credit_description ?? "",
        notes:              (data as any).notes ?? "",
        status:             data.status ?? "active",
      })
      setLoading(false)
    }
    load()
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const qty = parseInt(form.qty_available, 10)

    // Quantity of 0 means remove the deal. Try a hard delete first; fall
    // back to closing it if FK references prevent deletion.
    if (qty === 0) {
      const { error: deleteError } = await supabase.from("deals").delete().eq("id", id)
      if (!deleteError) { window.location.href = "/deals"; return }

      const { error: closeError } = await supabase
        .from("deals").update({ status: "closed" }).eq("id", id)
      if (closeError) { setError(closeError.message); setSaving(false); return }
      window.location.href = "/deals"
      return
    }

    const { error } = await supabase.from("deals").update({
      lp_name:            form.lp_name,
      brand:              form.brand || null,
      product_name:       form.product_name,
      format:             form.format || null,
      sku:                form.sku,
      qty_total:          qty,
      units_per_case:     form.units_per_case ? parseInt(form.units_per_case, 10) : null,
      list_price:         form.regular_price ? parseFloat(form.regular_price) : null,
      sale_price:         form.sale_price ? parseFloat(form.sale_price) : null,
      thc:                form.thc || null,
      minor_cannabinoids: form.minor_cannabinoids || null,
      deal_expiry:        form.deal_expiry || null,
      credit_description: form.credit_description || null,
      notes:              form.notes || null,
      status:             form.status,
    }).eq("id", id)

    if (error) { setError(error.message); setSaving(false) }
    else { window.location.href = "/deals" }
  }

  if (loading) return (
    <div className="px-8 py-8 max-w-2xl mx-auto">
      <div className="h-6 w-32 bg-zinc-100 rounded animate-pulse mb-8" />
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-zinc-50 rounded-lg animate-pulse" />)}
      </div>
    </div>
  )

  if (notFound) return (
    <div className="px-8 py-8 max-w-2xl mx-auto text-center">
      <p className="text-zinc-400 text-sm">Deal not found.</p>
      <Link href="/deals" className="mt-3 inline-block text-sm text-zinc-900 underline underline-offset-2">Back to deals</Link>
    </div>
  )

  return (
    <div className="px-8 py-8 max-w-2xl mx-auto">
      <Link href="/deals" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-900 transition-colors mb-8">
        <ArrowLeft size={14} />
        Back to deals
      </Link>

      <h1 className="font-serif text-2xl text-zinc-900 mb-6">Edit deal</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Licensed producer" required>
            <input className={input} value={form.lp_name} onChange={e => set("lp_name", e.target.value)} required />
          </Field>
          <Field label="Brand">
            <input className={input} value={form.brand} onChange={e => set("brand", e.target.value)} />
          </Field>
        </div>

        <Field label="Product name" required>
          <input className={input} value={form.product_name} onChange={e => set("product_name", e.target.value)} required />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Format">
            <input className={input} value={form.format} onChange={e => set("format", e.target.value)} placeholder="e.g. 28g Flower" />
          </Field>
          <Field label="SKU" required>
            <input className={input} value={form.sku} onChange={e => set("sku", e.target.value)} required />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Qty available" required hint="Total units in this deal — set to 0 to remove this deal">
            <input className={input} type="number" min="0" value={form.qty_available} onChange={e => set("qty_available", e.target.value)} required />
          </Field>
          <Field label="Units per case" hint="Pack size — how many units in one case">
            <input className={input} type="number" min="1" value={form.units_per_case} onChange={e => set("units_per_case", e.target.value)} placeholder="e.g. 12" />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Regular price ($)">
            <input className={input} type="number" step="0.01" min="0" value={form.regular_price} onChange={e => set("regular_price", e.target.value)} />
          </Field>
          <Field label="Sale price ($)">
            <input className={input} type="number" step="0.01" min="0" value={form.sale_price} onChange={e => set("sale_price", e.target.value)} />
          </Field>
          <Field label="Expiry date">
            <input className={input} type="date" value={form.deal_expiry} onChange={e => set("deal_expiry", e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Field label="Status">
            <select className={input} value={form.status} onChange={e => set("status", e.target.value)}>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="THC" hint="e.g. 22% or 18–24%">
            <input className={input} value={form.thc} onChange={e => set("thc", e.target.value)} placeholder="e.g. 22%" />
          </Field>
          <Field label="Minor cannabinoids" hint="e.g. CBD 0.5% | CBG 1%">
            <input className={input} value={form.minor_cannabinoids} onChange={e => set("minor_cannabinoids", e.target.value)} />
          </Field>
        </div>

        <Field label="Credit / markdown description" hint="Optional">
          <textarea className={`${input} resize-none`} rows={2} value={form.credit_description} onChange={e => set("credit_description", e.target.value)} />
        </Field>

        <Field label="Internal notes">
          <textarea className={`${input} resize-none`} rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} />
        </Field>

        {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors">
            {saving ? "Saving…" : "Save changes"}
          </button>
          <Link href="/deals" className="text-sm text-zinc-500 px-5 py-2.5 rounded-lg hover:bg-zinc-100 transition-colors">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
