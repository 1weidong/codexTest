export default defineEventHandler(() => {
  console.log('[shop API] 请求配置')

  return {
    name: '校园服饰店',
    currency: 'CNY',
  }
})