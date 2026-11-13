import { phase9Product } from '../../utils/phase9Product'

export default defineEventHandler((event) => {
  setHeader(event, 'Cache-Control', 'no-store')

  phase9Product.price += 10
  phase9Product.revision += 1

  console.log('[phase9 POST] 改价', phase9Product.revision)

  return { ...phase9Product }
})