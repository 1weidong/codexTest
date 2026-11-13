import { defineStore } from 'pinia'

type Order = {
  id: string
  name: string
  status: 'paid' | 'cancelled'
}

export const usePhase11OrdersStore = defineStore(
  'phase11-orders',
  {
    state: () => ({
      orders: [] as Order[],
      keyword: '',
      pendingId: '',
      error: '',
    }),

    getters: {
      visibleOrders: state =>
        state.orders.filter(order =>
          order.name.includes(state.keyword),
        ),
    },

    actions: {
      async load() {
        this.orders = await $fetch<Order[]>('/api/phase11/orders')
        this.error = ''
      },

      async cancelOrder(id: string) {
        const order = this.orders.find(item => item.id === id)

        if (this.pendingId || !order || order.status !== 'paid') {
          return
        }

        // 在乐观修改之前，保存本次需要恢复的旧值。
        const previousStatus = order.status

        this.pendingId = id
        this.error = ''
        order.status = 'cancelled'

        try {
          const saved = await $fetch<Order>('/api/phase11/orders', {
            method: 'POST',
            body: { id },
          })

          Object.assign(order, saved)
        } catch {
          order.status = previousStatus
          this.error = '取消失败，请重试'
        } finally {
          this.pendingId = ''
        }
      },
    },
  },
)