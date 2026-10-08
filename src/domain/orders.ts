import { z } from 'zod'
import type { OrderStatus } from '@/db/schema'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_VERIFICATION: 'Pending verification',
  REJECTED: 'Rejected',
  VERIFIED: 'Verified',
}

export const ORDER_STATUS_BADGE_CLASSES: Record<OrderStatus, string> = {
  PENDING_VERIFICATION: 'border-amber-300 bg-amber-100 text-amber-900',
  REJECTED: 'border-red-300 bg-red-100 text-red-900',
  VERIFIED: 'border-emerald-300 bg-emerald-100 text-emerald-900',
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export interface ComponentInput {
  id: string
  piecesPerGarment: number
}

export interface ExpectedPieces {
  componentId: string
  expectedQty: number
}

export function computeExpectedPieces(
  components: ComponentInput[],
  targetQty: number
): ExpectedPieces[] {
  return components.map((component) => ({
    componentId: component.id,
    expectedQty: component.piecesPerGarment * targetQty,
  }))
}

export function computeExpectedFabric(stdYards: number, targetQty: number): number {
  return round2(stdYards * targetQty)
}

const ROLL_ID_PATTERN = /^[A-Za-z0-9-]+$/

const MAX_DECIMALS_PATTERN = /^\d{1,7}(\.\d{1,2})?$/

export const createOrderSchema = z.object({
  recipe_id: z.string().uuid('recipe_id must be a valid UUID'),
  target_qty: z
    .number({ message: 'target_qty must be a number' })
    .int('target_qty must be an integer')
    .min(1, 'target_qty must be at least 1')
    .max(100000, 'target_qty must be at most 100000'),
  fabric_roll_id: z
    .string()
    .trim()
    .min(3, 'fabric_roll_id must be at least 3 characters')
    .max(40, 'fabric_roll_id must be at most 40 characters')
    .regex(ROLL_ID_PATTERN, 'fabric_roll_id may only contain letters, digits and hyphens'),
  actual_fabric_yds: z
    .number({ message: 'actual_fabric_yds must be a number' })
    .positive('actual_fabric_yds must be greater than 0')
    .max(1000000, 'actual_fabric_yds must be at most 1000000')
    .refine(
      (value) => MAX_DECIMALS_PATTERN.test(String(value)),
      'actual_fabric_yds must have at most 2 decimal places'
    ),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
