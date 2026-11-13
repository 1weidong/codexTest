// 本地单进程模拟数据库，仅保存公共商品。
// 数据源与下面的函数结果缓存是两层不同的东西。
export const phase10Catalog: Record<string, {
  id: string
  name: string
  price: number
  revision: number
}> = {
  a: { id: 'a', name: '商品 A：卫衣', price: 199, revision: 1 },
  b: { id: 'b', name: '商品 B：背包', price: 299, revision: 1 },
}

export const readPhase10Product = defineCachedFunction(
  async (id: string) => {
    console.log('[phase10 SOURCE] 读取数据源', id)

    await new Promise(resolve => setTimeout(resolve, 200))

    // 返回副本，避免后续改价直接修改缓存中的对象。
    return { ...phase10Catalog[id] }
  },
  {
    group: 'phase10',
    name: 'product',
    getKey: (id: string) => id,
    maxAge: 60,
    swr: false,
  },
)