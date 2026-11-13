// 本地模拟数据库。仅演示状态流，不包含真实订单或身份认证。
const orders = [
  { id: '1101', name: '校园卫衣', status: 'paid' },
  { id: '1102', name: '校园背包', status: 'paid' },
]

export default defineEventHandler(async (event) => {
    console.log('event', event.method, event.node.req.url)
  setHeader(event, 'Cache-Control', 'no-store')

  const method = event.method

  if (method === 'GET') {
    console.log('[phase11 GET] 读取订单')
    return orders.map(order => ({ ...order }))
  }

  if (method !== 'POST') {
    throw createError({ statusCode: 405 })
  }

  const { id } = await readBody<{ id: string }>(event)
  const order = orders.find(item => item.id === id)

  if (!order) {
    throw createError({ statusCode: 404 })
  }

  // 模拟业务处理耗时，便于观察乐观更新。
  await new Promise(resolve => setTimeout(resolve, 700))

  if (id === '1102') {
    console.log('[phase11 POST] 拒绝取消', id)
    throw createError({
      statusCode: 409,
      statusMessage: 'Order is locked',
    })
  }

  order.status = 'cancelled'
  console.log('[phase11 POST] 取消成功', id)

  return { ...order }
})
