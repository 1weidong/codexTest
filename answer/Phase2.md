# 第 2 期｜水合排查：手机端刷新有警告，站内跳转却正常

日期：2026 年 10 月 14 日。主题：水合错误排查。难度：基础进阶。预计耗时：30–45 分钟。

## 场景与目标

商品列表在桌面端显示三列网格，手机端显示单列列表。开发者使用 `import.meta.client` 判断后读取窗口宽度，避免了 `window is not defined`，却发现：

- 桌面宽度下直接刷新：正常。
- 手机宽度下直接刷新：出现水合警告，但商品最终能显示。
- 手机宽度下从首页跳转进入：通常正常。

本期目标是区分“浏览器 API 访问安全”和“服务端、浏览器初次渲染一致”，保留商品 SSR，并完成响应式布局和交互验证。

## 复现代码

使用 Nuxt 3 + TypeScript，沿用根目录 `pages/` 的常规结构。示例数据内置，无需外部接口或额外依赖。

`app.vue`：

```vue
<template>
  <NuxtPage />
</template>
```

在 `nuxt.config.ts` 中合并以下配置，保留其他已有配置。确保练习 URL 没有被更具体的 CSR 规则覆盖：

```ts
export default defineNuxtConfig({
  ssr: true,
  routeRules: {
    '/account/orders': { ssr: false },
    '/practice/products': { ssr: true },
  },
})
```

在 `pages/index.vue` 的模板中添加入口：

```vue
<NuxtLink to="/practice/products" :prefetch="false">
  进入商品列表练习
</NuxtLink>
```

`pages/practice/products.vue`，故障版本：

```vue
<script setup lang="ts">
type Product = {
  id: number
  name: string
  price: number
}

const products: Product[] = [
  { id: 1, name: '校园 T 恤', price: 59 },
  { id: 2, name: '团队卫衣', price: 129 },
  { id: 3, name: '运动背心', price: 49 },
]

const isMobile = ref(
  import.meta.client && window.innerWidth < 768,
)
const cartCount = ref(0)

console.log(
  '[products setup]',
  import.meta.server ? 'server' : 'client',
  { isMobile: isMobile.value },
)
</script>

<template>
  <main>
    <h1>推荐商品</h1>
    <p>购物车：{{ cartCount }}</p>

    <ul v-if="isMobile" class="mobile-list">
      <li v-for="product in products" :key="product.id">
        <h2>{{ product.name }}</h2>
        <p>¥{{ product.price }}</p>
        <button @click="cartCount++">加入购物车</button>
      </li>
    </ul>

    <div v-else class="desktop-grid">
      <article v-for="product in products" :key="product.id">
        <h2>{{ product.name }}</h2>
        <p>¥{{ product.price }}</p>
        <button @click="cartCount++">加入购物车</button>
      </article>
    </div>

    <NuxtLink to="/">返回首页</NuxtLink>
  </main>
</template>

<style scoped>
.desktop-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.mobile-list {
  padding: 0;
  list-style: none;
}
</style>
```

运行 `yarn dev`。在浏览器设备模拟工具中设置 390px 宽度，直接打开 `/practice/products` 并刷新。观察浏览器控制台和 Nuxt 终端；切换到 1280px 后重复测试。

## 实现与排查任务

1. 写出服务端、手机端浏览器初次执行时，`isMobile` 分别是什么值。
2. 找出服务端输出与浏览器预期之间，第一处不同的元素。
3. 解释为什么 `import.meta.client` 避开了 `window` 报错，却没有避开水合警告。
4. 保留商品内容的 SSR，实现手机一列、桌面三列，并消除警告。
5. 修复时不关闭页面 SSR，不使用整页 `<ClientOnly>`，不屏蔽水合警告。
6. 选做：把判断移到 `onMounted` 能否修复？与 CSS 解法相比有什么区别？
7. 补充：如果 JavaScript 需要维护 `isMobile`，怎样处理后续窗口变化与监听清理？

## 验证步骤与成功标准

先记录故障版本的表现，再验证修复版本。每次清空控制台，避免把旧警告当成新警告。

| 操作                              | 故障版本预期                                             | CSS 修复版成功标准                |
| --------------------------------- | -------------------------------------------------------- | --------------------------------- |
| 390px 下直接刷新                  | 服务端`false`、浏览器 `true`；可能提示节点水合不匹配 | 无水合警告，显示一列              |
| 1280px 下直接刷新                 | 两端均为`false`，通常无警告                            | 无水合警告，显示三列              |
| 390px 下从首页进入                | 通常无同一种水合警告                                     | 正常显示一列                      |
| 查看 Document 的 Response         | 商品区域是`div.desktop-grid`                           | 商品区域包含完整、统一的列表 HTML |
| 不刷新，宽度从 390px 改为 1280px  | 没有监听宽度，仍使用手机分支                             | 自动变为三列                      |
| 不刷新，宽度从 1280px 改为 390px  | 没有监听宽度，仍使用桌面分支                             | 自动变为一列                      |
| 禁用 JavaScript 后刷新            | 有 SSR 商品内容，但布局使用桌面分支                      | 商品仍存在，布局适配当前宽度      |
| 启用 JavaScript，点击购买按钮两次 | 观察交互是否正常                                         | 购物车计数变为 2                  |

- 初始 HTML 以 Network → Document → Response 为准，Elements 中的 DOM 可能已经被 Vue 修复或更新。
- Vue 在发现水合不匹配后可能修复 DOM，因此“最后页面能显示”不能证明水合正常。
- 不同 Vue 小版本的警告文字可能不同，重点检查两端选择的分支与具体节点差异。
- 本例没有业务 API 请求，主要证据来自 Document 响应、服务端与浏览器日志、布局和交互。

## 参考答案

### Q1. 两端的 `isMobile` 值分别是什么？

服务端的 `import.meta.client` 为 `false`，`&&` 短路，因此不执行 `window.innerWidth < 768`，最终为 `false`。

浏览器初次执行时，`import.meta.client` 为 `true`，因此取决于视口宽度：

| 环境                       | `isMobile` |
| -------------------------- | ------------ |
| 服务端                     | `false`    |
| 浏览器宽度小于 768px       | `true`     |
| 浏览器宽度大于或等于 768px | `false`    |

### Q2. 第一处不同的元素在哪里？

商品区域的根元素不同：

```html
<!-- 服务端输出 -->
<div class="desktop-grid">...</div>

<!-- 手机浏览器初次预期 -->
<ul class="mobile-list">...</ul>
```

商品节点随后也不同：服务端是 `article`，手机浏览器预期是 `li`。商品数据与 `key` 相同，不能抵消元素结构不同。

### Q3. 为什么环境判断没有避免水合警告？

环境判断只保证服务端不执行浏览器 API，不保证两端生成相同的 HTML。

本例在手机端，服务端选择桌面分支，浏览器初次渲染选择手机分支。Vue 水合时需要将浏览器组件与已有服务端 DOM 匹配，遇到 `div` 与 `ul` 的差异就会产生不匹配。

这里应称为“水合不匹配”，不应笼统认为整个页面完全水合失败。Vue 可能自动恢复并使页面继续工作，但会产生额外的 DOM 修复开销。

从首页通过 `NuxtLink` 进入时，这个新页面通常由浏览器直接创建，没有该页面的服务端商品 DOM 需要匹配，所以不会出现同一种问题。

### Q4–Q5. 怎样保留 SSR、实现响应式布局并消除警告？

推荐统一 DOM，使用 CSS 媒体查询改变布局。将商品页替换为：

```vue
<script setup lang="ts">
type Product = {
  id: number
  name: string
  price: number
}

const products: Product[] = [
  { id: 1, name: '校园 T 恤', price: 59 },
  { id: 2, name: '团队卫衣', price: 129 },
  { id: 3, name: '运动背心', price: 49 },
]
const cartCount = ref(0)
</script>

<template>
  <main>
    <h1>推荐商品</h1>
    <p>购物车：{{ cartCount }}</p>

    <ul class="product-grid">
      <li v-for="product in products" :key="product.id">
        <h2>{{ product.name }}</h2>
        <p>¥{{ product.price }}</p>
        <button @click="cartCount++">加入购物车</button>
      </li>
    </ul>

    <NuxtLink to="/">返回首页</NuxtLink>
  </main>
</template>

<style scoped>
.product-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  padding: 0;
  list-style: none;
}
@media (min-width: 768px) {
  .product-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
```

服务端与浏览器渲染相同的商品列表，浏览器通过 CSS 决定列数。媒体查询也会自动响应后续窗口变化，不需要 JavaScript 监听；禁用 JavaScript 后仍能适配布局。

### Q6. 把判断移到 `onMounted` 能否修复？

可以。保留故障版本的两套模板，将 `isMobile` 初始化改为：

```ts
const isMobile = ref(false)

onMounted(() => {
  isMobile.value = window.innerWidth < 768
})
```

服务端与浏览器初次渲染都为 `false`，使用桌面分支。挂载后读取真实宽度，在手机端更新为 `true`，这是正常的响应式 DOM 更新，而不是初次水合不匹配。

原文件的 `onMounted` 解法可以消除这个初始不匹配，但它只是完整页面中的一部分，需要搭配原模板；它也有两项限制：手机可能先显示桌面结构再切换，以及没有处理后续窗口变化。

若只是同一批商品改变列数，CSS 更合适。若 JavaScript 需要按断点切换交互模式，可以采用下一题的监听方案。

### Q7. 怎样处理后续窗口变化？

使用 `matchMedia` 获取当前匹配状态，并监听匹配结果的变化。以下代码替换故障版本中 `isMobile` 的初始化，商品数据、购物车状态和两套模板保持原样：

```ts
// 保持服务端与浏览器初次渲染一致
const isMobile = ref(false)
let mediaQuery: MediaQueryList | undefined

function handleChange(event: MediaQueryListEvent) {
  isMobile.value = !event.matches
}

onMounted(() => {
  mediaQuery = window.matchMedia('(min-width: 768px)')

  // matches 为 true 表示视口宽度 >= 768px
  isMobile.value = !mediaQuery.matches
  mediaQuery.addEventListener('change', handleChange)
})

onUnmounted(() => {
  mediaQuery?.removeEventListener('change', handleChange)
})
```

执行顺序：服务端初值为 `false` → 浏览器初次水合也为 `false` → 挂载后同步实际宽度 → 跨越断点时更新 → 组件卸载时移除监听。

`change` 在媒体查询匹配结果改变时触发，不会像 `resize` 一样随着每次宽度调整不断触发：

| 宽度变化      | 是否触发`change` | 最终`isMobile` |
| ------------- | ------------------ | ---------------- |
| 390 → 600px  | 否，仍小于断点     | `true`         |
| 600 → 800px  | 是，跨过断点       | `false`        |
| 800 → 1280px | 否，仍大于断点     | `false`        |
| 1280 → 390px | 是，跨过断点       | `true`         |

验证时先在 390px 刷新，再在不刷新的情况下改为 800px、1280px、390px，确认分支随断点变化。也测试边界 767px 与 768px，确保 JavaScript 与 CSS 采用同一断点定义。

这个方案解决后续窗口变化，但不会消除手机首次加载时可能出现的桌面结构到手机结构的切换。两套分支中的子组件还可能随切换被卸载和重新创建；本例的购物车计数位于共同父组件中，跨断点切换仍应保留。

## 常见误区与参考

- `import.meta.client` 保证某段浏览器代码不在服务端运行，不保证两端初始渲染结果一致。
- 给列表增加 `key` 不能让 `div` 与 `ul` 变成同一种节点。
- 把读取宽度移到 `onMounted` 能保持初始一致，但不自动监听后续变化。
- 仅改变列数优先使用 CSS；需要 JavaScript 行为切换时才维护断点状态。
- 不使用关闭 SSR 或屏蔽警告来替代本题要求的修复。

以上写法适用于 Nuxt 3 与 Vue 3，没有使用 Nuxt 4 专属目录或 API。`MediaQueryList` 的 `change` 监听示例面向支持 `addEventListener` 的现代浏览器；如项目必须支持旧浏览器，应根据目标版本处理兼容性。

参考文档：

- [Nuxt 3 水合最佳实践](https://nuxt.com/docs/3.x/guide/best-practices/hydration)
- [Vue SSR：水合不匹配](https://vuejs.org/guide/scaling-up/ssr#hydration-mismatch)
- [Vue 生命周期：onMounted](https://vuejs.org/api/composition-api-lifecycle.html#onmounted)
- [MDN：matchMedia](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia)
- [MDN：MediaQueryList change 事件](https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList/change_event)
