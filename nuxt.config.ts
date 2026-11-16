// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  // 验证 SSR HTML 协商缓存时，避免开发工具注入每次请求的时间戳。
  devtools: { enabled: false },
  features: {
    devLogs: false,
  },

  // routeRules: {
  //   '/account/orders': { ssr: false },
  // },
  ssr: true,

  modules: ['@pinia/nuxt'],
})
