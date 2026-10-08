import type { OrderStatus } from '@/db/schema'
import { ConflictError } from '@/domain/errors'

export const STATE_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_VERIFICATION: ['VERIFIED', 'REJECTED'],
  REJECTED: ['PENDING_VERIFICATION'],
  VERIFIED: [],
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return STATE_TRANSITIONS[from].includes(to)
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictError(`Invalid status transition: "${from}" to "${to}"`)
  }
}
