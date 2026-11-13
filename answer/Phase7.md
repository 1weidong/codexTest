# 第 7 期｜SSR/CSR：登录后进入订单页正常，为什么刷新却提示未登录？

日期：2026 年 11 月 2 日。主题：SSR/CSR 请求上下文与 Cookie。第二轮第 1 期。难度：中级。预计耗时：45–60 分钟。

## 场景与目标

商城用 HttpOnly Cookie 保存登录凭证。点击模拟登录后，站内进入订单页正常；刷新却提示 401。Cookie 仍存在，同一浏览器直接访问接口也能获得数据。

目标：找出浏览器请求与 SSR 内部请求链路的差异，保留订单页 SSR，让直接刷新和站内导航都能读取登录态。初次水合复用数据，未登录时仍正确拒绝。

## 复现代码

使用普通 Nuxt 3 + TypeScript 项目，无需认证模块。app.vue：

```vue
<template>
  <NuxtPage />
</template>
```

两个页面保持默认 SSR，不配置 ssr:false、预渲染或页面缓存。沿用旧练习时先修复故障插件。以下固定 Cookie 仅模拟登录，不是生产认证方案。

### 模拟会话接口

创建 `server/api/phase7/session.post.ts`：

```ts
export default defineEventHandler(async (event) => {
  const body = await readBody<{ loggedIn: boolean }>(event)

  if (body.loggedIn === true) {
    setCookie(event, 'phase7-session', 'demo-user', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    })
  } else {
    deleteCookie(event, 'phase7-session', { path: '/' })
  }

  return { ok: true }
})
```

### 模拟订单接口

创建 `server/api/phase7/orders.get.ts`：

```ts
export default defineEventHandler((event) => {
  const authenticated =
    getCookie(event, 'phase7-session') === 'demo-user'

  console.log('[phase7 orders]', { authenticated })

  if (!authenticated) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  return {
    user: 'demo-user',
    orders: [
      { id: 'ORDER-701', product: '校园卫衣' },
      { id: 'ORDER-702', product: '运动背包' },
    ],
  }
})
```

### 登录页面

创建 `pages/practice/phase7-login.vue`：

```vue
<script setup lang="ts">
const router = useRouter()
const busy = ref(false)
const message = ref('')

async function changeSession(loggedIn: boolean) {
  busy.value = true
  message.value = ''

  try {
    await $fetch('/api/phase7/session', {
      method: 'POST',
      body: { loggedIn },
    })

    // 身份改变后清理本练习之前的数据和错误。
    clearNuxtData('phase7-orders')

    if (loggedIn) {
      await router.push('/practice/phase7-orders')
    } else {
      message.value = '已退出，可再次验证未登录访问'
    }
  } catch {
    message.value = '操作失败，请检查网络请求'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main>
    <h1>模拟登录</h1>

    <button :disabled="busy" @click="changeSession(true)">
      登录并进入订单页
    </button>
    <button :disabled="busy" @click="changeSession(false)">
      退出登录
    </button>

    <p>{{ message }}</p>

    <NuxtLink to="/practice/phase7-orders" :prefetch="false">
      直接进入订单页
    </NuxtLink>
  </main>
</template>
```

### 故障订单页

创建 `pages/practice/phase7-orders.vue`：

```vue
<script setup lang="ts">
type OrdersResponse = {
  user: string
  orders: { id: string; product: string }[]
}

const { data, error, status, refresh } = await useAsyncData(
  'phase7-orders',
  () => $fetch<OrdersResponse>('/api/phase7/orders'),
)
</script>

<template>
  <main>
    <h1>我的订单</h1>

    <p v-if="status === 'pending'">加载中……</p>
    <p v-else-if="error">
      订单读取失败：{{ error.statusCode }}
    </p>

    <template v-else-if="data">
      <p>当前用户：{{ data.user }}</p>
      <ul>
        <li v-for="order in data.orders" :key="order.id">
          {{ order.id }} — {{ order.product }}
        </li>
      </ul>
    </template>

    <button
      :disabled="status === 'pending'"
      @click="refresh()"
    >
      重新读取
    </button>

    <NuxtLink to="/practice/phase7-login" :prefetch="false">
      返回登录页
    </NuxtLink>
  </main>
</template>
```

### 复现步骤

运行 yarn dev，从 /practice/phase7-login 开始：

1. 点击登录并进入订单页，确认有两条订单。
2. 查看登录 POST 响应和 Cookie 面板，确认 Cookie 已写入。
3. 刷新订单页，对比页面错误与终端 authenticated 日志。
4. 同一浏览器另开标签访问 /api/phase7/orders。
5. 回到失败页面，点击重新读取。

## 实现与排查任务

1. 复现站内进入成功、直接刷新失败。
2. 判断 Cookie 没保存，还是后续 SSR 请求没转发。
3. 解释刷新失败后点击重新读取为何又可能成功。
4. 修复获取方式：登录后首屏 HTML 已有订单；初次水合不重复请求；未登录接口仍为 401。
5. 解释 useAsyncData 支持 SSR，为何仍有该问题。
6. 解释 credentials:include 为什么不能自动修复服务端转发。

不使用 ClientOnly、server:false 或关闭页面 SSR 完成本题。

## 验证步骤与成功标准

### 故障证据

| 操作 | 故障版本预期 |
| --- | --- |
| 登录并站内进入订单页 | 两条订单正常，浏览器请求成功 |
| 检查登录响应与 Cookie | Cookie 存在，路径为 / |
| 刷新订单页 | 显示 401，终端 authenticated:false |
| 同一浏览器直接访问订单 API | 返回 JSON，终端 authenticated:true |
| 点击重新读取 | 浏览器请求后恢复订单 |

HttpOnly Cookie 通过开发工具查看。document.cookie 读不到它是预期行为。

### 修复后验证

修复后重新登录：

| 操作 | 成功标准 |
| --- | --- |
| 登录后站内进入 | 正常显示订单 |
| 直接刷新订单页 | 仍显示订单，终端 authenticated:true |
| 查看 Document Response | HTML 的订单列表已有 ORDER-701 |
| 等待水合，不额外操作 | 浏览器没有额外订单 Fetch/XHR |
| 点击重新读取 | 浏览器新增一次请求并成功 |
| 返回登录页，退出，再进入 | 显示 401，不展示旧订单 |
| 退出后直接刷新 | 仍无订单，接口鉴权生效 |

SSR 内部接口调用通常不会单独出现在浏览器 Network，应结合终端判断。

页面捕获 error 后渲染错误文本，因此 API 401 不代表页面 Document 必然也返回 401。没有水合警告不等于登录态转发正确。

## 参考答案

### Q1. 根因是什么？

刷新时多了一段 SSR 内部请求：

| 链路 | 故障版本的 Cookie 行为 |
| --- | --- |
| 浏览器 → 同源订单 API | 浏览器自动发送符合条件的 Cookie |
| 浏览器 → 页面 Document | 同样携带 Cookie |
| SSR 页面代码 → 内部订单 API | 普通 $fetch 默认不继续转发入站请求的 Cookie |

Cookie 到达页面请求，不代表自动进入 SSR 发起的下一次 API 调用。

### Q2. 最小修复是什么？

保留类型与模板，替换数据获取：

```ts
const requestFetch = useRequestFetch()

const { data, error, status, refresh } = await useAsyncData(
  'phase7-orders',
  () => requestFetch<OrdersResponse>('/api/phase7/orders'),
)
```

在 setup 中先取得 requestFetch，再让异步处理函数使用它。SSR 时它关联当前请求上下文，转发适合转发的请求头，包括本题 Cookie；浏览器中则表现为普通 $fetch。

仅向本题可信内部接口转发所需上下文；不要把用户请求头任意传给第三方地址。

### Q3. 能否使用 useFetch？

可以，用下面的调用替换整个获取部分：

```ts
const { data, error, status, refresh } =
  await useFetch<OrdersResponse>('/api/phase7/orders', {
    key: 'phase7-orders',
  })
```

这里使用 Nuxt 自动导入的 useFetch 与内部相对路径，SSR 会使用 useRequestFetch。保留显式 key，使登录页的 clearNuxtData 仍指向同一份数据。

### Q4. useAsyncData 为什么没自动解决？

两个工具职责不同：

- useAsyncData 管理异步数据、状态、错误及 SSR 结果传递。
- useRequestFetch 让服务端请求带上当前请求所需的上下文。

useAsyncData 不会把任意 handler 内的 $fetch 自动改造成带身份转发的请求。

### Q5. 为什么点击重新读取会成功？

点击发生在浏览器中，同源 API 请求可以由浏览器附带 Cookie。它与首次刷新时的 SSR 内部请求是两条不同的执行路径。

### Q6. credentials:include 是什么意思，为什么不能修复 SSR 转发？

Fetch 的 credentials 选项控制请求使用凭证的方式：

| 值 | 浏览器中的主要含义 |
| --- | --- |
| omit | 不携带凭证 |
| same-origin | 默认：同源请求携带符合条件的凭证 |
| include | 跨源请求也允许携带符合条件的凭证 |

Cookie 是否发送仍受域、路径、Secure、SameSite 及浏览器策略约束；跨源请求还涉及服务端 CORS 配置。include 不是让所有 Cookie 发往所有地址。

本题 API 同源，默认行为已经可以发送 Cookie。服务端没有浏览器的 Cookie 存储，设置 include 不能代替读取并转发当前入站请求的 Cookie。因此 SSR 应使用 useRequestFetch，或明确传递必要请求头。

### Q7. clearNuxtData 在这里做什么？

登录身份变化后清理旧异步数据与错误，使后续访问重新获取。本题真正修复刷新的是请求上下文转发，清理 key 不会代替它。

key 也不是权限控制。接口仍须检查凭证，不能仅依据 Pinia 中 loggedIn 的布尔值。

## 常见误区与参考

- HttpOnly 只限制浏览器 JavaScript 读取，不阻止浏览器发送或服务端读取 Cookie。
- 加 credentials:include 不会让服务端凭空拥有浏览器 Cookie。
- 普通 $fetch 的 SSR 内部请求不会自动继承所有用户请求头。
- useAsyncData 支持 SSR，不代表它自动处理任意 handler 的身份转发。
- 站内导航在浏览器执行，不等于路由配置了 ssr:false。
- 无水合警告不代表认证链路正确。
- 本题模拟凭证不是生产会话；实际项目仍需服务端认证与权限验证。

本题使用 Nuxt 3 已有 API，根目录 pages/、server/api/，不依赖 Nuxt 4 默认目录结构。

参考文档：

- [Nuxt 3 useRequestFetch](https://nuxt.com/docs/3.x/api/composables/use-request-fetch)
- [Nuxt 3 $fetch 与 Cookie 转发](https://nuxt.com/docs/3.x/api/utils/dollarfetch)
- [Nuxt 3 useAsyncData](https://nuxt.com/docs/3.x/api/composables/use-async-data)
- [Nuxt 3 clearNuxtData](https://nuxt.com/docs/3.x/api/utils/clear-nuxt-data)
- [Fetch credentials](https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials)
