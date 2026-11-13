export default defineEventHandler((event) => {
  const authenticated =
    getCookie(event, 'phase7-session') === 'demo-user'

  console.log('[phase7 orders]', { authenticated })

  if (!authenticated) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  return {
    user: 'demo-user',
    orders: [
      { id: 'ORDER-701', product: '校园卫衣' },
      { id: 'ORDER-702', product: '运动背包' },
    ],
  }
})