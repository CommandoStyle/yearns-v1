'use client'

// Cast management screen (/profile/cast)
// Lists the user's saved non-self cast members, with add/edit/delete.
// "Edit my profile" entry point (visually distinct) opens the self-description flow.
// Soft cap: 8 non-self members with a friendly message, not a hard block.

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCast } from '@/hooks/useCast'
import { CastMemberForm } from '@/components/cast/CastMemberForm'
import type { CastCharacterRow } from '@/types/cast'

const CAST_SOFT_CAP = 8

export default function CastPage() {
  const { session }                   = useAuth()
  const authToken                     = session?.access_token ?? null
  const { cast, loading, load, save, update, remove } = useCast()

  const router                         = useRouter()
  const [view, setView]               = useState<'list' | 'add' | 'edit'>('list')
  const [editing, setEditing]         = useState<CastCharacterRow | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    if (authToken) load(authToken)
  }, [authToken, load])

  const nonSelf = cast.filter(c => !c.is_self)
  const atCap   = nonSelf.length >= CAST_SOFT_CAP

  async function handleSaveMember(data: Partial<CastCharacterRow>) {
    if (!authToken) return
    if (editing) {
      await update(authToken, editing.id, data)
    } else {
      await save(authToken, { ...data, is_self: false })
    }
    setEditing(null)
    setView('list')
  }

  async function handleDelete(id: string) {
    if (!authToken) return
    await remove(authToken, id)
    setDeleteConfirm(null)
  }

  // ── List view ──────────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="max-w-lg mx-auto px-6 py-12 space-y-10">
        <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-gray-900">Your cast</h1>
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-700 transition-colors text-sm"
          aria-label="Back to settings"
        >
          ✕
        </button>
      </div>

        {/* Non-self cast */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-gray-900/40 text-xs tracking-widest uppercase">Your cast</p>
            {!atCap ? (
              <button
                onClick={() => { setEditing(null); setView('add') }}
                className="text-gray-500 text-xs hover:text-gray-800 transition-colors"
              >
                + Add someone
              </button>
            ) : (
              <span className="text-gray-400 text-xs">cast full</span>
            )}
          </div>

          {loading && <p className="text-gray-400 text-sm">Loading…</p>}

          {!loading && nonSelf.length === 0 && (
            <button
              onClick={() => { setEditing(null); setView('add') }}
              className="w-full border border-dashed border-gray-900/12 px-4 py-4 text-left text-sm text-gray-400/70 hover:border-gray-900/25 hover:text-gray-500 transition-all"
            >
              + Add someone to your cast — they'll be ready to use in any Yearn
            </button>
          )}

          {nonSelf.map(member => (
            <div key={member.id} className="border border-gray-900/8 px-4 py-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-gray-800">
                    {member.name || <span className="text-gray-400 italic">unnamed</span>}
                    {member.gender && member.gender !== 'unspecified' && (
                      <span className="ml-2 text-gray-400 text-xs">({member.gender})</span>
                    )}
                  </p>
                  {member.role && <p className="text-xs text-gray-400">{member.role}</p>}
                  {member.traits && member.traits.length > 0 && (
                    <p className="text-xs text-gray-400/70">{member.traits.join(', ')}</p>
                  )}
                </div>
                <div className="flex gap-3 shrink-0">
                  <button
                    onClick={() => { setEditing(member); setView('edit') }}
                    className="text-gray-400 text-xs hover:text-gray-700 transition-colors"
                  >
                    edit
                  </button>
                  {deleteConfirm === member.id ? (
                    <span className="flex gap-2 text-xs">
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="text-gray-700 hover:text-gray-900"
                      >
                        yes, remove
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(member.id)}
                      className="text-gray-300 text-xs hover:text-gray-500 transition-colors"
                    >
                      remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {atCap && (
            <p className="text-gray-400/70 text-sm">
              Your cast is full — remove someone to add someone new.
            </p>
          )}
        </div>
      </div>
    )
  }



  // ── Add / edit non-self member ─────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto px-6 py-12 space-y-8">
      <button
        onClick={() => { setEditing(null); setView('list') }}
        className="text-gray-400 text-xs hover:text-gray-600 transition-colors"
      >
        ← back
      </button>
      <h2 className="font-serif text-xl text-gray-900">
        {editing ? 'Edit cast member' : 'Add someone to your cast'}
      </h2>
      <CastMemberForm
        initial={editing ?? undefined}
        onSave={handleSaveMember}
        onCancel={() => { setEditing(null); setView('list') }}
      />
    </div>
  )
}
