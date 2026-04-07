"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { ArrowLeft, Plus, X } from "lucide-react"

const input = "w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"

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

export default function NewSheetPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError("Not authenticated"); setLoading(false); return }

    const { data: sheet, error: err } = await supabase
      .from("sheets")
      .insert({ name, created_by: user.id, status: "draft" })
      .select("id")
      .single()

    if (err || !sheet) {
      setError(err?.message ?? "Failed to create sheet")
      setLoading(false)
    } else {
      window.location.href = `/sheets/${sheet.id}`
    }
  }

  return (
    <div className="px-8 py-8 max-w-xl mx-auto">
      <Link href="/sheets" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-900 transition-colors mb-8">
        <ArrowLeft size={14} />
        Back to sheets
      </Link>

      <h1 className="font-serif text-2xl text-zinc-900 mb-2">New sheet</h1>
      <p className="text-sm text-zinc-400 mb-8">Give the sheet a name, then add deals and retailers from the sheet detail page.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Sheet name" required>
          <input
            className={input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. April Week 1 — Auxly + Organigram"
            required
          />
        </Field>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating…" : "Create sheet"}
          </button>
          <Link href="/sheets" className="text-sm text-zinc-500 px-5 py-2.5 rounded-lg hover:bg-zinc-100 transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
