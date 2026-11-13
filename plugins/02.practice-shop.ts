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