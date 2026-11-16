# 第 12 期｜排错题：Nuxt 插件封装了请求，为什么 404 也显示“成功”？

日期：2026 年 11 月 16 日。第二轮第 6 期。主题：Nuxt 插件机制。题型：排错题。难度：中级进阶。预计耗时：55–75 分钟。

新增工程能力：请求客户端的职责边界、错误传播与运行时类型校验。

## 场景与目标

订单项目通过 Nuxt 插件提供统一的订单 API。页面只调用业务方法，不直接维护接口 URL。封装后发现：

- 接口返回 404，页面的 useAsyncData.status 却是 success。
- 接口返回 200，但金额是字符串，TypeScript 仍认为它是数字。

目标约定：只有通过数据校验的订单才能作为成功结果；HTTP 失败必须继续传播，不能伪造订单对象。本期不重复插件排序问题，不额外加入登录跳转或自动重试。

## 复现代码

使用普通 Nuxt 3 + TypeScript，无需额外模块。app.vue 保持：

```vue
<template>
  <NuxtPage />
</template>
```

不要为本题配置预渲染或服务端缓存。

### 模拟接口

创建 `server/api/phase12/orders/[id].get.ts`：

```ts
export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')

  setHeader(event, 'Cache-Control', 'no-store')
  console.log('[phase12 API]', id)

  if (id === 'ok') {
    return {
      id,
      total: 199,
      status: 'paid',
    }
  }

  if (id === 'broken') {
    // 模拟上游接口契约发生变化。
    return {
      id,
      total: '199',
      status: 'paid',
    }
  }

  throw createError({
    statusCode: 404,
    statusMessage: 'Order Not Found',
  })
})
```

### 服务模块：故障版本

创建 `services/phase12Orders.ts`：

```ts
export type Order = {
  id: string
  total: number
  status: 'paid' | 'shipped'
}

// 服务层只依赖读取 JSON 的能力。
type ReadJson = (path: string) => Promise<unknown>

export function createPhase12OrdersApi(readJson: ReadJson) {
  return {
    async getOrder(id: string): Promise<Order> {
      try {
        const value = await readJson(
          `/orders/${encodeURIComponent(id)}`,
        )

        return value as Order
      } catch {
        console.warn('[phase12 service] 请求失败，使用默认结果')

        return {} as Order
      }
    },
  }
}
```

### 请求插件

创建 `plugins/phase12-api.ts`：

```ts
import { createPhase12OrdersApi } from '~/services/phase12Orders'

export default defineNuxtPlugin(() => {
  const client = $fetch.create({
    baseURL: '/api/phase12',
    retry: 0,

    onResponseError({ response }) {
      console.warn(
        '[phase12 HTTP]',
        import.meta.server ? 'server' : 'client',
        response.status,
      )
    },
  })

  const phase12Orders = createPhase12OrdersApi(
    path => client<unknown>(path),
  )

  return {
    provide: { phase12Orders },
  }
})
```

### 页面

创建 `pages/practice/phase12-orders.vue`：

```vue
<script setup lang="ts">
const route = useRoute()
const { $phase12Orders } = useNuxtApp()

const id = computed(() =>
  typeof route.query.id === 'string' ? route.query.id : 'ok',
)

const { data, error, status, refresh } = await useAsyncData(
  'phase12-order',
  () => $phase12Orders.getOrder(id.value),
  { watch: [id] },
)
</script>

<template>
  <main>
    <h1>订单请求边界</h1>

    <nav>
      <NuxtLink
        v-for="caseId in ['ok', 'missing', 'broken']"
        :key="caseId"
        :to="{
          path: '/practice/phase12-orders',
          query: { id: caseId },
        }"
        :prefetch="false"
      >
        {{ caseId }}
      </NuxtLink>
    </nav>

    <p>当前场景：{{ id }}</p>
    <p>异步状态：{{ status }}</p>

    <p v-if="status === 'pending'">读取中……</p>

    <p v-else-if="error">
      失败：{{ error.statusCode }} — {{ error.message }}
    </p>

    <template v-else-if="data">
      <p>订单：{{ data.id }}</p>
      <p>金额：{{ data.total }}</p>
      <p>金额运行时类型：{{ typeof data.total }}</p>
      <p>订单状态：{{ data.status }}</p>
    </template>

    <button :disabled="status === 'pending'" @click="refresh()">
      重新读取
    </button>
  </main>
</template>
```

### 三层职责

| 层 | 本题职责 |
| --- | --- |
| 插件 | 创建请求客户端、配置公共行为、注入业务 API |
| 服务模块 | 管理订单 URL、类型与数据契约 |
| 页面 | 管理响应式输入、异步状态与显示 |

页面不用复制接口 URL 和订单类型，也不把所有业务判断塞进插件。

### 复现步骤

运行 `yarn dev`，分别直接打开：

```text
http://localhost:3000/practice/phase12-orders?id=ok
http://localhost:3000/practice/phase12-orders?id=missing
http://localhost:3000/practice/phase12-orders?id=broken
```

再通过页面链接逐个切换，每次等待请求结束。对比页面状态、浏览器 Network、浏览器控制台与服务端日志。

## 实现与排查任务

1. 复现 missing 返回 404，但页面显示 success 的问题。
2. 找出异常在哪一层由 rejected Promise 变成 fulfilled Promise。
3. 修复错误传播，保留原有 HTTP 错误信息。
4. 将接口结果视为 unknown，验证后才返回 Order：
   - id 必须对应本次请求。
   - total 必须是非负有限数字。
   - status 必须是允许值。
5. 让 broken 进入明确的错误分支，不能用强制断言通过。
6. 比较抛异常与 Result 联合类型，说明本题的选择。
7. 选做：说明 HTTP 错误日志与数据契约错误日志为什么应区分。

不使用随机 key、关闭 SSR、把错误转换成空订单或设置 ignoreResponseError:true 掩盖问题。

## 验证步骤与成功标准

### 故障证据

| 场景 | API 结果 | 故障页面 |
| --- | --- | --- |
| ok | 200，合法订单 | success，金额类型 number |
| missing | 404 | HTTP 错误日志已打印，页面却是 success |
| broken | 200，金额为字符串 | success，运行时类型 string |

missing 的空对象由服务模块返回，不是 API 返回的订单。

### 修复后验证

| 操作 | 成功标准 |
| --- | --- |
| 直接刷新 ok | HTML 已有订单；完成水合后不重复请求 |
| 站内切换 missing | 浏览器 API 请求为 404；页面进入 error |
| 直接刷新 missing | 服务端记录 404，页面显示错误，不伪造订单 |
| 切换 broken | API 仍是 200，页面因契约校验失败进入 error |
| missing → ok | 恢复正常订单，不残留失败状态 |
| broken → ok | 恢复正常订单，金额类型 number |
| 点击重新读取 | 按钮恢复可用，结果符合当前场景 |
| 检查请求次数 | retry:0，不因自动重试干扰计数 |

SSR 内部 API 请求结合终端判断，浏览器不会把它列为单独发出的 Fetch/XHR。

本题由 useAsyncData 接住异常并渲染页面内错误，API 的 404 不意味着 Document 必然返回 404。

以上是练习的预期验收标准；导出文件不代表已在用户项目中执行验证。

### 缓存与版本边界

| 层 | 本题行为 |
| --- | --- |
| Nuxt 异步数据 | phase12-order 标识当前查看结果及状态 |
| SSR payload | 初始成功结果供浏览器水合复用 |
| 插件 | 提供 API 方法，没有实现结果缓存 |
| 浏览器 HTTP 缓存 | API no-store，本题不安排 304 |
| Nitro 缓存 | 未启用 |

Disable cache 不能修复 catch 返回空对象。普通刷新或强刷会再次运行同一封装；更换 key 不会恢复被吞掉的异常。

本题采用 Nuxt 3 根目录 plugins/、services/、pages/、server/api/，按 Nuxt 3 常见 ofetch 1.x 行为设计，不采用 Nuxt 4 默认目录结构，不要求升级到 ofetch 2。

## 参考答案

### Q1. 完整修复服务模块

替换 `services/phase12Orders.ts`，插件与页面不变：

```ts
import { createError } from '#app'

export type Order = {
  id: string
  total: number
  status: 'paid' | 'shipped'
}

type ReadJson = (path: string) => Promise<unknown>

function parseOrder(value: unknown, expectedId: string): Order {
  if (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    value.id === expectedId &&
    'total' in value &&
    typeof value.total === 'number' &&
    Number.isFinite(value.total) &&
    value.total >= 0 &&
    'status' in value &&
    (value.status === 'paid' || value.status === 'shipped')
  ) {
    return {
      id: value.id,
      total: value.total,
      status: value.status,
    }
  }

  throw createError({
    statusCode: 502,
    message: 'Invalid order payload',
    data: { code: 'INVALID_ORDER_PAYLOAD' },
  })
}

export function createPhase12OrdersApi(readJson: ReadJson) {
  return {
    async getOrder(id: string): Promise<Order> {
      const value = await readJson(
        `/orders/${encodeURIComponent(id)}`,
      )

      return parseOrder(value, id)
    },
  }
}
```

### Q2. 为什么 404 进入 success？

原实现：

```ts
catch {
  return {} as Order
}
```

async 函数正常返回对象，外层 Promise 就成功完成。useAsyncData 收到正常结果，因而进入 success。

修复后没有无意义的 catch，HTTP 异常自然传播给调用者。需要补充日志时，记录后继续 throw 原错误，不要返回假订单。

onResponseError 打印了 HTTP 日志，不代表失败自动变成成功。ofetch 1.x 在默认错误处理路径中仍会抛错；导致本题 success 的是服务模块 catch 的正常返回。

### Q3. 为什么类型断言没有检查金额？

```ts
return value as Order
```

这只是编译阶段的类型断言，不会把字符串 "199" 转成数字，也不会检查字段是否存在。类型断言会在编译后被移除。

修复后只返回通过校验的数据。broken 的 HTTP 响应仍为 200，页面的 502 是服务层生成的数据契约错误，不能说 API 实际返回了 502。

本题选择拒绝错误金额类型。若业务明确允许数字字符串，可在服务边界执行受约束转换，但应写成契约规则，而非依赖隐式转换。

### Q4. 为什么在服务模块验证？

通用请求客户端不知道每种业务响应应具备哪些字段。订单服务知道订单契约，因此在这里校验，再向页面返回可信类型。

该结构便于逐步添加业务 API，而不必让插件成为庞大的业务判断中心。ReadJson 返回 unknown，使外部数据必须经过检查才能获得业务类型。

### Q5. 抛异常与 Result 如何取舍？

| 方案 | 优点 | 代价与适用场景 |
| --- | --- | --- |
| 抛异常 | 可直接接入 useAsyncData.error，页面代码少 | 调用方明确处理异常，适合本题 |
| Result 联合类型 | 成功与失败均由类型显式表达 | 页面必须检查结果分支，适合预期业务失败 |

Result 示例：

```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }
```

若选择 Result，ok:false 仍是正常返回值，useAsyncData.status 可以是 success；页面必须检查 result.ok 区分业务结果。

两种约定都可行，关键在调用链保持一致。本题选抛异常，让请求失败直接进入 Nuxt 错误状态。

### Q6. 改为 Promise.resolve / Promise.reject 可以吗？

讨论中的修改：

```ts
async getOrder(id: string): Promise<Order> {
  try {
    const value = await readJson(
      `/orders/${encodeURIComponent(id)}`,
    )

    return Promise.resolve(value as Order)
  } catch {
    console.warn('[phase12 service] 请求失败，使用默认结果')

    return Promise.reject({} as Order)
  }
}
```

它能让 HTTP 失败继续表现为 rejected Promise，因此修复了“catch 正常返回造成假成功”的一部分问题，但不推荐：

1. async 函数会自动包装返回值，Promise.resolve 多余。
2. Promise.reject({} as Order) 用空对象替换原始错误，丢失 HTTP 状态、错误信息及调用栈。
3. value as Order 仍不校验数据；broken 场景依然会被当作成功。
4. Promise<Order> 只约束成功结果的类型，不约束失败原因类型。把拒绝原因断言为 Order 没有意义，也不会使错误具备订单字段。

若需要服务层日志，结合上面的 parseOrder 使用：

```ts
async getOrder(id: string): Promise<Order> {
  try {
    const value = await readJson(
      `/orders/${encodeURIComponent(id)}`,
    )

    return parseOrder(value, id)
  } catch (error) {
    console.warn('[phase12 service] 读取订单失败')

    throw error
  }
}
```

没有额外日志或错误转换需求时，使用 Q1 的无 try/catch 版本更直接。

| 情况 | 推荐实现的结果 |
| --- | --- |
| HTTP 成功，数据合法 | 返回 Order，Promise 成功 |
| HTTP 404 | 原错误传播，Promise 失败 |
| HTTP 200，数据不合法 | parseOrder 抛错，Promise 失败 |

在 async 函数中，return value 对应成功，throw error 对应失败；显式 return Promise.reject(error) 也能传播失败，但不必为此额外包装。关键是保留原错误并验证成功数据。

## 常见误区与参考

- 返回空对象、null 或 error 当兜底订单，改变了调用契约，调用方可能继续成功逻辑。
- 泛型 Order 或 as Order 提供静态类型，不校验接口实际返回。
- 所有错误都包装成同一个 500，会丢失原 HTTP 状态与错误分类。
- 格式错误的 200 不进入 HTTP 错误钩子，应另做数据契约校验。
- 页面重复维护 URL、类型、校验，容易产生行为分叉。
- 跨 SSR 序列化边界，不应假定自定义错误的 instanceof 身份一定保留；使用明确的可传递状态、错误码。
- 不在通用传输层随意记录完整响应或请求头，以免暴露敏感数据。

参考文档：

- [Nuxt 3 自定义请求客户端](https://nuxt.com/docs/3.x/guide/recipes/custom-usefetch)
- [Nuxt 3 useAsyncData](https://nuxt.com/docs/3.x/api/composables/use-async-data)
- [Nuxt 3 createError](https://nuxt.com/docs/3.x/api/utils/create-error)
- [ofetch 1.x 源码](https://github.com/unjs/ofetch/blob/v1/src/fetch.ts)
- [TypeScript 类型断言](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions)

