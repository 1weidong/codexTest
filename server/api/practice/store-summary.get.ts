export default defineEventHandler(async (event) => {
  const storeId = String(getQuery(event).storeId ?? '')

  if (storeId !== 'shop-a' && storeId !== 'shop-b') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid storeId',
    })
  }

  console.log('[summary API]', storeId)

  await new Promise(resolve => setTimeout(resolve, 300))

  const summaries = {
    'shop-a': { orderCount: 3, profit: 120 },
    'shop-b': { orderCount: 9, profit: 450 },
  }

  return {
    storeId,
    ...summaries[storeId],
    sampledAt: Date.now(),
  }
})