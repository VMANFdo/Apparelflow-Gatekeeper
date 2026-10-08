import { describe, expect, it } from 'vitest'
import { approveOrderSchema, saveCountsSchema } from '@/domain/verification'

const componentId = '11111111-1111-4111-8111-111111111111'
const otherComponentId = '22222222-2222-4222-8222-222222222222'

describe('saveCountsSchema', () => {
  it('accepts a valid count payload', () => {
    const parsed = saveCountsSchema.parse({
      counts: [{ component_id: componentId, actual_qty: 40 }],
    })
    expect(parsed.counts).toEqual([{ component_id: componentId, actual_qty: 40 }])
  })

  it('strips unknown fields instead of rejecting them', () => {
    const parsed = saveCountsSchema.parse({
      counts: [
        { component_id: componentId, actual_qty: 40, status: 'GREEN', expected_qty: 9999 },
      ],
    })
    expect(parsed.counts[0]).toEqual({ component_id: componentId, actual_qty: 40 })
    expect(parsed.counts[0]).not.toHaveProperty('status')
    expect(parsed.counts[0]).not.toHaveProperty('expected_qty')
  })

  it('accepts a partial payload with a single component', () => {
    const parsed = saveCountsSchema.parse({
      counts: [{ component_id: otherComponentId, actual_qty: 0 }],
    })
    expect(parsed.counts).toHaveLength(1)
  })

  it('accepts zero as a count', () => {
    const parsed = saveCountsSchema.parse({
      counts: [{ component_id: componentId, actual_qty: 0 }],
    })
    expect(parsed.counts[0]?.actual_qty).toBe(0)
  })

  it('rejects a negative count', () => {
    expect(() =>
      saveCountsSchema.parse({ counts: [{ component_id: componentId, actual_qty: -1 }] })
    ).toThrow()
  })

  it('rejects a decimal count', () => {
    expect(() =>
      saveCountsSchema.parse({ counts: [{ component_id: componentId, actual_qty: 2.5 }] })
    ).toThrow()
  })

  it('rejects a count above one million', () => {
    expect(() =>
      saveCountsSchema.parse({ counts: [{ component_id: componentId, actual_qty: 1000001 }] })
    ).toThrow()
  })

  it('rejects a count sent as a string', () => {
    expect(() =>
      saveCountsSchema.parse({ counts: [{ component_id: componentId, actual_qty: '50' }] })
    ).toThrow()
  })

  it('rejects an empty counts array', () => {
    expect(() => saveCountsSchema.parse({ counts: [] })).toThrow()
  })

  it('rejects a duplicate component id', () => {
    expect(() =>
      saveCountsSchema.parse({
        counts: [
          { component_id: componentId, actual_qty: 40 },
          { component_id: componentId, actual_qty: 41 },
        ],
      })
    ).toThrow()
  })

  it('rejects an invalid component id', () => {
    expect(() =>
      saveCountsSchema.parse({ counts: [{ component_id: 'not-a-uuid', actual_qty: 1 }] })
    ).toThrow()
  })

  it('rejects a missing counts array', () => {
    expect(() => saveCountsSchema.parse({})).toThrow()
  })
})

describe('approveOrderSchema', () => {
  it('accepts an empty body', () => {
    expect(approveOrderSchema.parse({})).toEqual({})
  })

  it('accepts a note and trims it', () => {
    const parsed = approveOrderSchema.parse({ approval_note: '  All counts verified.  ' })
    expect(parsed.approval_note).toBe('All counts verified.')
  })

  it('accepts a blank note as an empty value', () => {
    const parsed = approveOrderSchema.parse({ approval_note: '   ' })
    expect(parsed.approval_note).toBe('')
  })

  it('strips unknown fields instead of rejecting them', () => {
    const parsed = approveOrderSchema.parse({ approval_note: 'Fine', status: 'VERIFIED' })
    expect(parsed).toEqual({ approval_note: 'Fine' })
    expect(parsed).not.toHaveProperty('status')
  })

  it('rejects a note longer than 500 characters', () => {
    expect(() => approveOrderSchema.parse({ approval_note: 'x'.repeat(501) })).toThrow()
  })

  it('rejects a note sent as a number', () => {
    expect(() => approveOrderSchema.parse({ approval_note: 42 })).toThrow()
  })
})
