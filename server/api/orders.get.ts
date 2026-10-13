export default defineEventHandler(async (event) => {
  const storeId = String(getQuery(event).storeId ?? '')

  console.log('[orders API]', storeId)

  if (!['shop-a', 'shop-b'].includes(storeId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid storeId',
    })
  }

  await new Promise(resolve => setTimeout(resolve, 300))

  return [
    { id: `${storeId}-001`, status: '待生产' },
    { id: `${storeId}-002`, status: '已发货' },
  ]
})