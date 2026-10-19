# 第 1 期｜SSR/CSR：订单页站内跳转正常，直接刷新却报错



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

Q. 保留 SSR 骨架的解法中，为什么把 `useFetch` 改为 `$fetch`？

A. 这是为了匹配“挂载后先读取店铺，再主动请求订单”的执行方式，并非必须替换。解决 `localStorage` 服务端报错的是 `onMounted`，不是 `$fetch`；`$fetch` 本身也可以在服务端使用。

| 区别             | `$fetch`                         | Nuxt`useFetch`                                          |
| ---------------- | ---------------------------------- | --------------------------------------------------------- |
| 主要职责         | 执行一次请求                       | 执行请求并管理页面异步数据状态                            |
| `await` 返回值 | 接口结果，例如`Order[]`          | 包含`data`、`status`、`error`、`execute` 等的对象 |
| 响应式状态       | 自己用`ref` 管理                 | 提供响应式数据、状态和错误                                |
| 请求错误         | 通常抛出异常，用`try/catch` 处理 | 通常记录到`error` 中，检查 `error.value`              |
| SSR 数据复用     | 单独使用时不负责将结果传给浏览器   | 通过 Nuxt payload 传递初始数据，供水合复用                |
| 参数变化         | 不自动请求                         | 支持监听响应式参数并重新请求                              |

本题选择 `$fetch` 的具体原因：

1. 店铺 ID 来自 `localStorage`，必须先在浏览器读取，再请求订单。
2. 服务端只渲染加载骨架，没有服务端订单数据需要传给浏览器复用。
3. 解法已经用 `ref` 管理订单、加载和错误状态，无需再创建一套 `useFetch` 状态。
4. `try/catch` 和 `await` 可以直接表达“读取店铺 → 请求订单 → 更新状态”的顺序。

```ts
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
```

以上变量沿用前面的 SSR 骨架示例。代价是请求状态需要自行维护。若希望使用 `useFetch` 提供的状态管理，可以在 `setup` 中创建它，挂载后调用 `execute()`，见下一题。

不要将这个替换推广到所有 SSR 初始请求。在 SSR 页顶层单独调用 `$fetch`，如果没有 `useAsyncData` 等机制传递结果，服务端和浏览器可能各请求一次。需要 SSR 初始数据时，通常使用 `useFetch`，或用 `useAsyncData` 包裹 `$fetch`。CSR 页面也可以使用 `useFetch`，其状态管理、刷新与参数监听仍有价值。

Q. 如果把 `useFetch` 放在 `onMounted` 函数中，有什么影响？

A. 挂载后才创建 `useFetch`，不一定报错，某些场景可以正常工作，但不推荐作为常规写法。应区分“创建请求状态”和“触发请求”。

```ts
// 不推荐：挂载后才创建 useFetch
onMounted(async () => {
  const { data } = await useFetch('/api/orders')
})
```

具体影响：

1. **没有这次请求的 SSR 数据。** `onMounted` 不在服务端执行，即使写 `server: true`，也不会让这里的请求回到服务端执行。页面可以有 SSR 骨架，但订单仍在浏览器加载。
2. **可能出现挂载时机提示或调度问题。** 开发环境可能提示 `Component is already mounted, please use $fetch instead.`。警告不等于请求必然失败；是否出现、请求是否正常，还取决于 Nuxt 版本与水合时机。历史版本曾出现挂载回调中调用却没有发起请求的问题，不能将历史问题视为所有版本必然失败。
3. **前面有其他 `await` 时，可能丢失上下文。** `onMounted(async () => { await prepareSomething(); await useFetch(...) })` 中，异步恢复后可能不再具有所需的组件或 Nuxt 上下文。不能直接套用 `<script setup>` 顶层 `await` 的上下文处理方式；具体行为受版本与异步上下文配置影响。
4. **回调局部变量不能直接用于模板。** 回调里声明的 `const { data: orders }` 只属于该回调作用域；模板不能直接使用它。这是 JavaScript 作用域问题，不是 Nuxt 特有问题。

推荐方式一：挂载后主动请求一次，用 `$fetch`，状态管理沿用前面的示例。

推荐方式二：在 `setup` 中创建 `useFetch`，挂载后再调用 `execute()`。以下代码用于保留 SSR 骨架的订单页，需移除该页的 `ssr: false` 路由规则：

```vue
<script setup lang="ts">
type Order = { id: string; status: string }

const storeId = ref('')
const storageError = ref(false)

const {
  data: orders,
  status,
  error,
  execute,
} = await useFetch<Order[]>('/api/orders', {
  query: { storeId },
  server: false,
  immediate: false,
  watch: false,
})

onMounted(async () => {
  try {
    storeId.value = localStorage.getItem('last-store-id') ?? 'shop-a'
  } catch {
    storageError.value = true
    return
  }
  await execute()
})
</script>
```

模板先判断 `storageError || error` 显示错误，再把 `idle` 或 `pending` 显示为加载状态，成功后展示订单。`execute()` 的接口错误通常记录在 `error` 中；不能只依赖捕获读取存储异常的 `try/catch` 来处理接口错误。

| 配置                   | 作用                                       |
| ---------------------- | ------------------------------------------ |
| `server: false`      | 不在 SSR 阶段自动获取这份数据              |
| `immediate: false`   | 创建时不自动发起初始请求                   |
| `watch: false`       | 参数变化时不自动请求，由`execute()` 控制 |
| `query: { storeId }` | 保留 ref，执行时使用更新后的店铺 ID        |

这里不要改成 `query: { storeId: storeId.value }`：创建时取到的是空字符串，后续修改 ref 不会更新这个普通字符串参数。

关键区别：在 `setup` 中先准备好 `data/status/error`，挂载后只执行请求。需要推迟的是请求时机，通常不需要连 `useFetch` 状态的创建一起推迟。

参考：[Nuxt 3 useFetch](https://nuxt.com/docs/3.x/api/composables/use-fetch)、[Nuxt 3 数据获取](https://nuxt.com/docs/3.x/getting-started/data-fetching)、[Vue onMounted](https://vuejs.org/api/composition-api-lifecycle.html#onmounted)。
