"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { CheckCircle } from "lucide-react"

const input = "w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"

export default function ChangePasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (next.length < 8) {
      setError("New password must be at least 8 characters.")
      return
    }
    if (next !== confirm) {
      setError("New passwords don't match.")
      return
    }

    setLoading(true)
    const supabase = createClient()

    // Re-authenticate with current password to verify it
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: current })
    if (authError) {
      setError("Current password is incorrect.")
      setLoading(false)
      return
    }

    // Update to new password
    const { error: updateError } = await supabase.auth.updateUser({ password: next })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setCurrent("")
    setNext("")
    setConfirm("")
    setSuccess(true)
    setLoading(false)
  }

  return (
    <div className="bg-white border border-zinc-100 rounded-2xl p-6">
      <h2 className="text-sm font-medium text-zinc-700 mb-5">Change password</h2>

      {success && (
        <div className="flex items-center gap-2.5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-5">
          <CheckCircle size={15} className="flex-shrink-0" />
          Password updated successfully.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wide font-medium">
            Current password
          </label>
          <input
            type="password"
            value={current}
            onChange={e => { setCurrent(e.target.value); setSuccess(false) }}
            required
            autoComplete="current-password"
            className={input}
            placeholder="••••••••"
          />
        </div>

        <div>
          <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wide font-medium">
            New password
          </label>
          <input
            type="password"
            value={next}
            onChange={e => { setNext(e.target.value); setSuccess(false) }}
            required
            autoComplete="new-password"
            className={input}
            placeholder="••••••••"
          />
        </div>

        <div>
          <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wide font-medium">
            Confirm new password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setSuccess(false) }}
            required
            autoComplete="new-password"
            className={input}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-zinc-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  )
}
