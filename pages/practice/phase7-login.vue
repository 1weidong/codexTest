<script setup lang="ts">
const router = useRouter()
const busy = ref(false)
const message = ref('')

async function changeSession(loggedIn: boolean) {
  busy.value = true
  message.value = ''

  try {
    await $fetch('/api/phase7/session', {
      method: 'POST',
      body: { loggedIn },
    })

    // 登录身份改变后，清理本练习之前的数据和错误。
    clearNuxtData('phase7-orders')

    if (loggedIn) {
      await router.push('/practice/phase7-orders')
    } else {
      message.value = '已退出，可再次验证未登录访问'
    }
  } catch {
    message.value = '操作失败，请检查网络请求'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main>
    <h1>模拟登录</h1>

    <button :disabled="busy" @click="changeSession(true)">
      登录并进入订单页
    </button>
    <button :disabled="busy" @click="changeSession(false)">
      退出登录
    </button>

    <p>{{ message }}</p>

    <NuxtLink to="/practice/phase7-orders" :prefetch="false">
      直接进入订单页
    </NuxtLink>
  </main>
</template>