import { z } from 'zod'

export type ComponentVerdict = 'GREEN' | 'YELLOW' | 'RED' | 'UNCOUNTED'

export interface VerifiableItem {
  componentId?: string
  componentName?: string
  expectedQty: number
  actualQty: number | null
}

export interface BlockingItem {
  componentId: string | null
  componentName: string | null
  verdict: 'RED' | 'UNCOUNTED'
}

export function evaluateComponent(expectedQty: number, actualQty: number | null): ComponentVerdict {
  if (actualQty === null) return 'UNCOUNTED'
  if (actualQty === expectedQty) return 'GREEN'
  return actualQty > expectedQty ? 'YELLOW' : 'RED'
}

export function canApprove(items: VerifiableItem[]): boolean {
  if (items.length === 0) return false
  return items.every((item) => {
    const verdict = evaluateComponent(item.expectedQty, item.actualQty)
    return verdict === 'GREEN' || verdict === 'YELLOW'
  })
}

export function listBlockingItems(items: VerifiableItem[]): BlockingItem[] {
  return items
    .map((item) => ({
      componentId: item.componentId ?? null,
      componentName: item.componentName ?? null,
      verdict: evaluateComponent(item.expectedQty, item.actualQty),
    }))
    .filter((entry): entry is BlockingItem => entry.verdict === 'RED' || entry.verdict === 'UNCOUNTED')
}

export function toDbStatus(verdict: ComponentVerdict): 'GREEN' | 'YELLOW' | 'RED' | null {
  return verdict === 'UNCOUNTED' ? null : verdict
}

export const VERDICT_LABELS: Record<ComponentVerdict, string> = {
  GREEN: 'Match',
  YELLOW: 'Surplus',
  RED: 'Shortage',
  UNCOUNTED: 'Not counted',
}

export const VERDICT_BADGE_CLASSES: Record<ComponentVerdict, string> = {
  GREEN: 'border-emerald-300 bg-emerald-100 text-emerald-900',
  YELLOW: 'border-amber-300 bg-amber-100 text-amber-900',
  RED: 'border-red-300 bg-red-100 text-red-900',
  UNCOUNTED: 'border-slate-300 bg-slate-100 text-slate-700',
}

export interface VarianceComponent {
  componentName: string | null
  expectedQty: number
  actualQty: number | null
  delta: number | null
  status: 'GREEN' | 'YELLOW' | 'RED' | null
}

export interface VarianceSnapshot {
  wastagePct: number
  components: VarianceComponent[]
}

export function buildVarianceSnapshot(
  items: VerifiableItem[],
  wastagePct: number
): VarianceSnapshot {
  return {
    wastagePct,
    components: items.map((item) => ({
      componentName: item.componentName ?? null,
      expectedQty: item.expectedQty,
      actualQty: item.actualQty,
      delta: item.actualQty === null ? null : item.actualQty - item.expectedQty,
      status: toDbStatus(evaluateComponent(item.expectedQty, item.actualQty)),
    })),
  }
}

// ─── Input schemas ────────────────────────────────────────────────────────────

export const countEntrySchema = z.object({
  component_id: z.string().uuid('component_id must be a valid UUID'),
  actual_qty: z
    .number({ message: 'actual_qty must be a number' })
    .int('actual_qty must be an integer')
    .min(0, 'actual_qty must be at least 0')
    .max(1000000, 'actual_qty must be at most 1000000')
    .nullable(),
})

function countsSchema(min: number) {
  return z
    .array(countEntrySchema)
    .min(min, 'counts must contain at least one component')
    .superRefine((value, ctx) => {
      const seen = new Set<string>()
      value.forEach((entry, index) => {
        if (seen.has(entry.component_id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, 'component_id'],
            message: 'component_id appears more than once',
          })
        }
        seen.add(entry.component_id)
      })
    })
}

export const saveCountsSchema = z.object({
  counts: countsSchema(1),
})

export type SaveCountsInput = z.infer<typeof saveCountsSchema>
export type CountEntry = z.infer<typeof countEntrySchema>

export const approveOrderSchema = z.object({
  approval_note: z
    .string({ message: 'approval_note must be a string' })
    .trim()
    .max(500, 'approval_note must be at most 500 characters')
    .optional(),
  }).strict()

export type ApproveOrderInput = z.infer<typeof approveOrderSchema>

export const rejectOrderSchema = z.object({
  note: z
    .string({ message: 'note must be a string' })
    .trim()
    .min(5, 'note must be at least 5 characters')
    .max(500, 'note must be at most 500 characters'),
  }).strict()

export type RejectOrderInput = z.infer<typeof rejectOrderSchema>
