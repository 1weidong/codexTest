# 第 3 期｜useAsyncData：两个店铺的统计为什么串在一起？

日期：2026 年 10 月 19 日。主题：useAsyncData。难度：基础进阶。预计耗时：35–45 分钟。

## 场景与目标

店铺管理后台同时展示 A、B 两家店铺的订单统计。两个请求传入不同的 `storeId`，接口单独访问正常，但页面中的两份统计可能显示成同一家店铺；刷新其中一份时，另一份也跟着变化。

本期练习 key 的设计、共享状态，以及服务端数据在水合时的复用。继续保留 SSR，查明“请求参数不同，为什么页面数据仍然互相影响”。

## 复现代码

使用 Nuxt 3 + TypeScript，沿用根目录 `pages/` 的常规结构。`app.vue` 保持：

```vue
<template>
  <NuxtPage />
</template>
```

确保 `/practice/store-summary` 使用 SSR，未被现有 CSR 路由规则覆盖。可在 `nuxt.config.ts` 的现有配置中合并：

```ts
export default defineNuxtConfig({
  ssr: true,
  routeRules: {
    '/practice/store-summary': { ssr: true },
  },
})
```

### 模拟接口

创建 `server/api/practice/store-summary.get.ts`：

```ts
export default defineEventHandler(async (event) => {
  const storeId = String(getQuery(event).storeId ?? '')

  if (storeId !== 'shop-a' && storeId !== 'shop-b') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid storeId',
    })
  }

  console.log('[summary API]', storeId)

  await new Promise(resolve => setTimeout(resolve, 300))

  const summaries = {
    'shop-a': { orderCount: 3, profit: 120 },
    'shop-b': { orderCount: 9, profit: 450 },
  }

  return {
    storeId,
    ...summaries[storeId],
    sampledAt: Date.now(),
  }
})
```

`sampledAt` 是本次结果生成时间，用于观察刷新是否影响另一家店铺。它随接口返回结果一起传给浏览器，不是在浏览器模板中重新调用 `Date.now()`。

### 故障页面

创建 `pages/practice/store-summary.vue`：

```vue
<script setup lang="ts">
type Summary = {
  storeId: string
  orderCount: number
  profit: number
  sampledAt: number
}

const {
  data: summaryA,
  status: statusA,
  error: errorA,
  refresh: refreshA,
} = await useAsyncData<Summary>(
  'store-summary',
  () => $fetch('/api/practice/store-summary', {
    query: { storeId: 'shop-a' },
  }),
)

const {
  data: summaryB,
  status: statusB,
  error: errorB,
  refresh: refreshB,
} = await useAsyncData<Summary>(
  'store-summary',
  () => $fetch('/api/practice/store-summary', {
    query: { storeId: 'shop-b' },
  }),
)
</script>

<template>
  <main>
    <h1>店铺经营统计</h1>

    <section>
      <h2>店铺 A</h2>
      <p v-if="errorA">统计加载失败</p>
      <pre v-else>{{ summaryA }}</pre>
      <button
        :disabled="statusA === 'pending'"
        @click="refreshA()"
      >
        刷新 A
      </button>
    </section>

    <section>
      <h2>店铺 B</h2>
      <p v-if="errorB">统计加载失败</p>
      <pre v-else>{{ summaryB }}</pre>
      <button
        :disabled="statusB === 'pending'"
        @click="refreshB()"
      >
        刷新 B
      </button>
    </section>
  </main>
</template>
```

运行 `yarn dev`，直接打开 `/practice/store-summary`。为验证站内导航，在 `pages/index.vue` 的模板中添加：

```vue
<NuxtLink to="/practice/store-summary" :prefetch="false">
  进入店铺统计练习
</NuxtLink>
```

## 实现与排查任务

1. 分别访问 `/api/practice/store-summary?storeId=shop-a` 和 `/api/practice/store-summary?storeId=shop-b`，确认接口返回不同店铺的数据。
2. 记录页面初次加载、刷新 A、刷新 B 后，两份数据的变化。
3. 修复数据串用，让两家店铺各自拥有正确的数据、错误和加载状态。
4. 保留 SSR，确认浏览器初次水合时不为相同初始数据再请求一遍。
5. 解释 `useAsyncData` key 与请求参数的区别，以及它与模板 `:key` 的区别。
6. 选做：统计区分“近 7 天”和“近 30 天”时，key 应如何设计？

本题不通过 `server: false`、`onMounted` 或随机 key 绕开问题。

## 验证方法与成功标准

同时观察页面、Network 和 Nuxt 终端。故障版本的覆盖顺序、请求次数与警告可能随 Nuxt 小版本变化，不要求固定表现为“总是 A 覆盖 B”。

| 操作 | 修复后的成功标准 |
| --- | --- |
| 直接刷新页面 | A 为 3 单、利润 120；B 为 9 单、利润 450 |
| 查看 Document 的 Response | 服务端输出的两份统计分别正确 |
| 初次水合完成，不点击按钮 | 浏览器没有额外发起该统计接口的 Fetch/XHR 请求 |
| 点击“刷新 A” | 只请求 `shop-a`；A 的 `sampledAt` 更新，B 保持不变 |
| 点击“刷新 B” | 只请求 `shop-b`；B 的 `sampledAt` 更新，A 保持不变 |
| 从首页站内进入 | 两份统计依然各自正确 |
| 检查控制台 | 没有与本例 key 冲突或水合不匹配相关的新警告 |

- 初始 HTML 以 Network → Document → Response 为准，不能只看可能已更新的 Elements。
- 服务端请求接口通常不会作为浏览器的 Fetch/XHR 请求显示。初次 SSR 还要结合终端的 `[summary API]` 日志判断，不能看到 Network 没有接口就认为没有获取数据。
- 测试水合重复请求时，先打开开发者工具再直接刷新，不进行按钮操作，避免混入站内导航、手动刷新或热更新触发的请求。
- 页面复用了错误数据但两端恰好一致时，也可能没有水合警告；没有警告不能代替对店铺数据正确性的检查。

## 参考答案

### Q1. 两个接口分别应返回什么？

| 请求参数 | 返回的 `storeId` | `orderCount` | `profit` |
| --- | --- | --- | --- |
| `storeId=shop-a` | `shop-a` | 3 | 120 |
| `storeId=shop-b` | `shop-b` | 9 | 450 |

`sampledAt` 根据请求执行时刻生成，没有固定值。非法店铺 ID 返回 HTTP 400。

### Q2. 为什么两个请求参数不同，页面数据仍会互相影响？

两次 `useAsyncData` 都显式使用同一个 key：`store-summary`。

对于 `useAsyncData`，相同 key 表示共享同一份异步数据状态，包括 `data`、`error`、`status` 等。请求参数不同，不会自动拆分这个显式指定的相同 key；把返回值分别命名为 `summaryA` 和 `summaryB` 也不会创建独立状态。

同 key 的 handler 及相关数据处理选项应保持一致。本例却让同一个 key 对应两家不同店铺的数据，破坏了数据身份的定义。覆盖结果和警告因版本、执行时机而异，不应依赖哪次请求“最后赢”。

### Q3. 怎样修复并让状态独立？

最小修改是分别更改两个 key，模板与模拟接口保持不变。将页面的两个请求改为：

```ts
// A
const {
  data: summaryA,
  status: statusA,
  error: errorA,
  refresh: refreshA,
} = await useAsyncData<Summary>(
  'store-summary:shop-a',
  () => $fetch('/api/practice/store-summary', {
    query: { storeId: 'shop-a' },
  }),
)

// B
const {
  data: summaryB,
  status: statusB,
  error: errorB,
  refresh: refreshB,
} = await useAsyncData<Summary>(
  'store-summary:shop-b',
  () => $fetch('/api/practice/store-summary', {
    query: { storeId: 'shop-b' },
  }),
)
```

保留页面原有的 `Summary` 类型声明。现在两家店铺分别拥有各自的异步数据状态，刷新 A 不应更新 B 的数据与状态，反之亦然。

相同业务数据需要共享时，可以有意使用同 key；本例修复的不是“所有调用都必须唯一”，而是“不同业务数据不能误用同一身份”。

### Q4. 为什么要保留稳定的 key？

服务端获取结果后，Nuxt 按 key 将结果加入 payload 并交给浏览器。浏览器初次水合时，使用相同 key 查找对应数据；本例 handler 返回有效对象、配置保持默认且 key 一致时，不需要为了相同初始数据再请求一次。

key 应同时满足：不同数据可以区分；同一份数据在服务端与浏览器之间保持一致。

不要使用随机 key 来避免碰撞，例如：

```ts
// 错误方向：两端可能生成不同 key
useAsyncData(`store-summary:${Math.random()}`, handler)
```

这样虽然可能让两个调用不再撞名，却破坏了两端匹配数据所需的稳定标识。也不要随意把当前时间加入 key；接口返回结果中的 `sampledAt` 与 key 是不同概念。

handler 必须实际返回结果，不能在里面只赋值或只 `await` 请求却漏掉 `return`。否则服务端虽然可能调用了接口，Nuxt 却没有有效结果可供浏览器复用。

### Q5. 请求参数、useAsyncData key 与模板 :key 有什么区别？

| 内容 | 作用 |
| --- | --- |
| 请求参数 `storeId` | 告诉接口查询哪家店铺 |
| `useAsyncData` key | 告诉 Nuxt 异步数据的身份，以及哪些调用共享状态 |
| 模板 `:key` | 帮助 Vue 识别、复用或替换组件和列表节点 |

给两个 `section` 添加不同的 `:key`，不会修改它们内部 `useAsyncData` 的共享关系。`useAsyncData` key 也不是自动追加给接口的请求参数，两者需要分别设置。

### Q6. 加入统计时间范围后，key 怎样设计？

如果结果取决于店铺和时间范围，key 应包含这两个维度，例如：

```ts
const storeId = 'shop-a'
const days = 7

const { data } = await useAsyncData<Summary>(
  `store-summary:${storeId}:${days}d`,
  () => $fetch('/api/practice/store-summary', {
    query: { storeId, days },
  }),
)
```

对应的数据身份可以是：

| 数据 | key |
| --- | --- |
| 店铺 A 近 7 天统计 | `store-summary:shop-a:7d` |
| 店铺 A 近 30 天统计 | `store-summary:shop-a:30d` |
| 店铺 B 近 7 天统计 | `store-summary:shop-b:7d` |

这里展示 key 设计，原模拟接口尚未实现 `days` 筛选，需扩展接口才能验证不同时间范围的数据。示例变量是固定值；若以后做响应式筛选，还要同步处理 key 与请求参数的变化，不能只修改参数而忽略数据身份。

## 常见误区与参考

- 请求参数不同，不代表显式指定的相同 `useAsyncData` key 会自动分离。
- 返回值变量名不同，不代表状态独立。
- 相同 key 的共享是功能，不应一律视为错误；关键是它们是否代表相同业务数据。
- key 正确不等于永久缓存。水合复用、并发请求去重、再次进入页面是否请求，是不同问题。
- 没有水合警告不代表统计没有串用，必须核对 `storeId` 和业务数值。

以上使用 Nuxt 3 常规 API 和目录结构，不依赖 Nuxt 4 的数据层默认设置。不同 Nuxt 小版本的警告、去重和覆盖细节可能不同，不能将故障版本的某个请求顺序当作稳定约定。

参考文档：

- [Nuxt 3 useAsyncData](https://nuxt.com/docs/3.x/api/composables/use-async-data)
- [Nuxt 3 数据获取](https://nuxt.com/docs/3.x/getting-started/data-fetching)
- [Vue：维护列表状态与 key](https://vuejs.org/guide/essentials/list.html#maintaining-state-with-key)
