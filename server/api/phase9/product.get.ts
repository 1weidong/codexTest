import { phase9Product } from '../../utils/phase9Product'

export default defineEventHandler((event) => {
  const etag = `W/"p901-${phase9Product.revision}"`
  const validator = getHeader(event, 'if-none-match')

  setHeader(event, 'Cache-Control', 'private, no-cache')
  setHeader(event, 'ETag', etag)

  // 教学示例：匹配本例产生的单个 ETag。
  if (validator === etag) {
    console.log('[phase9 GET] 304', etag)
    return sendNoContent(event, 304)
  }

  console.log('[phase9 GET] 200', etag)

  return { ...phase9Product }
})