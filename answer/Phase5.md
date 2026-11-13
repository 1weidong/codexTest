# 第 5 期｜Pinia：订单勾选后数量不更新，清空后勾选却还在

日期：2026 年 10 月 26 日。主题：Pinia 状态解构与响应式。难度：基础进阶。预计耗时：35–45 分钟。

## 场景与目标

订单页支持勾选订单、显示已选数量和批量操作。测试发现：勾选后数量一直为 0；已选 ID 却能跟着部分操作更新；清空后 store 已为空，页面仍显示旧 ID。

本期目标：解释同一行解构出来的属性为何表现不同，区分响应式数组对象与 store 属性的当前引用，并正确读取状态和 getter。

## 复现代码

沿用 Nuxt 3 + TypeScript，`app.vue` 保持：

```vue
<template>
  <NuxtPage />
</template>
```

练习页保留 SSR。若已接入 Pinia，无需重复安装；尚未接入可使用官方命令：

```bash
npx nuxi@latest module add pinia
```

确认 `nuxt.config.ts` 的现有模块中包含：

```ts
export default defineNuxtConfig({
  modules: ['@pinia/nuxt'],
})
```

本题使用 Nuxt 3 根目录 `stores/`，不采用 Nuxt 4 的默认 `app/stores/` 目录结构。

### Store

创建 `stores/practiceOrderSelection.ts`：

```ts
import { defineStore } from 'pinia'

export const usePracticeOrderSelectionStore = defineStore(
  'practice-order-selection',
  {
    state: () => ({
      selectedIds: [] as string[],
    }),

    getters: {
      selectedCount: state => state.selectedIds.length,
    },

    actions: {
      toggle(id: string) {
        const index = this.selectedIds.indexOf(id)

        if (index === -1) {
          this.selectedIds.push(id)
        } else {
          this.selectedIds.splice(index, 1)
        }
      },

      clear() {
        this.selectedIds = []
      },
    },
  },
)
```

### 故障页面

创建 `pages/practice/pinia-orders.vue`：

```vue
<script setup lang="ts">
import { usePracticeOrderSelectionStore } from '~/stores/practiceOrderSelection'

const store = usePracticeOrderSelectionStore()

// 故障点：直接解构状态与 getter。
const { selectedIds, selectedCount } = store

// Pinia action 可以直接解构。
const { toggle, clear } = store

const orders = [
  { id: 'order-001', name: '校园 T 恤' },
  { id: 'order-002', name: '团队卫衣' },
  { id: 'order-003', name: '运动背心' },
]
</script>

<template>
  <main>
    <h1>订单批量选择</h1>

    <p>界面已选数量：{{ selectedCount }}</p>
    <p>界面已选 ID：{{ selectedIds.join(', ') || '无' }}</p>

    <ul>
      <li v-for="order in orders" :key="order.id">
        <label>
          <input
            type="checkbox"
            :checked="selectedIds.includes(order.id)"
            @change="toggle(order.id)"
          >
          {{ order.id }} — {{ order.name }}
        </label>
      </li>
    </ul>

    <button @click="clear()">清空选择</button>
    <button :disabled="selectedCount === 0">
      批量导出（仅验证按钮状态）
    </button>

    <hr>
    <p>调试：store 实际数量 {{ store.selectedCount }}</p>
    <pre>store 实际 ID：{{ store.selectedIds }}</pre>
    <NuxtLink to="/">返回首页</NuxtLink>
  </main>
</template>
```

### 复现步骤

运行 `yarn dev`，直接打开 `/practice/pinia-orders`：

1. 勾选前两条订单。
2. 对比界面已选数量与 store 实际数量。
3. 点击清空选择。
4. 对比已选 ID、复选框与 store 实际数据。

若需要测试往返导航，在已有首页添加指向练习页的 NuxtLink。

## 实现与排查任务

1. 解释为什么 `selectedCount` 一直为初始化时的值。
2. 解释为什么直接解构的 `selectedIds` 在 push/splice 时还能更新。
3. 解释为什么 clear 替换数组后，页面仍读取旧数组。
4. 修复状态与 getter 的读取，保留现有 action。
5. 解释 action 为什么可以直接解构，是否需要 storeToRefs。
6. 选做：只把 clear 改为 splice，能否完整修复？
7. 选做：不用 storeToRefs，还有哪些正确读取方式？

不要使用 watcher 复制 store 状态，也不要通过强制刷新页面更新界面。

## 验证步骤与成功标准

修复前后按同样顺序测试：

| 操作 | 修复后的预期 |
| --- | --- |
| 直接刷新 | 数量 0，ID 为空，导出按钮禁用 |
| 勾选第一条 | 数量 1，ID 为 order-001，导出按钮启用 |
| 再选第二条 | 数量 2，页面与 store 一致 |
| 取消第一条 | 数量 1，只剩 order-002 |
| 点击清空 | 数量 0，ID 为空，所有复选框取消，按钮禁用 |
| 清空后选第三条 | 数量 1，只含 order-003 |
| 重复清空、选择 | 始终一致，不能只通过第一次操作 |

选中后站内返回首页再进入练习页，当前应用中的选择应保留。本题未配置持久化，整页刷新后恢复为空是预期。

本例没有业务 API。主要观察页面、Pinia DevTools 或调试值；直接刷新时检查没有新增水合警告。

## 参考答案

### Q1. 为什么数量一直不变？

```ts
const { selectedCount } = store
```

这行拿到的是当时 getter 的数字结果。初始化时为 0，后续 getter 重新计算，不会改变这个普通数字变量。

### Q2–Q3. 为什么数组部分操作能更新，替换后却不行？

```ts
const { selectedIds } = store
```

它保存的是当时那个响应式数组的引用。开始时它与 store 属性指向同一数组，push/splice 修改该对象，页面仍可观察到变化。

当执行：

```ts
this.selectedIds = []
```

store 属性转而指向新数组，本地变量仍指向旧数组。旧数组没有失去响应式，它只是已经不是 store 当前使用的数组。

| 操作 | 直接解构的数组变量 |
| --- | --- |
| 对原数组 push/splice | 仍指向同一对象，能观察变化 |
| 替换 store.selectedIds | 仍指向旧数组，不会自动改指向 |
| storeToRefs 后替换数组 | ref 继续读取 store 当前属性，取得新数组 |

### Q4. 最小修复是什么？

替换页面中的状态解构，其余订单数据、模板和 store 保持不变：

```ts
import { storeToRefs } from 'pinia'
import { usePracticeOrderSelectionStore } from '~/stores/practiceOrderSelection'

const store = usePracticeOrderSelectionStore()
const { selectedIds, selectedCount } = storeToRefs(store)
const { toggle, clear } = store
```

storeToRefs 为状态和 getter 提供 ref 连接，忽略 action 等方法。模板直接读取；JavaScript 中使用 .value：

```ts
console.log(selectedIds.value)
console.log(selectedCount.value)
```

### Q5. Action 是否需要 storeToRefs？

不需要。Pinia action 已绑定对应 store，可以直接解构：

```ts
const { toggle, clear } = store
```

### Q6. 只把 clear 改为 splice 能完整修复吗？

```ts
clear() {
  this.selectedIds.splice(0)
}
```

不能。数组引用可以继续观察清空，但数字快照仍不更新；以后其他 action 再替换数组，旧引用问题还会出现。

原来的数组赋值本身合法，应修复页面读取方式。

### Q7. 其他正确读取方式是什么？

直接通过 store 读取：

```vue
<p>已选数量：{{ store.selectedCount }}</p>
```

或持续在 computed 中访问 store 属性：

```ts
const selectedIds = computed(() => store.selectedIds)
const selectedCount = computed(() => store.selectedCount)
```

以下写法仍不正确：

```ts
const { selectedCount } = store
const count = computed(() => selectedCount)
```

它读的仍是已经复制出来的普通数字。

## 常见误区与参考

- 数组能响应 push，不代表直接解构就保留了与 store 属性的完整连接。
- 数组替换是合法更新；不要仅为迁就错误读取而禁止替换。
- action 与状态、getter 的提取方式不同。
- 不要用双份状态、watcher 复制或强制刷新掩盖读取问题。
- SPA 往返保留状态与整页刷新后的持久化是不同要求。

参考文档：

- [Pinia store 解构](https://pinia.vuejs.org/core-concepts/#destructuring-from-a-store)
- [Pinia storeToRefs](https://pinia.vuejs.org/api/pinia/functions/storeToRefs.html)
- [Pinia Nuxt 集成](https://pinia.vuejs.org/ssr/nuxt.html)
- [Vue 响应式基础](https://vuejs.org/guide/essentials/reactivity-fundamentals.html)
