import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth"

/**
 * Next.js proxy (middleware). Gates the whole app behind the shared-password
 * session: unauthenticated requests are redirected to /login, and an already
 * authenticated user hitting /login is sent to the app root.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const authed = await verifySessionToken(token)

  const isLogin = pathname === "/login"

  if (!authed && !isLogin) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (authed && isLogin) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Run on everything except Next internals, the login server-action endpoint is
  // a POST to /login (allowed for unauthed) and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
}
