import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/app"];
const AUTH_ROUTES = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      }
    }
  });

  // Refreshes the session cookie on every navigation so a student stays signed
  // in across visits without a client-side round trip.
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    const redirected = NextResponse.redirect(redirect);
    response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
    return redirected;
  }

  if (user && AUTH_ROUTES.includes(path)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/app";
    redirect.search = "";
    const redirected = NextResponse.redirect(redirect);
    response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
    return redirected;
  }

  return response;
}

export const config = {
  // demo/ is the static phone demo embedded in the homepage and mascot/ is the
  // companion's art: dozens of public files per visit, none of which need a
  // session refresh.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|sw.js|manifest.webmanifest|api/health|demo/|mascot/|icons/).*)"]
};
