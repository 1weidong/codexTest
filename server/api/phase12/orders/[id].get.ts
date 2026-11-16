export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')

  setHeader(event, 'Cache-Control', 'no-store')
  console.log('[phase12 API]', id)

  if (id === 'ok') {
    return {
      id,
      total: 199,
      status: 'paid',
    }
  }

  if (id === 'broken') {
    // 模拟上游接口契约发生变化。
    return {
      id,
      total: '199',
      status: 'paid',
    }
  }

  throw createError({
    statusCode: 404,
    statusMessage: 'Order Not Found',
  })
})