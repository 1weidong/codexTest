<script setup lang="ts">
import { usePhase11OrdersStore } from '~/stores/phase11Orders'

const store = usePhase11OrdersStore()

await callOnce('phase11-orders-init', () => store.load())
</script>

<template>
  <main>
    <h1>订单管理</h1>

    <input v-model="store.keyword" placeholder="输入商品关键词">

    <p>当前关键词：{{ store.keyword || '无' }}</p>
    <p>store 订单总数：{{ store.orders.length }}</p>
    <p v-if="store.error">{{ store.error }}</p>

    <ul>
      <li v-for="order in store.visibleOrders" :key="order.id">
        {{ order.id }} — {{ order.name }} — {{ order.status }}

        <button
          :disabled="!!store.pendingId || order.status !== 'paid'"
          @click="store.cancelOrder(order.id)"
        >
          {{ store.pendingId === order.id ? '处理中' : '取消订单' }}
        </button>
      </li>
    </ul>

    <p v-if="store.orders.length === 0">订单列表为空</p>

    <button :disabled="!!store.pendingId" @click="store.load()">
      重新同步服务端
    </button>

    <NuxtLink to="/practice/phase11-entry" :prefetch="false">
      离开订单页
    </NuxtLink>
  </main>
</template>