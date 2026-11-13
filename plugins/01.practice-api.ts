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