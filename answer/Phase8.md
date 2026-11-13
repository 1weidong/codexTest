# 第 8 期｜SSR 水合：带 #reviews 的商品链接，为什么首屏不一致？

日期：2026 年 11 月 4 日。主题：SSR 水合与 URL 状态。

## 场景与目标

商品页通过 URL hash 保存“商品详情 / 买家评价”标签。站内点击正常，但直接打开带 `#reviews` 的链接或刷新时，服务端与浏览器选择了不同的标签，出现水合不匹配。

本期目标：区分接口数据与界面状态，使用服务端可见的 URL 信息确定首屏标签，保留前进后退与其他 query 参数，切换标签时不重复获取商品。

## 复现代码

使用 Nuxt 3 + TypeScript，沿用根目录 `pages/`、`server/api/` 结构。`app.vue` 保持：

```vue
<template>
  <NuxtPage />
</template>
```

保持默认 SSR，不为 `NuxtPage` 设置基于 `route.fullPath` 的自定义 key。以下 `useRoute`、`useRouter` 均使用 Nuxt 自动导入版本。

### 模拟接口

创建 `server/api/phase8/product.get.ts`：

```ts
export default defineEventHandler(async () => {
  console.log('[phase8 API] 获取商品')

  await new Promise(resolve => setTimeout(resolve, 200))

  return {
    id: 'P-801',
    name: '校园连帽卫衣',
    description: '纯棉面料，支持团队图案定制。',
    reviews: [
      { id: 'R-1', content: '尺码合适，印花清晰。' },
      { id: 'R-2', content: '面料厚实，适合秋冬。' },
    ],
  }
})
```

### 故障页面

创建 `pages/practice/phase8-product.vue`：

```vue
<script setup lang="ts">
type Tab = 'details' | 'reviews'

const route = useRoute()
const router = useRouter()

const activeTab = computed<Tab>(() =>
  route.hash === '#reviews' ? 'reviews' : 'details',
)

console.log(
  '[phase8 setup]',
  import.meta.server ? 'server' : 'client',
  { hash: route.hash, tab: activeTab.value },
)

const { data: product, error } = await useFetch(
  '/api/phase8/product',
  { key: 'phase8-product' },
)

async function selectTab(tab: Tab) {
  await router.push({
    path: route.path,
    query: { ...route.query },
    hash: `#${tab}`,
  })
}
</script>

<template>
  <main>
    <p v-if="error">商品加载失败</p>

    <template v-else-if="product">
      <h1>{{ product.name }}</h1>

      <nav>
        <button @click="selectTab('details')">商品详情</button>
        <button @click="selectTab('reviews')">买家评价</button>
      </nav>

      <section v-if="activeTab === 'details'" id="details">
        <h2>商品详情</h2>
        <p>{{ product.description }}</p>
      </section>

      <section v-else id="reviews">
        <h2>买家评价</h2>
        <ul>
          <li v-for="review in product.reviews" :key="review.id">
            {{ review.content }}
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>
```

### 复现步骤

运行 `yarn dev`，清空旧日志，分别测试：

```text
http://localhost:3000/practice/phase8-product
http://localhost:3000/practice/phase8-product#reviews
```

对比直接打开不带 hash、直接打开带 hash、先进入页面再点击评价这三种情况。检查终端和浏览器 setup 日志，查看该次 Network → Document → Response 中实际渲染的 section，再与水合后的 Elements 对比。

## 实现与排查任务

1. 对比三种访问方式，记录两端日志。
2. 对比 Document 原始响应与水合后的 Elements，判断哪一步开始出现差异。
3. 解释：商品数据已经通过 `await useFetch` 获取，为什么仍不能避免本次水合错误？
4. 修改标签状态的 URL 表达方式，让服务端能够确定首屏标签。
5. 保留浏览器前进后退；切换标签时保留其他 query 参数。
6. 本题接口一次返回详情和评价，标签切换不应重复请求商品。
7. 选做：兼容旧的 `#reviews` 链接，保证初次水合一致，并处理后续 hash 变化。

不要用关闭 SSR、`ClientOnly`、强制重建页面或屏蔽警告作为解法。

## 验证步骤与成功标准

### 故障证据

| 检查项 | 预期观察 |
| --- | --- |
| 不带 hash 直接打开 | 两端都选择详情，通常无本题水合警告 |
| 带 `#reviews` 直接打开 | 服务端日志为详情，浏览器 setup 日志为评价 |
| 查看该次 Document Response | 渲染的 section 是商品详情 |
| 浏览器控制台 | 出现水合文本或节点不匹配警告，措辞随 Vue 版本变化 |
| 完成水合后点击评价 | 标签正常切换，不涉及一次新的首屏水合 |

评价数据也可能存在于 Nuxt payload 中。仅搜索到某条评价文字，不能证明评价列表已经由 SSR 渲染；要检查实际 `<section>`。

### 修复后验证

| 操作 | 成功标准 |
| --- | --- |
| 直接打开 `?tab=reviews` | 原始 HTML 已渲染评价列表，水合无新增警告 |
| 直接打开 `?tab=details` | 原始 HTML 已渲染商品详情 |
| 不传 tab 或传 `?tab=unknown` | 稳定回退到详情 |
| 连续点击详情、评价 | URL 与可见内容一致 |
| 浏览器后退、前进 | 标签随 URL 恢复 |
| 从 `?campaign=autumn` 开始切换 | 保留 campaign 参数 |
| 首次 SSR 后完成水合 | 浏览器没有额外商品 Fetch/XHR |
| 当前页面内反复切换标签 | 不新增商品 API 请求 |

服务端内部 API 调用结合终端日志判断；浏览器 Network 不会把它显示为浏览器发出的独立 Fetch/XHR。

## 参考答案

### Q1. 两端为什么选择不同标签？

浏览器不会把 `#` 后的 fragment 发给服务器。对于：

```text
/practice/phase8-product?campaign=autumn#reviews
```

服务器收到的请求目标包含：

```text
/practice/phase8-product?campaign=autumn
```

| 执行阶段 | hash | 渲染分支 |
| --- | --- | --- |
| SSR | 空字符串 | 商品详情 |
| 浏览器初次水合 | `#reviews` | 买家评价 |

已完成水合后的站内点击属于正常响应式更新，不会再次进行本次首屏水合。因此只测试点击不能证明直接访问没有问题。

### Q2. 为什么 await useFetch 无法解决？

相同的商品数据，经过不同的标签状态，仍会生成不同 DOM。`await useFetch` 解决数据等待与传递，不能补齐服务端没有收到的 URL 信息。

Vue 水合要求客户端初次生成的结构与服务端 HTML 对应。浏览器最终修复出可见内容，不代表水合没有问题。

### Q3. 如何修复并保留历史记录？

替换页面中的 `activeTab` 和 `selectTab`，其余代码保持不变：

```ts
const activeTab = computed<Tab>(() =>
  route.query.tab === 'reviews' ? 'reviews' : 'details',
)

async function selectTab(tab: Tab) {
  await router.push({
    path: route.path,
    query: {
      ...route.query,
      tab,
    },
    hash: '',
  })
}
```

新的分享链接：

```text
/practice/phase8-product?tab=reviews
```

两端都能读取 `tab=reviews`，从而确定同一个首屏分支。本例仅接受单个值 `reviews`；缺失、未知值和重复参数形成的数组均回退到详情。

`router.push` 为标签切换增加历史记录，后退可恢复上一个标签。computed 持续读取 URL，无需再加一份本地 tab 状态与 watcher 双向同步。

### Q4. 为什么切换标签不需要重复获取商品？

接口一次返回详情和评价。请求 URL、key 和选项均固定，没有把 tab 作为请求依赖，因此切换只影响显示分支，不需要重新获取商品。

### Q5. 如何兼容旧 hash 链接？

如果产品接受服务端先输出详情，水合完成后再切到评价，可以保留原来的 hash 导航，把原 hash 方案的 activeTab 改为：

```ts
const mounted = ref(false)

onMounted(() => {
  mounted.value = true
})

const activeTab = computed<Tab>(() =>
  mounted.value && route.hash === '#reviews'
    ? 'reviews'
    : 'details',
)
```

SSR 与客户端初次水合都渲染详情，挂载后才读取 hash。computed 仍会跟踪后续 hash 变化，包括站内导航与前进后退。

代价是旧链接的评价不能成为 SSR 首屏内容，可能出现一次标签切换。如果要求评价直接出现在首屏 HTML，就应使用服务端可见的 query 或路径。`onMounted` 不在 SSR 阶段执行。

## 常见误区与参考

- 改成 `route.fullPath.includes('#reviews')`：fragment 在两端的差异仍在。
- `ref(route.query.tab)` 只保存初值，不会持续跟随后续路由变化。
- 挂载时只复制一次 hash，后续切换和后退可能失效。
- 把获取数据移到 `onMounted` 改变了首屏数据策略，没有修复 URL 状态表达。
- 用 `route.fullPath` 作为数据 key 或页面 key，引入无关的数据身份变化或页面重建。
- 只测试站内点击，遗漏直接访问和刷新。

本题使用 Nuxt 3 与 Vue Router 4 已有能力，不依赖 Nuxt 4 专属行为。

参考文档：

- [Nuxt 3 useRoute：fragment 与水合](https://nuxt.com/docs/3.x/api/composables/use-route#hydration-issues-with-routefullpath)
- [Nuxt 3 useFetch](https://nuxt.com/docs/3.x/api/composables/use-fetch)
- [Vue：水合不匹配](https://vuejs.org/guide/scaling-up/ssr.html#hydration-mismatch)
- [Vue Router：编程式导航](https://router.vuejs.org/guide/essentials/navigation.html)
