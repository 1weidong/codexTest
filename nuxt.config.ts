// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // routeRules: {
  //   '/account/orders': { ssr: false },
  // },
  ssr: true,

  modules: ['@pinia/nuxt'],
})