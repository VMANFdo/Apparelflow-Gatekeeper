'use client'

import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import {
  computeExpectedFabric,
  computeExpectedPieces,
  createOrderSchema,
} from '@/domain/orders'
import type { RecipeListItem } from '@/server/services/orders'

type FieldKey = 'recipe_id' | 'target_qty' | 'fabric_roll_id' | 'actual_fabric_yds'
type FieldErrors = Partial<Record<FieldKey, string>>

const BLOCKED_INT_KEYS = new Set(['e', 'E', '+', '-', '.'])
const BLOCKED_DECIMAL_KEYS = new Set(['e', 'E', '+', '-'])

function blockKeys(keys: Set<string>) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (keys.has(event.key)) event.preventDefault()
  }
}

function emptyForm() {
  return { recipeId: '', targetQty: '', fabricRollId: '', fabricYds: '' }
}

export function CreateOrderDialog({ recipes }: { recipes: RecipeListItem[] }) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  function payload() {
    return {
      recipe_id: form.recipeId,
      target_qty: form.targetQty === '' ? Number.NaN : Number(form.targetQty),
      fabric_roll_id: form.fabricRollId,
      actual_fabric_yds: form.fabricYds === '' ? Number.NaN : Number(form.fabricYds),
    }
  }

  function collectErrors(): FieldErrors {
    const errors: FieldErrors = {}
    if (form.recipeId === '') errors.recipe_id = 'Choose a recipe'
    if (form.targetQty === '') {
      errors.target_qty = 'Enter the target quantity'
    } else if (Number.isNaN(Number(form.targetQty))) {
      errors.target_qty = 'Target quantity must be a whole number'
    }
    if (form.fabricRollId === '') errors.fabric_roll_id = 'Enter the fabric roll ID'
    if (form.fabricYds === '') {
      errors.actual_fabric_yds = 'Enter the fabric used in yards'
    } else if (Number.isNaN(Number(form.fabricYds))) {
      errors.actual_fabric_yds = 'Fabric used must be a number'
    }
    if (Object.keys(errors).length > 0) return errors

    const parsed = createOrderSchema.safeParse(payload())
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as FieldKey
        if (!errors[key]) errors[key] = issue.message
      }
    }
    return errors
  }

  const errors = collectErrors()

  function errorFor(field: FieldKey): string | null {
    if (!attempted && !touched[field]) return null
    return errors[field] ?? null
  }

  const selectedRecipe = recipes.find((recipe) => recipe.id === form.recipeId) ?? null
  const previewQty = /^\d+$/.test(form.targetQty) ? Number(form.targetQty) : 0
  const previewPieces = selectedRecipe
    ? computeExpectedPieces(
        selectedRecipe.components.map((component) => ({
          id: component.id,
          piecesPerGarment: component.piecesPerGarment,
        })),
        previewQty
      )
    : []
  const expectedFabric =
    selectedRecipe && previewQty > 0
      ? computeExpectedFabric(selectedRecipe.stdFabricYards, previewQty)
      : 0

  function setField(field: keyof ReturnType<typeof emptyForm>, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function markTouched(field: FieldKey) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  function reset() {
    setForm(emptyForm())
    setTouched({})
    setAttempted(false)
    setServerError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)
    setServerError(null)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      })
      const body = await res.json().catch(() => null)

      if (!res.ok) {
        const message = body?.error?.message ?? 'Could not create the order'
        setServerError(message)
        toast(message, 'error')
        return
      }

      toast(`Order ${body.order.orderNo} created`, 'success')
      setOpen(false)
      reset()
      router.refresh()
    } catch {
      const message = 'Could not reach the server. Check your connection and try again.'
      setServerError(message)
      toast(message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const formIncomplete = Object.keys(errors).length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create order
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>Create cutting order</DialogTitle>
        <DialogDescription>
          Pick a recipe and the target quantity. Expected pieces and fabric are calculated for you.
        </DialogDescription>

        <form onSubmit={handleSubmit} noValidate className="mt-5">
          {serverError && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
            >
              {serverError}
            </p>
          )}

          <div>
            <label htmlFor="co-recipe" className="block text-sm font-medium text-slate-900">
              Recipe
            </label>
            <select
              id="co-recipe"
              value={form.recipeId}
              onChange={(e) => setField('recipeId', e.target.value)}
              onBlur={() => markTouched('recipe_id')}
              aria-invalid={errorFor('recipe_id') ? true : undefined}
              aria-describedby={errorFor('recipe_id') ? 'co-recipe-error' : undefined}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select a recipe…</option>
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.recipeCode} — {recipe.name}
                </option>
              ))}
            </select>
            {errorFor('recipe_id') && (
              <p id="co-recipe-error" role="alert" className="mt-1 text-sm text-red-700">
                {errorFor('recipe_id')}
              </p>
            )}
          </div>

          <div className="mt-4">
            <label htmlFor="co-qty" className="block text-sm font-medium text-slate-900">
              Target quantity (garments)
            </label>
            <input
              id="co-qty"
              inputMode="numeric"
              autoComplete="off"
              value={form.targetQty}
              onChange={(e) => setField('targetQty', e.target.value)}
              onKeyDown={blockKeys(BLOCKED_INT_KEYS)}
              onBlur={() => markTouched('target_qty')}
              aria-invalid={errorFor('target_qty') ? true : undefined}
              aria-describedby={errorFor('target_qty') ? 'co-qty-error' : undefined}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. 50"
            />
            {errorFor('target_qty') && (
              <p id="co-qty-error" role="alert" className="mt-1 text-sm text-red-700">
                {errorFor('target_qty')}
              </p>
            )}
          </div>

          <div className="mt-4">
            <label htmlFor="co-roll" className="block text-sm font-medium text-slate-900">
              Fabric roll ID
            </label>
            <input
              id="co-roll"
              type="text"
              autoComplete="off"
              maxLength={40}
              value={form.fabricRollId}
              onChange={(e) => setField('fabricRollId', e.target.value)}
              onBlur={() => markTouched('fabric_roll_id')}
              aria-invalid={errorFor('fabric_roll_id') ? true : undefined}
              aria-describedby={errorFor('fabric_roll_id') ? 'co-roll-error' : undefined}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. ROLL-2026-A1"
            />
            {errorFor('fabric_roll_id') && (
              <p id="co-roll-error" role="alert" className="mt-1 text-sm text-red-700">
                {errorFor('fabric_roll_id')}
              </p>
            )}
          </div>

          <div className="mt-4">
            <label htmlFor="co-yds" className="block text-sm font-medium text-slate-900">
              Fabric used (yards)
            </label>
            <input
              id="co-yds"
              inputMode="decimal"
              autoComplete="off"
              value={form.fabricYds}
              onChange={(e) => setField('fabricYds', e.target.value)}
              onKeyDown={blockKeys(BLOCKED_DECIMAL_KEYS)}
              onBlur={() => markTouched('actual_fabric_yds')}
              aria-invalid={errorFor('actual_fabric_yds') ? true : undefined}
              aria-describedby={errorFor('actual_fabric_yds') ? 'co-yds-error' : undefined}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. 92.5"
            />
            {errorFor('actual_fabric_yds') && (
              <p id="co-yds-error" role="alert" className="mt-1 text-sm text-red-700">
                {errorFor('actual_fabric_yds')}
              </p>
            )}
          </div>

          {selectedRecipe && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Live preview</h3>
              <table className="mt-2 w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-slate-500">
                    <th className="pb-1 font-medium">Component</th>
                    <th className="pb-1 font-medium">Per garment</th>
                    <th className="pb-1 text-right font-medium">Expected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedRecipe.components.map((component) => (
                    <tr key={component.id}>
                      <td className="py-1.5 text-slate-900">{component.componentName}</td>
                      <td className="py-1.5 text-slate-600">{component.piecesPerGarment}</td>
                      <td className="py-1.5 text-right font-medium text-slate-900">
                        {previewQty > 0
                          ? previewPieces.find((piece) => piece.componentId === component.id)
                              ?.expectedQty ?? 0
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-slate-300 pt-3 text-sm">
                <span className="text-slate-600">
                  Expected fabric:{' '}
                  <span className="font-medium text-slate-900">
                    {previewQty > 0 ? `${expectedFabric.toFixed(2)} yds` : '—'}
                  </span>
                </span>
                <span className="text-slate-600">
                  Entered fabric:{' '}
                  <span className="font-medium text-slate-900">
                    {form.fabricYds !== '' && !Number.isNaN(Number(form.fabricYds))
                      ? `${Number(form.fabricYds).toFixed(2)} yds`
                      : '—'}
                  </span>
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <p className="text-xs text-slate-500 sm:order-1 sm:w-full sm:text-left">
              {formIncomplete
                ? 'Fill in all fields with valid values to create the order.'
                : 'Expected quantities are calculated on the server.'}
            </p>
            <button
              type="submit"
              disabled={formIncomplete || submitting}
              title={
                formIncomplete
                  ? 'Fix the highlighted fields to enable this button'
                  : undefined
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Create order
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
