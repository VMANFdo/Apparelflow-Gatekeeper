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
