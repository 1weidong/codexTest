export default defineEventHandler(async (event) => {
  const body = await readBody<{ loggedIn: boolean }>(event)

  if (body.loggedIn === true) {
    setCookie(event, 'phase7-session', 'demo-user', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    })
  } else {
    deleteCookie(event, 'phase7-session', { path: '/' })
  }

  return { ok: true }
})