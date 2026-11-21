import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { localBetaAllowed } from './lib/local-beta-access';
import { isSignedInAccount } from './lib/account-kind';

const PROTECTED_PREFIXES = ["/app"];
const AUTH_ROUTES = ["/login", "/signup"];

// Fail quickly if Supabase is paused or unreachable instead of timing out the
// entire request in Vercel middleware.
const authFetch: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(6_000);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Only an explicitly opened, loopback-only synthetic session uses this adapter.
  // Production and authenticated Supabase requests retain the existing auth/RLS path.
  if (localBetaAllowed(request) && !request.headers.has('authorization')
    && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(request.cookies.get('studigo_beta')?.value ?? '')) {
    const path = request.nextUrl.pathname;
    if (/^\/api\/(?:chat|quiz(?:\/attempt)?|flashcards(?:\/[^/]+)?|practice-tests(?:\/submit)?|learn(?:\/(?:check|preferences))?|topics(?:\/[^/]+)?|study-plan|coach\/preferences|documents\/(?:upload|process|download|[^/]+)|study-guide\/download)$/.test(path)) {
      const target = request.nextUrl.clone(); target.pathname = '/api/local-beta/compat';
      target.searchParams.set('_path',path.slice(4));
      return NextResponse.rewrite(target);
    }
    if (path.startsWith('/app')) return response;
  }

  const path = request.nextUrl.pathname;
  const protectedRoute = PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );

  // Public pages do not need an auth lookup. They must remain available while
  // Supabase is down; /app still checks authentication before proceeding.
  if (!protectedRoute && !AUTH_ROUTES.includes(path)) return response;

  const redirectToLogin = () => {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    const redirected = NextResponse.redirect(redirect);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    return redirected;
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return protectedRoute ? redirectToLogin() : response;

  const supabase = createServerClient(url, anonKey, {
    global: { fetch: authFetch },
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

  // Refresh sessions only where authentication is needed. Public navigation
  // remains independent of Supabase availability.
  let sessionUser = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error) sessionUser = data.user;
  } catch {
    // Network failure must never expose a protected page or hang a public one.
  }
  // An anonymous Supabase session is not a Studigo account.
  const user = isSignedInAccount(sessionUser) ? sessionUser : null;

  if (!user && protectedRoute) return redirectToLogin();

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|sw.js|manifest.webmanifest|api/health|api/waitlist|demo/|mascot/|icons/).*)"]
};
