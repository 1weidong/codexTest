export default defineEventHandler(async () => {
  console.log('[phase8 API] 获取商品')

  // 模拟接口耗时
  await new Promise(resolve => setTimeout(resolve, 200))

  return {
    id: 'P-801',
    name: '校园连帽卫衣',
    description: '纯棉面料，支持团队图案定制。',
    reviews: [
      { id: 'R-1', content: '尺码合适，印花清晰。' },
      { id: 'R-2', content: '面料厚实，适合秋冬。' },
    ],
  }
})