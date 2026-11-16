import { createError } from '#app'

export type Order = {
  id: string
  total: number
  status: 'paid' | 'shipped'
}

type ReadJson = (path: string) => Promise<unknown>

function parseOrder(value: unknown, expectedId: string): Order {
  if (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    value.id === expectedId &&
    'total' in value &&
    typeof value.total === 'number' &&
    Number.isFinite(value.total) &&
    value.total >= 0 &&
    'status' in value &&
    (value.status === 'paid' || value.status === 'shipped')
  ) {
    return {
      id: value.id,
      total: value.total,
      status: value.status,
    }
  }

  throw createError({
    statusCode: 502,
    message: 'Invalid order payload',
    data: { code: 'INVALID_ORDER_PAYLOAD' },
  })
}

export function createPhase12OrdersApi(readJson: ReadJson) {
  return {
    async getOrder(id: string): Promise<Order> {
      const value = await readJson(
        `/orders/${encodeURIComponent(id)}`,
      )

      return parseOrder(value, id)
    },
  }
}