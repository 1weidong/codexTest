<script setup lang="ts">
type OrdersResponse = {
  user: string
  orders: { id: string; product: string }[]
}

const requestFetch = useRequestFetch()

const { data, error, status, refresh } = await useAsyncData(
  'phase7-orders',
  () => requestFetch<OrdersResponse>('/api/phase7/orders'),
)
</script>

<template>
  <main>
    <h1>我的订单</h1>

    <p v-if="status === 'pending'">加载中……</p>
    <p v-else-if="error">
      订单读取失败：{{ error.statusCode }}
    </p>

    <template v-else-if="data">
      <p>当前用户：{{ data.user }}</p>
      <ul>
        <li v-for="order in data.orders" :key="order.id">
          {{ order.id }} — {{ order.product }}
        </li>
      </ul>
    </template>

    <button
      :disabled="status === 'pending'"
      @click="refresh()"
    >
      重新读取
    </button>

    <NuxtLink to="/practice/phase7-login" :prefetch="false">
      返回登录页
    </NuxtLink>
  </main>
</template>