import { defineStore } from 'pinia'

export const usePracticeOrderSelectionStore = defineStore(
  'practice-order-selection',
  {
    state: () => ({
      selectedIds: [] as string[],
    }),

    getters: {
      selectedCount: state => state.selectedIds.length,
    },

    actions: {
      toggle(id: string) {
        const index = this.selectedIds.indexOf(id)

        if (index === -1) {
          this.selectedIds.push(id)
        } else {
          this.selectedIds.splice(index, 1)
        }
      },

      clear() {
        this.selectedIds = []
      },
    },
  },
)