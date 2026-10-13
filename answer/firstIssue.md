# 第一期答案

Q. 解释为什么站内跳转成功，刷新却失败，并指出报错发生在哪一端。

A. 从首页通过 `NuxtLink` 进入订单页时，页面的 `setup` 在浏览器中执行，能够读取 `localStorage`。在尚未关闭订单页 SSR 的情况下，直接打开或刷新订单页会先在服务端执行 `setup`；服务端没有浏览器的 `localStorage`，因此报错发生在服务端。

`definePageMeta({ layout: false })` 只关闭布局，不会关闭 SSR。

Q. 让订单工作台使用 CSR，同时保留商品目录的 SSR。

A. 在 `nuxt.config.ts` 中按访问 URL 设置路由规则：

```ts
export default defineNuxtConfig({
  ssr: true,
  routeRules: {
    '/account/orders': { ssr: false },
  },
})
```

重启开发服务器后，直接打开或刷新订单页验证。商品目录保留 SSR，订单页使用 CSR。规则匹配 `/account/orders`，而不是文件路径 `/pages/account/orders.vue`。

Q. 保留加载和错误反馈，不使用整页 `<ClientOnly>`。

A. 订单页的 CSR 配置生效后，本练习中 `setup` 读取 `localStorage` 可以正常运行，无需为了避免 SSR 报错而移到 `onMounted`。

加载和错误反馈需要通过请求状态控制模板，不能只移动读取存储的代码。以下为 CSR 订单页的完整示例，沿用练习中的 `/api/orders` 接口：

```vue
<script setup lang="ts">
type Order = { id: string; status: string }

const storeId = localStorage.getItem('last-store-id') ?? 'shop-a'

const { data: orders, status, error } = await useFetch<Order[]>('/api/orders', {
  query: { storeId },
  lazy: true,
})
</script>

<template>
  <main>
    <h1>订单工作台</h1>
    <p>当前店铺：{{ storeId }}</p>
    <p v-if="status === 'idle' || status === 'pending'">加载中…</p>
    <p v-else-if="error">订单加载失败</p>
    <ul v-else>
      <li v-for="order in orders" :key="order.id">
        {{ order.id }} — {{ order.status }}
      </li>
    </ul>
    <NuxtLink to="/">返回商品目录</NuxtLink>
  </main>
</template>
```

这里的 `lazy: true` 让页面无需等请求完成才显示，可以先呈现加载状态；它不是关闭 SSR 的开关。

Q. 把 `useFetch` 改成 `{ server: false }`，能否单独修复原来的代码？

A. 不能。在原来的 SSR 页面中，报错发生在调用 `useFetch` 之前：

```ts
const storeId = localStorage.getItem('last-store-id') ?? 'shop-a'
```

`server: false` 只控制该数据请求不在服务端发起，不会阻止页面的 `setup` 在服务端执行，也不会保护前面的 `localStorage` 读取。

Q. 如果订单页必须保留 SSR 页面骨架，怎样调整读取店铺和请求订单的时机？

A. 移除订单页的 `ssr: false` 路由规则。让服务端和浏览器初次渲染使用相同的空店铺与加载状态，挂载后再读取存储并请求订单：

```vue
<script setup lang="ts">
type Order = { id: string; status: string }

const storeId = ref('')
const orders = ref<Order[]>([])
const status = ref<'pending' | 'success' | 'error'>('pending')

onMounted(async () => {
  try {
    storeId.value = localStorage.getItem('last-store-id') ?? 'shop-a'
    orders.value = await $fetch<Order[]>('/api/orders', {
      query: { storeId: storeId.value },
    })
    status.value = 'success'
  } catch {
    status.value = 'error'
  }
})
</script>

<template>
  <main>
    <h1>订单工作台</h1>
    <p>当前店铺：{{ storeId }}</p>
    <p v-if="status === 'pending'">加载中…</p>
    <p v-else-if="status === 'error'">订单加载失败</p>
    <ul v-else>
      <li v-for="order in orders" :key="order.id">
        {{ order.id }} — {{ order.status }}
      </li>
    </ul>
    <NuxtLink to="/">返回商品目录</NuxtLink>
  </main>
</template>
```

`onMounted` 不在服务端执行。这里由挂载回调主动发起请求，所以使用 `$fetch`。这样保留的是 SSR 页面骨架，订单数据仍在浏览器挂载后加载。

如果改用 `useFetch({ server: false })`，还需要明确控制请求时机，确保读取店铺后才发起请求；只添加这个选项不能保证请求使用正确的店铺 ID。

Q. 恢复 `shop-b` 后刷新、订单恢复且没有水合警告，验证什么？

A. 对 CSR 解法，主要验证修正输入后重新加载成功：请求参数为 `storeId=shop-b`，接口返回 200，页面显示该店铺的订单。它不验证无需刷新的错误恢复能力。

CSR 订单页没有服务端渲染的订单内容需要水合，因此“没有水合警告”不能用来证明修复了订单页的水合问题。只有采用保留 SSR 骨架的解法时，才需要检查服务端与浏览器初次渲染是否一致、是否出现水合不匹配警告。

Q. CSR 订单页能否静态导入顶层访问 `window` 的 SDK？

A. 在本练习的 CSR 配置生效、SDK 仅由该页面导入且运行正常的情况下，可以这样写，无需为了避免 SSR 而强制改用动态导入：

```vue
<script setup lang="ts">
import { init } from '~/utils/browser-sdk'

onMounted(() => {
  init()
})
</script>
```

关闭订单页的 SSR，不会同时关闭其他 SSR 页面或普通插件的服务端执行。如果它们也静态导入这个 SDK，模块顶层访问 `window` 仍可能报错；调用处的 `onMounted` 或 `import.meta.client` 判断不会推迟外面的静态导入。

这类导入路径可改为 `plugins/sdk.client.ts`，或在组件的 `onMounted` 中使用 `await import(...)`。需要访问页面具体 DOM 元素的初始化，应等对应组件挂载后再执行。服务端产物包含某个模块，也不等于该模块已经在服务端执行；具体加载与裁剪行为还取决于 Nuxt 版本和导入路径。
