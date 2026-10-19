<script setup lang="ts">
type Summary = {
  storeId: string
  orderCount: number
  profit: number
  sampledAt: number
}

const {
  data: summaryA,
  status: statusA,
  error: errorA,
  refresh: refreshA,
} = await useAsyncData<Summary>(
  'store-summary-shop-a',
  () => $fetch('/api/practice/store-summary', {
    query: { storeId: 'shop-a' },
  }),
)

const {
  data: summaryB,
  status: statusB,
  error: errorB,
  refresh: refreshB,
} = await useAsyncData<Summary>(
  'store-summary-shop-b',
  () => $fetch('/api/practice/store-summary', {
    query: { storeId: 'shop-b' },
  }),
)
</script>

<template>
  <main>
    <h1>店铺经营统计</h1>

    <section>
      <h2>店铺 A</h2>
      <p v-if="errorA">统计加载失败</p>
      <pre v-else>{{ summaryA }}</pre>
      <button
        :disabled="statusA === 'pending'"
        @click="refreshA()"
      >
        刷新 A
      </button>
    </section>

    <section>
      <h2>店铺 B</h2>
      <p v-if="errorB">统计加载失败</p>
      <pre v-else>{{ summaryB }}</pre>
      <button
        :disabled="statusB === 'pending'"
        @click="refreshB()"
      >
        刷新 B
      </button>
    </section>
  </main>
</template>