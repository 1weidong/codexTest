<script setup lang="ts">
type Product = {
  id: number
  name: string
  price: number
}

const products: Product[] = [
  { id: 1, name: '校园 T 恤', price: 59 },
  { id: 2, name: '团队卫衣', price: 129 },
  { id: 3, name: '运动背心', price: 49 },
]

const isMobile = ref(
  import.meta.client && window.innerWidth < 768,
)

const cartCount = ref(0)

console.log(
  '[products setup]',
  import.meta.server ? 'server' : 'client',
  { isMobile: isMobile.value },
)
</script>

<template>
  <main>
    <h1>推荐商品</h1>
    <p>购物车：{{ cartCount }}</p>

    <ul v-if="isMobile" class="mobile-list">
      <li v-for="product in products" :key="product.id">
        <h2>{{ product.name }}</h2>
        <p>¥{{ product.price }}</p>
        <button @click="cartCount++">加入购物车</button>
      </li>
    </ul>

    <div v-else class="desktop-grid">
      <article v-for="product in products" :key="product.id">
        <h2>{{ product.name }}</h2>
        <p>¥{{ product.price }}</p>
        <button @click="cartCount++">加入购物车</button>
      </article>
    </div>

    <NuxtLink to="/">返回首页</NuxtLink>
  </main>
</template>

<style scoped>
.desktop-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.mobile-list {
  padding: 0;
  list-style: none;
}
</style>