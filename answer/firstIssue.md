# 第一期答案

Q. 解释为什么站内跳转成功，刷新却失败，并指出报错发生在哪一端。

A. 站内跳转是因为走的浏览器环境，浏览器环境存在`localStorage`对象，刷新时，代码会先在服务端渲染，服务端环境中没有`localStorage`对象。


Q. 让订单工作台使用 CSR，同时保留商品目录的 SSR。

A. 在nuxt.config.ts文件中配置

```typescript
routeRules: {
    '/account/orders': { ssr: false },
  }
```


Q. 保留加载和错误反馈，不使用整页 <ClientOnly></clientonly>
A. 在 onMounted 生命周期中执行`localStorage`相关逻辑


Q. 回答：把 `useFetch` 改成 `{ server: false }`，能否单独修复这段代码？

A. 不能修复，因为问题出在`localStorage`中，服务器环境执行不了`localStorage`


Q. 进阶选做：如果订单页必须保留 SSR 页面骨架，怎样调整读取店铺和请求订单的时机？
A. `localStorage`在onMounteds生命周期中执行，并且`useFetch` 改成 `{ server: false }`
