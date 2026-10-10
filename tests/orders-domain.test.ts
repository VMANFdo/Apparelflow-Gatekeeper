import { describe, expect, it } from 'vitest'
import {
  computeExpectedFabric,
  computeExpectedPieces,
  createOrderSchema,
  round2,
  summarizeOrders,
} from '@/domain/orders'

const blouseComponents = [
  { id: 'c-front', componentName: 'Front Body Panel', piecesPerGarment: 1 },
  { id: 'c-back', componentName: 'Back Body Panel', piecesPerGarment: 1 },
  { id: 'c-sleeves', componentName: 'Sleeves (Left & Right)', piecesPerGarment: 2 },
  { id: 'c-collar', componentName: 'Collar & Stand', piecesPerGarment: 1 },
  { id: 'c-cuffs', componentName: 'Sleeve Cuffs', piecesPerGarment: 2 },
]

describe('computeExpectedPieces', () => {
  it('computes 50 blouses as 100 cuffs', () => {
    const expected = computeExpectedPieces(blouseComponents, 50)
    const cuffs = expected.find((item) => item.componentId === 'c-cuffs')
    expect(cuffs?.expectedQty).toBe(100)
  })

  it('computes one expected row per component', () => {
    const expected = computeExpectedPieces(blouseComponents, 50)
    expect(expected).toHaveLength(5)
    expect(expected.find((i) => i.componentId === 'c-sleeves')?.expectedQty).toBe(100)
    expect(expected.find((i) => i.componentId === 'c-front')?.expectedQty).toBe(50)
    expect(expected.find((i) => i.componentId === 'c-back')?.expectedQty).toBe(50)
    expect(expected.find((i) => i.componentId === 'c-collar')?.expectedQty).toBe(50)
  })

  it('returns an empty list for a recipe without components', () => {
    expect(computeExpectedPieces([], 10)).toEqual([])
  })
})

describe('computeExpectedFabric', () => {
  it('computes 50 x 1.8 as 90 yards', () => {
    expect(computeExpectedFabric(1.8, 50)).toBe(90)
  })

  it('computes 50 x 1.1 as 55 yards', () => {
    expect(computeExpectedFabric(1.1, 50)).toBe(55)
  })

  it('rounds floating point artifacts to 2 decimals', () => {
    expect(computeExpectedFabric(1.15, 100)).toBe(115)
    expect(computeExpectedFabric(1.1, 3)).toBe(3.3)
    expect(computeExpectedFabric(2.35, 7)).toBe(16.45)
  })

  it('round2 keeps at most 2 decimals', () => {
    expect(round2(12.345)).toBe(12.35)
    expect(round2(90)).toBe(90)
  })
})

describe('createOrderSchema', () => {
  const validInput = {
    recipe_id: '11111111-1111-4111-8111-111111111111',
    target_qty: 50,
    fabric_roll_id: 'ROLL-2026-A1',
    actual_fabric_yds: 92.5,
  }

  it('accepts a valid payload', () => {
    const result = createOrderSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rejects a non-uuid recipe_id', () => {
    expect(
      createOrderSchema.safeParse({ ...validInput, recipe_id: 'not-a-uuid' }).success
    ).toBe(false)
  })

  it.each([0, -5, 100001, 2.5, '50'])('rejects target_qty %p', (value) => {
    expect(createOrderSchema.safeParse({ ...validInput, target_qty: value }).success).toBe(false)
  })

  it.each(['ab', 'a'.repeat(41), 'ROLL 01', 'roll_1'])(
    'rejects fabric_roll_id %p',
    (value) => {
      expect(createOrderSchema.safeParse({ ...validInput, fabric_roll_id: value }).success).toBe(
        false
      )
    }
  )

  it.each([0, -1, 12.345, 1000001, '92.5'])(
    'rejects actual_fabric_yds %p',
    (value) => {
      expect(
        createOrderSchema.safeParse({ ...validInput, actual_fabric_yds: value }).success
      ).toBe(false)
    }
  )

  it('strips unknown fields instead of rejecting them', () => {
    const result = createOrderSchema.parse({
      ...validInput,
      expected_qty: 9999,
      status: 'VERIFIED',
      role: 'admin',
    })
    expect(result).toEqual(validInput)
    expect(result).not.toHaveProperty('expected_qty')
    expect(result).not.toHaveProperty('status')
    expect(result).not.toHaveProperty('role')
  })
})

describe('summarizeOrders', () => {
  it('returns zeros for an empty list', () => {
    expect(summarizeOrders([])).toEqual({ total: 0, pending: 0, verified: 0, rejected: 0 })
  })

  it('tallies mixed statuses', () => {
    const orders = [
      { status: 'PENDING_VERIFICATION' },
      { status: 'VERIFIED' },
      { status: 'VERIFIED' },
      { status: 'REJECTED' },
    ] as const
    expect(summarizeOrders(orders)).toEqual({ total: 4, pending: 1, verified: 2, rejected: 1 })
  })

  it('handles a single status', () => {
    const orders = [{ status: 'VERIFIED' }, { status: 'VERIFIED' }] as const
    expect(summarizeOrders(orders)).toEqual({ total: 2, pending: 0, verified: 2, rejected: 0 })
  })
})
