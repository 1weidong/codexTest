import { createHash } from 'node:crypto'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:response', (response, { event }) => {
    if (
      getRequestURL(event).pathname !== '/practice/phase9-product' ||
      (event.method !== 'GET' && event.method !== 'HEAD') ||
      response.statusCode !== 200 ||
      typeof response.body !== 'string'
    ) {
      return
    }

    // 校验完整的 SSR HTML，包括水合数据和构建资源地址。
    const hash = createHash('sha256').update(response.body).digest('hex')
    const etag = `W/"${hash}"`

    response.headers = {
      ...response.headers,
      'cache-control': 'private, no-cache',
      etag,
    }

    const validators = getHeader(event, 'if-none-match')
    const unmodified = validators?.split(',').some((value) => {
      const validator = value.trim()
      return validator === '*' || validator.replace(/^W\//, '') === etag.slice(2)
    })

    if (unmodified) {
      response.statusCode = 304
      response.statusMessage = 'Not Modified'
      response.body = ''
    }
  })
})
