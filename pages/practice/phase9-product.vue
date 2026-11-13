<script setup lang="ts">
type Product = {
  id: string
  name: string
  price: number
  revision: number
}

const updating = ref(false)
const message = ref('')

const { data: product, error, status, refresh } =
  await useAsyncData('phase9-product', () => {
    console.log(
      '[phase9 handler]',
      import.meta.server ? 'server' : 'client',
    )

    return $fetch<Product>('/api/phase9/product')
  })

async function reprice() {
  updating.value = true

  try {
    const saved = await $fetch<Product>('/api/phase9/reprice', {
      method: 'POST',
    })

    // 模拟后台改价，暂不修改前台展示数据。
    message.value =
      `后台已改为 ¥${saved.price}，版本 ${saved.revision}`
  } catch {
    message.value = '改价失败，请检查请求'
  } finally {
    updating.value = false
  }
}
</script>

<template>
  <main>
    <h1>商品价格检查</h1>

    <p v-if="error">读取失败，请重试</p>

    <template v-else-if="product">
      <p>{{ product.name }}</p>
      <p>前台价格：¥{{ product.price }}</p>
      <p>前台版本：{{ product.revision }}</p>
    </template>

    <button
      :disabled="updating || status === 'pending'"
      @click="reprice()"
    >
      模拟后台加价 10 元
    </button>

    <button
      :disabled="updating || status === 'pending'"
      @click="refresh()"
    >
      刷新价格
    </button>

    <p>{{ message }}</p>
  </main>
</template>