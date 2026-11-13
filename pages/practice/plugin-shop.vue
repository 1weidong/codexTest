<script setup lang="ts">
const shop = useState<{
  name: string
  currency: string
} | null>('practice-shop', () => null)
</script>

<template>
  <main>
    <h1>店铺配置</h1>

    <template v-if="shop">
      <p>店铺：{{ shop.name }}</p>
      <p>币种：{{ shop.currency }}</p>
    </template>
    <p v-else>配置未就绪</p>

    <NuxtLink to="/">返回首页</NuxtLink>
  </main>
</template>