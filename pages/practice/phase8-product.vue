<script setup lang="ts">
type Tab = 'details' | 'reviews'

const route = useRoute()
const router = useRouter()

const activeTab = computed<Tab>(() =>
  route.query.tab === 'reviews' ? 'reviews' : 'details',
)

console.log(
  '[phase8 setup]',
  import.meta.server ? 'server' : 'client',
  { query: route.query, tab: activeTab.value },
)

const { data: product, error } = await useFetch(
  '/api/phase8/product',
  { key: 'phase8-product' },
)

async function selectTab(tab: Tab) {
  await router.push({
    path: route.path,
    query: { ...route.query, tab },
    hash: '',
  })
}
</script>

<template>
  <main>
    <p v-if="error">商品加载失败</p>

    <template v-else-if="product">
      <h1>{{ product.name }}</h1>

      <nav>
        <button @click="selectTab('details')">
          商品详情
        </button>
        <button @click="selectTab('reviews')">
          买家评价
        </button>
      </nav>

      <section v-if="activeTab === 'details'" id="details">
        <h2>商品详情</h2>
        <p>{{ product.description }}</p>
      </section>

      <section v-else id="reviews">
        <h2>买家评价</h2>
        <ul>
          <li v-for="review in product.reviews" :key="review.id">
            {{ review.content }}
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>