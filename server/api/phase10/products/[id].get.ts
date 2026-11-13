import { readPhase10Product } from '../../../utils/phase10Catalog'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (id !== 'a' && id !== 'b') {
    throw createError({ statusCode: 404 })
  }

  // 排除浏览器 HTTP 缓存，保留函数结果缓存。
  setHeader(event, 'Cache-Control', 'no-store')

  console.log('[phase10 API] 收到 GET', id)

  return await readPhase10Product(id)
})