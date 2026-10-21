# 第 4 期｜Vue Router：浏览器后退后，筛选框为什么与订单列表不一致？

日期：2026 年 10 月 21 日。主题：Vue Router。难度：基础进阶。预计耗时：40–50 分钟。

## 场景与目标

订单页通过 URL 保存当前店铺、订单状态和页码：

```text
/practice/router-orders?storeId=shop-b&status=all&page=2
```

测试发现：筛选“已发货”后，店铺意外变成 A；浏览器后退后 URL 和列表恢复，但下拉框仍停留在“已发货”；刷新整个页面后，下拉框又正常了。

本期目标是同步 URL、筛选草稿与订单列表，保留其他 query 参数，并正确使用浏览器历史记录。本题使用本地模拟订单，无需创建接口。

## 复现代码

使用 Nuxt 3 + TypeScript，沿用根目录 `pages/` 结构。`app.vue` 保持：

```vue
<template>
  <NuxtPage />
</template>
```

保留练习页的 SSR。可在 `nuxt.config.ts` 的现有配置中合并：

```ts
export default defineNuxtConfig({
  ssr: true,
  routeRules: {
    '/practice/router-orders': { ssr: true },
  },
})
```

### 故障页面

创建 `pages/practice/router-orders.vue`：

```vue
<script setup lang="ts">
type Status = 'pending' | 'shipped'
type FilterStatus = Status | 'all'
type Order = {
  id: string
  storeId: string
  status: Status
}

const route = useRoute()
const router = useRouter()

// query 可能为空、为 null，或因重复参数而成为数组
function firstString(value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? first : ''
}

function parseStatus(value: unknown): FilterStatus {
  const status = firstString(value)
  return status === 'pending' || status === 'shipped' ? status : 'all'
}

const storeId = computed(() =>
  firstString(route.query.storeId) === 'shop-b' ? 'shop-b' : 'shop-a',
)
const urlStatus = computed(() => parseStatus(route.query.status))
const page = computed(() => {
  const value = Number(firstString(route.query.page))
  return Number.isSafeInteger(value) && value >= 1 ? value : 1
})

// 只在 setup 时复制一次
const draftStatus = ref<FilterStatus>(urlStatus.value)

const orders: Order[] = ['shop-a', 'shop-b'].flatMap(store =>
  [1, 2, 3, 4].map((n): Order => ({
    id: `${store}-${n}`,
    storeId: store,
    status: n <= 2 ? 'pending' : 'shipped',
  })),
)

const filtered = computed(() => orders.filter(order =>
  order.storeId === storeId.value
  && (urlStatus.value === 'all' || order.status === urlStatus.value),
))
const totalPages = computed(() => Math.ceil(filtered.value.length / 2))
const visibleOrders = computed(() =>
  filtered.value.slice((page.value - 1) * 2, page.value * 2),
)

async function applyFilter() {
  await router.push({
    path: route.path,
    query: { status: draftStatus.value },
  })
}

async function goPage(target: number) {
  await router.push({
    path: route.path,
    query: { ...route.query, page: String(target) },
    hash: route.hash,
  })
}

console.log('[router-orders setup]',
  import.meta.server ? 'server' : 'client')
</script>

<template>
  <main>
    <h1>订单筛选</h1>
    <p>店铺：{{ storeId }}｜已应用：{{ urlStatus }}｜页码：{{ page }}</p>

    <form @submit.prevent="applyFilter">
      <select v-model="draftStatus" aria-label="订单状态">
        <option value="all">全部</option>
        <option value="pending">待生产</option>
        <option value="shipped">已发货</option>
      </select>
      <button type="submit">应用筛选</button>
    </form>

    <ul>
      <li v-for="order in visibleOrders" :key="order.id">
        {{ order.id }} — {{ order.status }}
      </li>
    </ul>
    <p v-if="visibleOrders.length === 0">暂无订单</p>

    <button :disabled="page <= 1" @click="goPage(page - 1)">
      上一页
    </button>
    <button :disabled="page >= totalPages" @click="goPage(page + 1)">
      下一页
    </button>
  </main>
</template>
```

### 复现步骤

运行 `yarn dev`，直接打开：

```text
http://localhost:3000/practice/router-orders?storeId=shop-b&status=all&page=2
```

1. 下拉框选择“已发货”，点击“应用筛选”。
2. 观察 URL、当前店铺和列表。
3. 点击浏览器后退，观察下拉框与“已应用”状态是否一致。
4. 刷新页面，再对比结果。

可在首页添加以下入口，对比站内导航与直接刷新：

```vue
<NuxtLink
  to="/practice/router-orders?storeId=shop-b&status=all&page=2"
  :prefetch="false"
>
  进入订单路由练习
</NuxtLink>
```

## 实现与排查任务

1. 解释为什么更新状态会丢失 `storeId`。
2. 解释为什么后退后列表正确，下拉框却没有恢复。
3. 修复筛选操作：保留其他现有 query，修改状态时将页码重置为 `1`。
4. 保持“点击应用才生效”：只改下拉框，不立即修改 URL 或列表。
5. 浏览器后退、前进后，下拉框同步恢复为对应 URL 的状态。
6. 解释本题用 `router.push` 还是 `router.replace`，以及选择理由。
7. 选做：非法或重复 query 如何处理？本题的解析函数采用了什么规则？

不通过整页刷新、给页面设置随 query 改变的 key 等强制重建方式解决状态同步。

## 验证步骤与成功标准

| 操作 | 修复后应满足 |
| --- | --- |
| 直接打开初始 URL | 店铺 B、全部状态、第 2 页，显示 `shop-b-3`、`shop-b-4` |
| 选择“待生产”，不点应用 | 下拉框改变，URL 和列表保持原样 |
| 点击应用 | 保留 `storeId=shop-b`，状态为 `pending`，页码为 `1` |
| 查看列表 | 显示 `shop-b-1`、`shop-b-2` |
| 浏览器后退 | 恢复全部状态、第 2 页；下拉框恢复“全部” |
| 浏览器前进 | 恢复待生产、第 1 页；下拉框恢复“待生产” |
| 初始 URL 增加 `source=dashboard` 后再筛选 | `source` 参数仍存在 |
| 直接刷新筛选后的 URL | 表单与列表从 URL 恢复，无新增水合警告 |
| 从首页链接进入 | 与直接打开对应 URL 的店铺、状态、页码及列表一致 |

- 普通 query 切换不应产生整页 Document 重新加载；本例没有业务接口请求，重点检查 URL、界面与历史记录。
- 直接刷新时可查看 Network → Document → Response，确认 SSR 订单与 URL 一致。
- 终端与浏览器的 setup 日志用于辅助判断执行环境；同一路径 query 改变时，正常情况下不应靠重新执行 setup 来恢复表单。
- 每次复测先清空控制台，避免把旧警告当成新警告。

## 参考答案

### Q1. 为什么更新状态会丢失 storeId？

`query: { status: draftStatus.value }` 表达的是目标 URL 的 query，不是只修改一个字段。Router 不会自动合并旧 query，因此原来的 `storeId`、`source` 等参数会被丢弃。缺少 `storeId` 后，演示代码默认按 `shop-a` 显示。

### Q2. 为什么后退后列表正确，下拉框却没有恢复？

```ts
const draftStatus = ref<FilterStatus>(urlStatus.value)
```

这行只复制初始化时的值，不会建立持续跟随 `urlStatus` 的关系。

列表通过 computed 读取路由状态，而下拉框使用独立的本地草稿。同一路径仅修改 query 时，页面通常会被复用；URL 虽然变了，原有 ref 不会重新初始化。整页刷新后重新执行 setup，才暂时让它们再次一致。

### Q3–Q5. 怎样保留 query、重置页码并同步表单？

对故障代码做两处修改，其余类型、数据、computed、分页函数和模板保持不变。

第一处：替换 `applyFilter`，合并旧 query 后再覆盖状态和页码：

```ts
async function applyFilter() {
  await router.push({
    path: route.path,
    query: {
      ...route.query,
      status: draftStatus.value,
      page: '1',
    },
    hash: route.hash,
  })
}
```

展开顺序不能反过来，否则旧 query 可能覆盖新值。重置页码是业务规则：筛选后结果数量减少，原来的第 2 页可能不再有数据。

第二处：在 `draftStatus` 声明后添加单向同步：

```ts
watch(urlStatus, (status) => {
  draftStatus.value = status
})
```

状态流向如下：

- URL → 表单与列表：路由中的已应用状态改变后，更新草稿和列表。
- 表单 → URL：仅在点击“应用”时提交草稿，导航成功后列表按 URL 更新。

不要再增加一个将 `draftStatus` 自动写回 URL 的 watcher，否则会破坏“点击应用才生效”的要求，也可能产生相互触发。

这个最小 watcher 监听的是解析后的状态值。如果业务还要求“只改变页码或店铺，也丢弃未提交草稿”，需要明确扩大同步范围。例如用下面的 watcher 替代上面的 watcher：

```ts
watch(() => route.fullPath, () => {
  draftStatus.value = urlStatus.value
})
```

此时任意 URL 变化都会重置草稿，包括 query 和 hash 改变。是否丢弃草稿属于业务选择；不要为了同步状态而额外导航。此处只监听 `fullPath`，没有把它渲染进模板。

### Q6. 本题选 push 还是 replace？

本题希望用户后退到上一次筛选，因此选择 `router.push`。

| 方法 | 客户端历史行为 | 适合场景 |
| --- | --- | --- |
| `router.push` | 新增历史记录 | 用户主动应用筛选，希望后退恢复 |
| `router.replace` | 替换当前历史记录 | 修正当前 URL 的非法默认值，不希望增加记录 |

两者都会导航；区别在历史记录，而不是是否合并 query、是否同步表单。对完全相同的目标 URL 重复导航，通常不会增加新的记录。

### Q7. 非法或重复 query 怎样处理？

本例采用以下读取规则：

| 输入 | 处理方式 |
| --- | --- |
| 重复 query，如 `status=pending&status=shipped` | 取第一个值 |
| 非法或缺失的状态 | 按 `all` 处理 |
| 非法、非整数、非安全整数或小于 1 的页码 | 按第 1 页处理 |
| 未知或缺失的店铺 | 本地演示按 `shop-a` 处理 |

例如 `page=abc`、`page=-1`、`page=1.5` 会按 1 处理。超过实际总页数但仍合法的正整数，当前实现会显示空列表，并未自动收敛到最后一页。

这些规则只影响读取后的界面状态，不会自动规范化地址栏。如果要修正 URL，可另行使用 `replace`，并避免相同 URL 的重复修正或循环导航。

真实项目也可以选择提示错误。涉及店铺权限时必须由服务端校验，不能把前端默认值当作授权。

### Q8. navigateTo 可以代替 router.replace() 吗？

可以。在 Nuxt 3 的普通客户端站内导航中，`navigateTo` 加上 `{ replace: true }`，对应 `router.replace` 的历史行为；默认不加该选项，对应 `router.push`。

| Vue Router 写法 | Nuxt 写法 | 客户端历史行为 |
| --- | --- | --- |
| `router.push('/orders')` | `navigateTo('/orders')` | 新增记录 |
| `router.replace('/orders')` | `navigateTo('/orders', { replace: true })` | 替换当前记录 |

例如：

```ts
await navigateTo('/account/orders', {
  replace: true,
})
```

修改 query 仍需自己合并现有参数：

```ts
await navigateTo(
  {
    path: route.path,
    query: {
      ...route.query,
      status: draftStatus.value,
      page: '1',
    },
    hash: route.hash,
  },
  { replace: true },
)
```

这段展示的是替换历史记录的写法。本期应用筛选需要保留后退记录，所以可以用默认行为，不加 `replace: true`：

```ts
async function applyFilter() {
  await navigateTo({
    path: route.path,
    query: {
      ...route.query,
      status: draftStatus.value,
      page: '1',
    },
    hash: route.hash,
  })
}
```

Nuxt 推荐使用 `navigateTo` 完成这类导航。它还处理服务端重定向，不只是客户端 Router 方法的别名；不能把客户端历史行为等同于服务端 HTTP 重定向行为。

在事件函数中使用 `await navigateTo(...)`；在路由中间件中重定向时，通常返回其结果：

```ts
// middleware/example.ts
export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/legacy-orders') {
    return navigateTo('/account/orders', { replace: true })
  }
})
```

## 常见误区与参考

- `router.push` 或 `navigateTo` 不自动合并旧 query，需显式保留。
- `ref(computed.value)` 是初始化时复制值，不会持续同步。
- `router.replace` 不会自动修复表单状态，也不是刷新页面。
- 本地草稿与已应用筛选可以不同；点击应用后才提交，是本题的明确需求。
- 导航历史、目标 URL 与本地状态同步，需要分别处理。

以上使用 Nuxt 3 自动导入的 `useRoute`、`useRouter`、`navigateTo` 和 Vue Router 4 已支持的导航方式，无需升级路由库，也未使用 Nuxt 4 专属目录或 API。

参考文档：

- [Nuxt 3 useRouter](https://nuxt.com/docs/3.x/api/composables/use-router)
- [Nuxt 3 navigateTo](https://nuxt.com/docs/3.x/api/utils/navigate-to)
- [Vue Router 组合式 API](https://router.vuejs.org/guide/advanced/composition-api)
- [Vue Router 编程式导航](https://router.vuejs.org/guide/essentials/navigation)
