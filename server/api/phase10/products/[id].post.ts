import { phase10Catalog } from '../../../utils/phase10Catalog'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (id !== 'a' && id !== 'b') {
    throw createError({ statusCode: 404 })
  }

  setHeader(event, 'Cache-Control', 'no-store')

  phase10Catalog[id].price += 10
  phase10Catalog[id].revision += 1

  await useStorage('cache').removeItem(
    `phase10:product:${id}.json`,
  )

  console.log('[phase10 WRITE] 已改价', id)

  // 故障点：更新了数据源，尚未处理函数结果缓存。
  return { ...phase10Catalog[id] }
})