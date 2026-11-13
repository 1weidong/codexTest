# 第 9 期｜useAsyncData：refresh() 执行了，为什么商品价格还是旧的？

日期：2026 年 11 月 9 日。主题：useAsyncData 与浏览器 HTTP 缓存。第二轮第 3 期。难度：中级。预计耗时：50–65 分钟。

## 场景与目标

商品后台已经改价，用户点击“刷新价格”，却仍看到旧价格：handler 确实执行，Network 也有请求记录，服务端却没有新增商品 GET 日志；整页刷新反而显示新价格。

本期目标是区分 Nuxt 数据复用与浏览器 HTTP 缓存，用证据定位缓存层，并实现主动刷新时验证价格是否变化；未变化时通过 304 节省响应体。服务端响应缓存留到后续练习。

## 复现代码

使用普通 Nuxt 3 + TypeScript 项目，`app.vue` 为 `<NuxtPage />`。本题不启用页面预渲染、SWR、Nitro 缓存、Service Worker 或代理缓存。

### 模拟数据源

创建 `server/utils/phase9Product.ts`：

```ts
// 模拟公共商品数据库：单进程共享，重启后重置。
// 这是数据源，不是响应缓存；不用于保存用户请求状态。
export const phase9Product = {
  id: 'P-901',
  name: '校园卫衣',
  price: 199,
  revision: 1,
}
```

### 故障 GET 缓存策略

创建 `server/api/phase9/product.get.ts`：

```ts
import { phase9Product } from '../../utils/phase9Product'

export default defineEventHandler((event) => {
  const etag = `W/"p901-${phase9Product.revision}"`
  const validator = getHeader(event, 'if-none-match')

  setHeader(event, 'Cache-Control', 'private, max-age=300')
  setHeader(event, 'ETag', etag)

  // 教学示例：匹配本例产生的单个 ETag。
  if (validator === etag) {
    console.log('[phase9 GET] 304', etag)
    return sendNoContent(event, 304)
  }

  console.log('[phase9 GET] 200', etag)
  return { ...phase9Product }
})
```

### 改价接口

创建 `server/api/phase9/reprice.post.ts`：

```ts
import { phase9Product } from '../../utils/phase9Product'

export default defineEventHandler((event) => {
  setHeader(event, 'Cache-Control', 'no-store')

  phase9Product.price += 10
  phase9Product.revision += 1

  console.log('[phase9 POST] 改价', phase9Product.revision)
  return { ...phase9Product }
})
```

改价与读取特意使用不同 URL，模拟后台独立改价，不依赖同一 URL 的写请求触发 HTTP 缓存失效。

### 故障页面

创建 `pages/practice/phase9-product.vue`：

```vue
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
```

### 站内入口

创建 `pages/practice/phase9-entry.vue`：

```vue
<template>
  <NuxtLink to="/practice/phase9-product" :prefetch="false">
    进入商品价格练习
  </NuxtLink>
</template>
```

接口仅用于本地练习。数据在服务端重启或部分热更新后可能重置，以实际版本号为准。

### 复现步骤：顺序很重要

运行 `yarn dev`，打开 Chrome DevTools：

1. 取消勾选 Network → Disable cache。
2. 清理本练习此前的浏览器缓存；没有旧记录时可跳过。
3. 直接打开 `/practice/phase9-product`，观察首屏与终端日志。
4. 点击一次“刷新价格”，让浏览器实际取得并缓存商品 GET 响应。
5. 点击“模拟后台加价 10 元”，确认 POST 返回更高版本。
6. 在首次浏览器 GET 后五分钟内，再点击“刷新价格”。

第 4 步不能省略：SSR 内部请求的数据进入 Nuxt payload，不等于浏览器已缓存该 API 的 HTTP 响应。

## 实现与排查任务

1. 用 handler 日志、Network 缓存来源与 API 日志证明旧数据来自哪一层。
2. 解释为什么 `refresh()` 执行不代表取得服务端的新响应。
3. 保留 `useAsyncData` 与固定 key，修复价格刷新策略。
4. 保留浏览器存储响应的能力，但要求复用前向服务端验证。
5. 验证数据变化时返回 200 和新数据，未变化时发送条件请求并返回 304。
6. 对比直接刷新与从入口页站内进入，不假设二者必定走同一请求链路。

不使用随机 key、时间戳 query、关闭 SSR 或整页刷新作为业务修复。

## 验证步骤与成功标准

### 故障证据

| 检查项 | 预期现象 |
| --- | --- |
| 初次 SSR 后水合 | 浏览器通常没有额外商品 GET；终端有 API 日志 |
| 第一次点击刷新 | 浏览器 GET 到达服务端，响应带 max-age=300 |
| 后台改价后的刷新 | handler 再执行，但前台可能仍是旧版本 |
| Network Size / Transferred | 出现 memory cache 或 disk cache 等缓存来源 |
| 终端商品 GET 日志 | 缓存命中时不增加 |
| 整页刷新 | SSR 重新读取数据源，显示新版本 |

Network 缓存条目可能仍标为 200。有请求行、状态是 200，不能证明请求到达服务端。

若未复现，检查 Disable cache、五分钟是否已过、请求是否带强制重新验证指令、接口响应头是否被其他配置覆盖。

### 修复后验证

修改策略后先清除旧 HTTP 缓存。已存入浏览器的五分钟新鲜响应，不会立即知道服务器换了策略。

| 操作 | 成功标准 |
| --- | --- |
| 直接打开商品页 | 原始 HTML 已有价格，水合无新增警告 |
| 首次点击刷新 | 浏览器取得响应，确认新 Cache-Control |
| 不改价，再刷新 | 携带 If-None-Match；终端记录 304 |
| 后台改价，再刷新 | 旧 ETag 与当前版本不符；终端记录 200，前台更新 |
| 更新后再次刷新 | 再次验证，未变化时返回 304 |
| 通过 NuxtLink 进入 | 商品正常显示，结合日志判断获取路径 |
| 完成初次 SSR 水合 | 不因本题代码重复请求商品 |

浏览器将有效的 304 与已有响应体结合使用，页面仍获得商品对象。304 没有新响应体，不代表页面数据应变成空。

## 参考答案

### Q1. 旧数据来自哪一层？

本题旧数据来自浏览器 HTTP 缓存。原策略 `private, max-age=300` 允许浏览器在新鲜期内复用响应而不联系服务端。handler 执行、Network 出现记录、源站收到请求，需要分别验证。

### Q2. 为什么 refresh() 不能保证最新？

`refresh()` 重新执行获取逻辑，但底层浏览器 `$fetch` 仍受 HTTP 缓存规则约束。Nuxt 的数据状态更新与浏览器如何取得 HTTP 响应是两个边界。

### Q3. 最小修复是什么？

只修改 GET 的缓存策略，保留 ETag 与条件请求处理：

```ts
setHeader(event, 'Cache-Control', 'private, no-cache')
```

`no-cache` 允许存储，但要求复用前成功验证，不等于 `no-store`。`private` 限制共享缓存存储，`max-age` 控制新鲜期。

流程：点击 refresh → handler 执行 → 浏览器携带已有 ETag 请求 API → 服务端检查当前版本 → 未变化返回 304，变化返回 200 与新商品。

本例 `sendNoContent(event, 304)` 发送无响应体的 304。生产实现还需按 HTTP 规则处理 ETag 列表、弱比较等；本题只匹配自身生成的单个验证器。

### Q4. 各层保存什么，怎样失效？

| 层 | 保存内容与识别方式 | 本题更新或失效方式 |
| --- | --- | --- |
| Nuxt 异步数据 | phase9-product 对应的数据、状态与错误 | refresh 重新获取；clearNuxtData 清理对应数据 |
| SSR payload | 当前 SSR 得到的商品数据 | 用于本次水合复用，不是永久服务端缓存 |
| 浏览器 HTTP 缓存 | 商品 GET 响应；本题主要按方法和 URL 区分 | 原策略五分钟内直接复用，修复后复用前验证 |
| 模拟数据源 | 公共商品价格与 revision | POST 修改，重启重置 |
| Nitro 响应缓存 | 本题未启用 | 没有这一层缓存命中 |

SSR 数据传递避免水合重复获取，与浏览器缓存完整 HTTP 响应是两件事。

### Q5. 请求级策略可以怎样设置？

如果只有某次操作要求重新验证，可以在浏览器请求中使用：

```ts
return $fetch<Product>('/api/phase9/product', {
  cache: 'no-cache',
})
```

这表达客户端本次请求的缓存要求。本题优先修改响应策略，让接口的新鲜度约定明确；它仍不能代替服务端缓存失效。

### Q6. Disable cache、普通刷新与强刷有什么区别？

- Disable cache 用于排除浏览器 HTTP 缓存影响。
- 普通刷新重新加载页面，缓存使用仍受浏览器与请求指令影响。
- 强制刷新用于绕过浏览器缓存做对照，不会清除 Nitro、Redis 或 CDN 缓存。Chrome 另有“清空缓存并强制刷新”。

## 常见误区与参考

- 随机换 key：可能重跑 handler，但相同 API URL 仍可能命中 HTTP 缓存。
- 只用 clearNuxtData：不会清除浏览器 HTTP 缓存。
- 只加 must-revalidate：主要约束过期后的复用，不取消仍有效的 max-age 新鲜期。
- 改了响应头却不清旧缓存：浏览器可能尚未访问服务器，仍按旧策略使用响应。
- 直接把 POST 返回值赋给页面：只更新当前界面，没有验证 GET 缓存策略。
- 强刷成功便断定清了服务端缓存：本题 SSR 路径避开旧 API 浏览器缓存，不是服务端缓存被清除的证据。

本题使用 Nuxt 3 根目录结构、已有 useAsyncData API 与 H3 v1 风格工具，不使用 Nuxt 4 专属选项，也不依赖各小版本的数据保留差异。

参考文档：

- [Nuxt 3 useAsyncData](https://nuxt.com/docs/3.x/api/composables/use-async-data)
- [H3 v1 响应工具](https://v1.h3.dev/utils/response)
- [HTTP 缓存标准 RFC 9111](https://httpwg.org/specs/rfc9111.html)
- [Chrome DevTools Network 缓存检查](https://developer.chrome.com/docs/devtools/network/reference#disable-cache)
