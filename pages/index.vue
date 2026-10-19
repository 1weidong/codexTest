<script setup lang="ts">
console.log('[catalog setup]', import.meta.server ? 'server' : 'client')

const products = [
  { id: 1, name: '校园纯棉 T 恤', price: 59 },
  { id: 2, name: '团队连帽卫衣', price: 129 },
]
</script>

<template>
  <main>
    <h1>商品目录</h1>
    <ul>
      <li v-for="product in products" :key="product.id">
        {{ product.name }}：¥{{ product.price }}
      </li>
    </ul>
    <NuxtLink to="/account/orders" :prefetch="false">
      进入订单工作台
    </NuxtLink>
    <br />
    <NuxtLink to="/practice/products" :prefetch="false">
      进入商品列表练习
    </NuxtLink>
    <br />
    <NuxtLink to="/practice/store-summary" :prefetch="false">
      进入店铺统计练习
    </NuxtLink>
  </main>
</template>