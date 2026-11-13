# 第 6 期｜Nuxt 插件：TypeScript 不报错，启动时为什么提示 API 不是函数？

日期：2026 年 10 月 28 日。主题：Nuxt 插件初始化与依赖。难度：基础进阶。预计耗时：40–50 分钟。

## 场景与目标

项目通过两个插件初始化店铺：API 插件创建统一请求客户端 $practiceApi；店铺插件调用它读取配置。编辑器能够识别类型，但直接刷新时出现：

```text
nuxtApp.$practiceApi is not a function
```

本题不涉及浏览器 SDK 或 window。目标是区分注入时机与接口失败，通过文件排序与 name/dependsOn 修复依赖，理解普通插件在两端初始化及状态传递。

## 复现代码

使用 Nuxt 3 + TypeScript。app.vue：

```vue
<template>
  <NuxtPage />
</template>
```

以下插件位于 Nuxt 3 根目录 plugins/，不是 server/plugins/。

### 模拟接口

创建 `server/api/practice/shop.get.ts`：

```ts
export default defineEventHandler(() => {
  console.log('[shop API] 请求配置')

  return {
    name: '校园服饰店',
    currency: 'CNY',
  }
})
```

### API 插件

创建 `plugins/02.practice-api.ts`：

```ts
export default defineNuxtPlugin({
  name: 'practice-api',

  setup() {
    console.log(
      '[practice-api]',
      import.meta.server ? 'server' : 'client',
    )

    const practiceApi = $fetch.create({
      baseURL: '/api/practice',
    })

    return {
      provide: { practiceApi },
    }
  },
})
```

### 店铺插件：故障版本

创建 `plugins/01.practice-shop.ts`：

```ts
type Shop = {
  name: string
  currency: string
}

export default defineNuxtPlugin({
  name: 'practice-shop',

  async setup(nuxtApp) {
    console.log(
      '[practice-shop]',
      import.meta.server ? 'server' : 'client',
      'API 类型：',
      typeof nuxtApp.$practiceApi,
    )

    const shop = useState<Shop | null>('practice-shop', () => null)

    if (!shop.value) {
      shop.value = await nuxtApp.$practiceApi<Shop>('/shop')
    }
  },
})
```

### 页面与入口

创建 `pages/practice/plugin-shop.vue`：

```vue
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
```

在已有首页添加：

```vue
<NuxtLink to="/practice/plugin-shop" :prefetch="false">
  进入插件练习
</NuxtLink>
```

### 复现步骤

运行 yarn dev，直接打开 /practice/plugin-shop，对比终端与浏览器控制台。

插件属于应用初始化过程，故障可能影响首页等其他页面，不仅是练习页。修改插件名称或依赖后重启开发服务器，避免热更新日志干扰。

## 实现与排查任务

1. 找出 API 不可调用的原因，区分没有注入与接口返回错误。
2. 不改变接口与页面，修复初始化顺序。
3. 分别尝试通过文件名排序修复，以及保留原文件名、通过 name/dependsOn 修复。
4. 解释为何类型可识别，仍不能保证调用时已注入。
5. 解释两个普通插件为何在终端与浏览器都会执行，而初次水合不一定再请求配置。
6. 选做：API 插件改成 .client.ts 是否适合本题 SSR 场景？
7. 选做：站内进入练习页是否会重新执行这两个插件？

不要用 setTimeout 猜测等待时间，也不要通过关闭 SSR 绕过错误。

## 验证步骤与成功标准

| 操作 | 修复后的预期 |
| --- | --- |
| 直接刷新练习页 | 显示校园服饰店和 CNY |
| 检查终端 | API 插件先执行，店铺插件读到 function |
| 查看 Document Response | HTML 中已有店铺名、币种 |
| 检查浏览器控制台 | API 插件先执行，店铺插件读到 function |
| 完成初次水合，不操作 | 浏览器没有额外 /api/practice/shop Fetch/XHR |
| 首页与练习页站内往返 | 配置正常，插件初始化日志不随普通导航重复出现 |
| 整页刷新 | 新建应用初始化过程，执行相应插件 |

服务端内部接口请求结合终端判断，不能只看浏览器 Network。适用于支持对象式插件与 dependsOn 的 Nuxt 3 版本；例如原练习使用的 Nuxt 3.20.x。

## 参考答案

### Q1. 是接口出错，还是注入时机出错？

默认文件名顺序是：

```text
01.practice-shop.ts
02.practice-api.ts
```

没有其他顺序配置时，消费者先开始执行，提供者尚未完成注入。调用失败发生在发起请求之前，不是接口返回了错误。

### Q2. 怎样通过文件名修复？

把两个文件改为：

```text
01.practice-api.ts
02.practice-shop.ts
```

代码内容可不变。保持位数一致，避免词法排序与预期不符。

### Q3. 怎样通过显式依赖修复？

保留原文件名，替换店铺插件：

```ts
type Shop = {
  name: string
  currency: string
}

export default defineNuxtPlugin({
  name: 'practice-shop',
  dependsOn: ['practice-api'],

  async setup(nuxtApp) {
    console.log(
      '[practice-shop]',
      import.meta.server ? 'server' : 'client',
      'API 类型：',
      typeof nuxtApp.$practiceApi,
    )

    const shop = useState<Shop | null>('practice-shop', () => null)

    if (!shop.value) {
      shop.value = await nuxtApp.$practiceApi<Shop>('/shop')
    }
  },
})
```

dependsOn 对应提供者声明的 name，不是文件名，也不是注入属性名。它表达消费者需要等待哪个插件完成。

| 名称 | 本例 | 职责 |
| --- | --- | --- |
| 文件名 | 02.practice-api.ts | 文件发现与默认排序 |
| 插件 name | practice-api | 插件身份和依赖 |
| 注入名称 | practiceApi → $practiceApi | 运行时访问帮助函数 |

Nuxt 在插件返回后注册 provide 内容。为依赖关系命名，能让初始化顺序更明确。

### Q4. TypeScript 为什么没有阻止？

Nuxt 能根据 provide 返回值生成注入类型，所以编辑器知道 $practiceApi 应是什么。类型描述不保证每个调用点执行时，属性已经注册。

类型正确与运行时初始化时机正确，需要分别保证。

### Q5. 为什么两端都执行，接口却不必重复请求？

本例流程：

1. 服务端创建应用，API 插件创建并注入请求客户端。
2. 店铺插件请求配置，写入 useState。
3. Nuxt 输出 HTML，并将可序列化状态交给浏览器。
4. 浏览器创建应用，再执行两个普通插件。
5. 配置状态已恢复，if 判断为假，不再请求。

需要区分：

- $practiceApi：在两端分别创建、分别注入的函数。
- shop：可序列化的配置对象，通过 SSR 状态传递供浏览器复用。

保存的不是 $fetch 函数。若删掉 if 判断，浏览器插件仍会再次请求；插件不会自动去重所有业务请求。

### Q6. API 插件改为 .client.ts 合适吗？

不合适。店铺插件在 SSR 中仍依赖 API，但服务端没有客户端专属提供者。dependsOn 不能让 .client.ts 插件在服务端执行。

### Q7. 普通站内导航会重新初始化插件吗？

通常不会。导航复用当前 Nuxt 应用，不会重跑所有插件。每次进入路由都需要执行的业务，应放在页面或路由中间件等相应位置。

## 常见误区与参考

- setTimeout 不能表达可靠的插件依赖。
- 插件不是组件实例，随意加 onMounted 不能替代依赖声明。
- 能看到类型，不代表属性已经在运行时注册。
- 普通插件与 Nitro server/plugins 不是一回事。
- useState 传递数据，不传递两端分别创建的请求函数。
- 不要把客户端专属插件当作 SSR 依赖提供者。

本题沿用 Nuxt 3 根目录 plugins/，不采用 Nuxt 4 默认 app/plugins/ 目录结构。

参考文档：

- [Nuxt 3 defineNuxtPlugin](https://nuxt.com/docs/3.x/api/utils/define-nuxt-plugin)
- [Nuxt 3 插件目录](https://nuxt.com/docs/3.x/guide/directory-structure/plugins)
- [Nuxt 3 useState](https://nuxt.com/docs/3.x/api/composables/use-state)
