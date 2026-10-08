import { round2 } from '@/domain/orders'

export function computeWastagePct(expected: number, actual: number): number {
  if (!Number.isFinite(expected) || !Number.isFinite(actual) || expected === 0) return 0
  return round2(((actual - expected) / expected) * 100)
}
