# 第 10 期｜Vue Router：URL 已切到商品 B，为什么还显示商品 A？

日期：2026 年 11 月 11 日。主题：路由参数响应与 Nitro 服务端缓存。第二轮第 4 期。难度：中级。预计耗时：55–70 分钟。

## 场景与目标

商品管理页支持在 A、B 间切换。为了保留显示偏好，团队给页面设置固定 key，测试发现：

- A 切到 B，URL 已变化，内容仍是 A；整页刷新正常。
- 修复切换后，后台给 B 改价，点击刷新仍是旧价；这次整页刷新也无效。

本期先排查页面实例复用后的参数更新，再排查 Nitro 函数缓存，区分“请求了错误商品”和“正确商品的数据尚未失效”。

## 复现代码

使用 Nuxt 3 + TypeScript、Nitro 2，根目录 `pages/`、`server/api/` 结构。`app.vue` 保持：

```vue
<template>
  <NuxtPage />
</template>
```

本题显式设置固定页面 key 来复现实例复用，不假设所有 Nuxt 动态页面默认如此。`definePageMeta` 的 key 可控制页面重新渲染行为。

### 数据源与函数缓存

创建 `server/utils/phase10Catalog.ts`：

```ts
// 本地单进程模拟数据库，仅保存公共商品。
// 数据源与下面的函数结果缓存是两层不同的东西。
export const phase10Catalog: Record<string, {
  id: string
  name: string
  price: number
  revision: number
}> = {
  a: { id: 'a', name: '商品 A：卫衣', price: 199, revision: 1 },
  b: { id: 'b', name: '商品 B：背包', price: 299, revision: 1 },
}

export const readPhase10Product = defineCachedFunction(
  async (id: string) => {
    console.log('[phase10 SOURCE] 读取数据源', id)

    await new Promise(resolve => setTimeout(resolve, 200))

    // 返回副本，避免后续改价直接修改缓存中的对象。
    return { ...phase10Catalog[id] }
  },
  {
    group: 'phase10',
    name: 'product',
    getKey: (id: string) => id,
    maxAge: 60,
    swr: false,
  },
)
```

### 读取接口

创建 `server/api/phase10/products/[id].get.ts`：

```ts
import { readPhase10Product } from '../../../utils/phase10Catalog'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (id !== 'a' && id !== 'b') {
    throw createError({ statusCode: 404 })
  }

  // 排除浏览器 HTTP 缓存，保留函数结果缓存。
  setHeader(event, 'Cache-Control', 'no-store')
  console.log('[phase10 API] 收到 GET', id)

  return await readPhase10Product(id)
})
```

### 故障写接口

创建 `server/api/phase10/products/[id].post.ts`：

```ts
import { phase10Catalog } from '../../../utils/phase10Catalog'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')

  if (id !== 'a' && id !== 'b') {
    throw createError({ statusCode: 404 })
  }

  setHeader(event, 'Cache-Control', 'no-store')
  phase10Catalog[id].price += 10
  phase10Catalog[id].revision += 1

  console.log('[phase10 WRITE] 已改价', id)

  // 故障点：更新了数据源，尚未处理函数结果缓存。
  return { ...phase10Catalog[id] }
})
```

### 故障页面

创建 `pages/practice/phase10-products/[id].vue`：

```vue
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
const id = String(route.params.id)

const { data: product, status, error, refresh } =
  await useFetch<Product>(`/api/phase10/products/${id}`)

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
```

使用 Nuxt 自动导入的 useRoute。本题不配置其他页面、API、CDN 或代理缓存；模拟数据库不是生产存储，服务端重启后可能重置。

## 实现与排查任务

### 第一阶段：路由切换

运行 `yarn dev`，直接打开：

```text
http://localhost:3000/practice/phase10-products/a
```

1. 取消“显示版本号”。
2. 点击“商品 B”。
3. 对比“当前路由商品”与“数据商品”。
4. 查看 Network 是否请求 B。
5. 点击刷新，检查实际请求 A 还是 B。
6. 在 B 地址整页刷新，再对比结果。

要求保留固定页面 key 与本地显示偏好，让请求 URL 持续跟随参数；前进后退时最终数据对应当前路由。不使用强制重建或整页刷新完成修复。

### 第二阶段：服务端缓存

先修复第一阶段，再打开 B，点击一次刷新，确保 B 的函数结果已缓存。在浏览器控制台模拟后台改价：

```js
await fetch('/api/phase10/products/b', {
  method: 'POST',
}).then(response => response.json())
```

确认返回更高价格与版本后，在缓存创建后 60 秒内：

1. 点击页面刷新。
2. 确认 GET 真正到达服务端。
3. 对比 API 与 SOURCE 日志。
4. 整页刷新 B，检查价格。
5. 缓存年龄超过 60 秒后再读取。

解释现象，并修改写接口，使改价成功后的下一次读取取得新版本。先不考虑并发读写，只按“等待改价完成，再读取”的顺序验证。

## 验证步骤与成功标准

| 操作 | 成功标准 |
| --- | --- |
| 直接刷新 A / B | 原始 HTML 已有对应商品，水合无新增警告 |
| A → B | 最终数据 ID 为 b，不继续展示 A |
| B → A、后退与前进 | 最终路由 ID 与数据 ID 一致 |
| 取消版本显示后切换 | 偏好保留，mounted 日志不重复出现 |
| 点击刷新当前数据 | 请求 URL 对应当前路由商品 |
| 未改价、有效期内读取 | API 日志增加，SOURCE 不增加 |
| 原写接口改价后立即读取 | API 收到请求，但可能返回缓存旧版本 |
| 过期后读取 | swr:false，等待新结果并返回新版本 |
| 修复写接口，改价完成再读取 | 不等 TTL，立即得到新版本 |

GET 已设置 no-store，旧价不能归因于浏览器强缓存。200 也可能装着服务端函数缓存的旧数据。

Disable cache、普通刷新和强制刷新不能直接删除 Nitro 函数缓存。命中证据来自 API 与 SOURCE 两组日志。

## 参考答案

### Q1. 为什么 URL 更新了，数据仍是 A？

```ts
const id = String(route.params.id)
```

它保存 setup 执行时的普通字符串。页面实例复用后，路由参数更新，但该字符串和已拼好的请求 URL 不会自动变化。

Vue Router 复用同一实例时，不会重新执行完整初始化生命周期。Nuxt 还需结合页面 key 判断是否复用；本题用固定 key 明确这一条件。

### Q2. 如何持续读取当前商品参数？

替换参数读取与请求部分，其余固定 key、显示偏好和模板不变：

```ts
const id = computed(() => String(route.params.id))

const { data: product, status, error, refresh } =
  await useFetch<Product>(
    () => `/api/phase10/products/${id.value}`,
  )
```

computed 持续读取参数，URL getter 持续读取 computed。URL 变化会触发获取，无需再额外 watcher 调用 refresh。

### Q3. Nitro 函数缓存体现在哪里？

`readPhase10Product` 由 defineCachedFunction 包装，按商品 ID 保存函数结果。每次 API 都可能收到 GET，但缓存有效时不再次运行内部的数据源读取函数，表现为 API 日志增加、SOURCE 日志不增加。

maxAge:60 只规定有效期，写入数据源不会自动使该缓存项失效。swr:false 使过期后的读取等待新结果，暂不引入后台更新时序。

### Q4. 改价成功后如何主动失效？

把 POST handler 改为 async，更新数据源后删除对应项。保留原来的 import：

```ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (id !== 'a' && id !== 'b') {
    throw createError({ statusCode: 404 })
  }

  setHeader(event, 'Cache-Control', 'no-store')
  phase10Catalog[id].price += 10
  phase10Catalog[id].revision += 1

  await useStorage('cache').removeItem(
    `phase10:product:${id}.json`,
  )

  console.log('[phase10 WRITE] 改价并失效缓存', id)
  return { ...phase10Catalog[id] }
})
```

存储 key 对应 group=phase10、name=product、getKey(id)=a/b。本例 ID 仅字母，避免规范化带来的额外差异。生产项目应统一管理 key 生成与失效逻辑。

### Q5. 四个 key / 状态边界有何区别？

| 对象 | 本题作用 | 更新方式 |
| --- | --- | --- |
| 页面 key phase10-product | 控制实例复用 | 本题保持固定 |
| 路由参数 a / b | 决定查看哪个商品 | 导航、前进后退 |
| Nuxt 异步数据标识 | 管理结果、状态与水合复用 | 响应式 URL、refresh |
| Nitro 函数缓存项 | 按商品 ID 保存公共商品函数结果 | 60 秒过期，或写入后主动删除 |

## 常见误区与参考

- `computed(() => id)` 仍读取旧字符串；必须在 computed 内访问当前路由。
- 只在 onMounted 请求：复用时 mounted 不再执行。
- 删除固定页面 key：不满足保留实例和偏好的要求。
- clearNuxtData 不删除 Nitro storage 的函数缓存。
- no-store 约束 HTTP 响应存储，不关闭代码中的函数缓存。
- 重启后价格恢复不证明正确失效：模拟数据源也重置，开发缓存还可能落在文件存储中。
- 公共商品缓存不能直接套到订单或用户资料；用户身份隔离需另行设计。

本题使用 Nuxt 3 与 Nitro 2 的 defineCachedFunction、useStorage。可用 `yarn why nitropack` 查看版本。最新 Nitro 文档包含 Nitro 3 行为与导入方式，本题应参考 v2 文档。

参考文档：

- [Nuxt 3 页面 key](https://nuxt.com/docs/3.x/api/utils/define-page-meta#key)
- [Vue Router：响应参数变化](https://router.vuejs.org/guide/essentials/dynamic-matching.html#reacting-to-params-changes)
- [Nuxt 3 响应式 useFetch URL](https://nuxt.com/docs/3.x/api/composables/use-fetch#reactive-keys-and-shared-state)
- [Nitro 2 函数缓存与失效](https://v2.nitro.build/guide/cache)
