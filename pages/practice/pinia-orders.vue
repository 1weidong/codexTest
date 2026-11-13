<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { usePracticeOrderSelectionStore } from '~/stores/practiceOrderSelection'

const store = usePracticeOrderSelectionStore()

// 故障点：直接解构状态与 getter
const { selectedIds, selectedCount } = storeToRefs(store)

// Pinia action 可以直接解构
const { toggle, clear } = store

const orders = [
  { id: 'order-001', name: '校园 T 恤' },
  { id: 'order-002', name: '团队卫衣' },
  { id: 'order-003', name: '运动背心' },
]
</script>

<template>
  <main>
    <h1>订单批量选择</h1>

    <p>界面已选数量：{{ selectedCount }}</p>
    <p>界面已选 ID：{{ selectedIds.join(', ') || '无' }}</p>

    <ul>
      <li v-for="order in orders" :key="order.id">
        <label>
          <input
            type="checkbox"
            :checked="selectedIds.includes(order.id)"
            @change="toggle(order.id)"
          >
          {{ order.id }} — {{ order.name }}
        </label>
      </li>
    </ul>

    <button @click="clear()">清空选择</button>
    <button :disabled="selectedCount === 0">
      批量导出（仅验证按钮状态）
    </button>

    <hr>
    <p>调试：store 实际数量 {{ store.selectedCount }}</p>
    <pre>store 实际 ID：{{ store.selectedIds }}</pre>
    <NuxtLink to="/">返回首页</NuxtLink>
  </main>
</template>