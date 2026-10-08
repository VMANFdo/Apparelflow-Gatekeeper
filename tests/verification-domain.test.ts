import { describe, expect, it } from 'vitest'
import type { OrderStatus } from '@/db/schema'
import { ConflictError } from '@/domain/errors'
import {
  canApprove,
  evaluateComponent,
  listBlockingItems,
  toDbStatus,
} from '@/domain/verification'
import { assertTransition, canTransition, STATE_TRANSITIONS } from '@/domain/stateMachine'
import { computeWastagePct } from '@/domain/wastage'

function catchError(fn: () => unknown): unknown {
  try {
    fn()
    return null
  } catch (error) {
    return error
  }
}

describe('evaluateComponent', () => {
  it('returns UNCOUNTED when the verifier has not entered a count', () => {
    expect(evaluateComponent(50, null)).toBe('UNCOUNTED')
  })

  it('returns GREEN when the count matches exactly', () => {
    expect(evaluateComponent(100, 100)).toBe('GREEN')
  })

  it('returns YELLOW when there is an excess', () => {
    expect(evaluateComponent(100, 104)).toBe('YELLOW')
  })

  it('returns RED when there is a shortage', () => {
    expect(evaluateComponent(100, 96)).toBe('RED')
  })

  it('returns GREEN when expected and actual are both zero', () => {
    expect(evaluateComponent(0, 0)).toBe('GREEN')
  })

  it('returns YELLOW when nothing was expected but pieces were found', () => {
    expect(evaluateComponent(0, 5)).toBe('YELLOW')
  })

  it('returns RED when pieces were expected but none were found', () => {
    expect(evaluateComponent(5, 0)).toBe('RED')
  })
})

describe('canApprove', () => {
  it('blocks approval when there are no items at all', () => {
    expect(canApprove([])).toBe(false)
  })

  it('allows approval when every component is GREEN', () => {
    const items = [
      { expectedQty: 50, actualQty: 50 },
      { expectedQty: 100, actualQty: 100 },
    ]
    expect(canApprove(items)).toBe(true)
  })

  it('allows approval when some components are YELLOW', () => {
    const items = [
      { expectedQty: 50, actualQty: 50 },
      { expectedQty: 100, actualQty: 104 },
    ]
    expect(canApprove(items)).toBe(true)
  })

  it('blocks approval when any component is RED', () => {
    const items = [
      { expectedQty: 50, actualQty: 50 },
      { expectedQty: 100, actualQty: 96 },
    ]
    expect(canApprove(items)).toBe(false)
  })

  it('blocks approval when any component is uncounted', () => {
    const items = [
      { expectedQty: 50, actualQty: 50 },
      { expectedQty: 100, actualQty: null },
    ]
    expect(canApprove(items)).toBe(false)
  })

  it('blocks approval when the only component is uncounted', () => {
    expect(canApprove([{ expectedQty: 50, actualQty: null }])).toBe(false)
  })
})

describe('listBlockingItems', () => {
  it('returns only the RED and uncounted components with their verdicts', () => {
    const items = [
      { componentId: 'a', componentName: 'Front Body Panel', expectedQty: 50, actualQty: 50 },
      { componentId: 'b', componentName: 'Back Body Panel', expectedQty: 50, actualQty: 47 },
      { componentId: 'c', componentName: 'Sleeve Cuffs', expectedQty: 100, actualQty: null },
    ]
    expect(listBlockingItems(items)).toEqual([
      { componentId: 'b', componentName: 'Back Body Panel', verdict: 'RED' },
      { componentId: 'c', componentName: 'Sleeve Cuffs', verdict: 'UNCOUNTED' },
    ])
  })

  it('returns an empty list when nothing blocks approval', () => {
    const items = [
      { componentId: 'a', componentName: 'Front Body Panel', expectedQty: 50, actualQty: 52 },
      { componentId: 'b', componentName: 'Back Body Panel', expectedQty: 50, actualQty: 50 },
    ]
    expect(listBlockingItems(items)).toEqual([])
  })

  it('tolerates items without component identity', () => {
    const items = [{ expectedQty: 10, actualQty: 9 }]
    expect(listBlockingItems(items)).toEqual([
      { componentId: null, componentName: null, verdict: 'RED' },
    ])
  })
})

describe('toDbStatus', () => {
  it('maps every verdict onto the database enum', () => {
    expect(toDbStatus('GREEN')).toBe('GREEN')
    expect(toDbStatus('YELLOW')).toBe('YELLOW')
    expect(toDbStatus('RED')).toBe('RED')
    expect(toDbStatus('UNCOUNTED')).toBe(null)
  })
})

describe('assertTransition', () => {
  const legal: [OrderStatus, OrderStatus][] = [
    ['PENDING_VERIFICATION', 'VERIFIED'],
    ['PENDING_VERIFICATION', 'REJECTED'],
    ['REJECTED', 'PENDING_VERIFICATION'],
  ]

  it.each(legal)('allows %s to %s', (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow()
    expect(canTransition(from, to)).toBe(true)
  })

  const illegal: [OrderStatus, OrderStatus][] = [
    ['PENDING_VERIFICATION', 'PENDING_VERIFICATION'],
    ['REJECTED', 'REJECTED'],
    ['REJECTED', 'VERIFIED'],
    ['VERIFIED', 'VERIFIED'],
    ['VERIFIED', 'PENDING_VERIFICATION'],
    ['VERIFIED', 'REJECTED'],
  ]

  it.each(illegal)('rejects %s to %s with a 409 conflict', (from, to) => {
    const error = catchError(() => assertTransition(from, to))
    expect(error).toBeInstanceOf(ConflictError)
    expect((error as ConflictError).status).toBe(409)
    expect(canTransition(from, to)).toBe(false)
  })

  it('keeps the map in sync with the database transition trigger', () => {
    expect(STATE_TRANSITIONS.PENDING_VERIFICATION).toEqual(['VERIFIED', 'REJECTED'])
    expect(STATE_TRANSITIONS.REJECTED).toEqual(['PENDING_VERIFICATION'])
    expect(STATE_TRANSITIONS.VERIFIED).toEqual([])
  })
})

describe('computeWastagePct', () => {
  it('returns 2.78 for 90 expected against 92.5 used', () => {
    expect(computeWastagePct(90, 92.5)).toBe(2.78)
  })

  it('returns 2.04 for 54 expected against 55.1 used', () => {
    expect(computeWastagePct(54, 55.1)).toBe(2.04)
  })

  it('returns 0 when nothing extra was used', () => {
    expect(computeWastagePct(90, 90)).toBe(0)
  })

  it('returns a negative percentage when less fabric than expected was used', () => {
    expect(computeWastagePct(100, 95)).toBe(-5)
  })

  it('rounds to exactly two decimals', () => {
    expect(computeWastagePct(100, 103.333)).toBe(3.33)
  })

  it('returns 0 instead of dividing by zero when nothing was expected', () => {
    expect(computeWastagePct(0, 5)).toBe(0)
    expect(computeWastagePct(0, 0)).toBe(0)
  })

  it('returns 0 for non-finite input', () => {
    expect(computeWastagePct(Number.NaN, 10)).toBe(0)
    expect(computeWastagePct(10, Number.POSITIVE_INFINITY)).toBe(0)
  })
})
