import { createPhase12OrdersApi } from '~/services/phase12Orders'

export default defineNuxtPlugin(() => {
  const client = $fetch.create({
    baseURL: '/api/phase12',
    retry: 0,

    onResponseError({ response }) {
      console.warn(
        '[phase12 HTTP]',
        import.meta.server ? 'server' : 'client',
        response.status,
      )
    },
  })

  const phase12Orders = createPhase12OrdersApi(
    path => client<unknown>(path),
  )

  return {
    provide: { phase12Orders },
  }
})