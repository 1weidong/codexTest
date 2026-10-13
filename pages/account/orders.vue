<script setup lang="ts">
  console.log('[orders setup]', import.meta.server ? 'server' : 'client')
type Order = { id: string; status: string }

const storeId = ref('')
const orders = ref<Order[]>([])
const status = ref<'pending' | 'success' | 'error'>('pending')
const error = ref(false)

onMounted(async () => {
  try {
    storeId.value = localStorage.getItem('last-store-id') ?? 'shop-a'
    orders.value = await $fetch<Order[]>('/api/orders', {
      query: { storeId: storeId.value },
    })
    status.value = 'success'
  } catch {
    error.value = true
    status.value = 'error'
  }
})
</script>

<template>
  <main>
    <h1>订单工作台</h1>
    <p>当前店铺：{{ storeId }}</p>

    <p v-if="status === 'idle' || status === 'pending'">加载中…</p>
    <p v-else-if="error">订单加载失败</p>
    <ul v-else>
      <li v-for="order in orders" :key="order.id">
        {{ order.id }} — {{ order.status }}
      </li>
    </ul>

    <NuxtLink to="/">返回商品目录</NuxtLink>
  </main>
</template>