<script setup lang="ts">
const route = useRoute()
const { $phase12Orders } = useNuxtApp()

const id = computed(() =>
  typeof route.query.id === 'string' ? route.query.id : 'ok',
)

const { data, error, status, refresh } = await useAsyncData(
  'phase12-order',
  () => $phase12Orders.getOrder(id.value),
  { watch: [id] },
)
</script>

<template>
  <main>
    <h1>订单请求边界</h1>

    <nav>
      <NuxtLink
        v-for="caseId in ['ok', 'missing', 'broken']"
        :key="caseId"
        :to="{
          path: '/practice/phase12-orders',
          query: { id: caseId },
        }"
        :prefetch="false"
      >
        {{ caseId }}
      </NuxtLink>
    </nav>

    <p>当前场景：{{ id }}</p>
    <p>异步状态：{{ status }}</p>

    <p v-if="status === 'pending'">读取中……</p>

    <p v-else-if="error">
      失败：{{ error.statusCode }} — {{ error.message }}
    </p>

    <template v-else-if="data">
      <p>订单：{{ data.id }}</p>
      <p>金额：{{ data.total }}</p>
      <p>金额运行时类型：{{ typeof data.total }}</p>
      <p>订单状态：{{ data.status }}</p>
    </template>

    <button :disabled="status === 'pending'" @click="refresh()">
      重新读取
    </button>
  </main>
</template>