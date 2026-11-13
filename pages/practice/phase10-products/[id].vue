<script setup lang="ts">
type Product = {
  id: string
  name: string
  price: number
  revision: number
}

definePageMeta({
  key: 'phase10-product',
})

const route = useRoute()
const showRevision = ref(true)

// 故障点：只读取了一次参数。
const id = computed(() => route.params.id as string)

const { data: product, status, error, refresh } =
  await useFetch<Product>(() => `/api/phase10/products/${id.value}`)

onMounted(() => {
  console.log('[phase10 PAGE] mounted')
})
</script>

<template>
  <main>
    <nav>
      <NuxtLink to="/practice/phase10-products/a" :prefetch="false">
        商品 A
      </NuxtLink>
      |
      <NuxtLink to="/practice/phase10-products/b" :prefetch="false">
        商品 B
      </NuxtLink>
    </nav>

    <p>当前路由商品：{{ route.params.id }}</p>

    <label>
      <input v-model="showRevision" type="checkbox">
      显示版本号
    </label>

    <p v-if="status === 'pending'">读取中……</p>
    <p v-else-if="error">读取失败</p>

    <template v-else-if="product">
      <h1>{{ product.name }}</h1>
      <p>数据商品：{{ product.id }}</p>
      <p>价格：¥{{ product.price }}</p>
      <p v-if="showRevision">版本：{{ product.revision }}</p>
    </template>

    <button :disabled="status === 'pending'" @click="refresh()">
      刷新当前数据
    </button>
  </main>
</template>