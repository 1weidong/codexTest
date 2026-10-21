<script setup lang="ts">
type Status = 'pending' | 'shipped'
type FilterStatus = Status | 'all'
type Order = {
  id: string
  storeId: string
  status: Status
}

const route = useRoute()
const router = useRouter()

// query 可能为空、为 null，或因重复参数而成为数组
function firstString(value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? first : ''
}

function parseStatus(value: unknown): FilterStatus {
  const status = firstString(value)
  return status === 'pending' || status === 'shipped' ? status : 'all'
}

const storeId = computed(() =>
  firstString(route.query.storeId) === 'shop-b' ? 'shop-b' : 'shop-a',
)
const urlStatus = computed(() => parseStatus(route.query.status))
const page = computed(() => {
  const value = Number(firstString(route.query.page))
  return Number.isSafeInteger(value) && value >= 1 ? value : 1
})

// 只在 setup 时复制一次
const draftStatus = ref<FilterStatus>(urlStatus.value)

const orders: Order[] = ['shop-a', 'shop-b'].flatMap(store =>
  [1, 2, 3, 4].map((n): Order => ({
    id: `${store}-${n}`,
    storeId: store,
    status: n <= 2 ? 'pending' : 'shipped',
  })),
)

const filtered = computed(() => orders.filter(order =>
  order.storeId === storeId.value
  && (urlStatus.value === 'all' || order.status === urlStatus.value),
))
const totalPages = computed(() => Math.ceil(filtered.value.length / 2))
const visibleOrders = computed(() =>
  filtered.value.slice((page.value - 1) * 2, page.value * 2),
)

async function applyFilter() {
  await router.push({
    path: route.path,
    query: { status: draftStatus.value },
  })
}

async function goPage(target: number) {
  await router.push({
    path: route.path,
    query: { ...route.query, page: String(target) },
    hash: route.hash,
  })
}

console.log('[router-orders setup]',
  import.meta.server ? 'server' : 'client')
</script>

<template>
  <main>
    <h1>订单筛选</h1>
    <p>店铺：{{ storeId }}｜已应用：{{ urlStatus }}｜页码：{{ page }}</p>

    <form @submit.prevent="applyFilter">
      <select v-model="draftStatus" aria-label="订单状态">
        <option value="all">全部</option>
        <option value="pending">待生产</option>
        <option value="shipped">已发货</option>
      </select>
      <button type="submit">应用筛选</button>
    </form>

    <ul>
      <li v-for="order in visibleOrders" :key="order.id">
        {{ order.id }} — {{ order.status }}
      </li>
    </ul>
    <p v-if="visibleOrders.length === 0">暂无订单</p>

    <button :disabled="page <= 1" @click="goPage(page - 1)">
      上一页
    </button>
    <button :disabled="page >= totalPages" @click="goPage(page + 1)">
      下一页
    </button>
  </main>
</template>