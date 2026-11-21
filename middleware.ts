// Runs before every page. It keeps your login fresh (so you stay signed in for
// months) and sends you to /login if you aren't signed in.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/manifest.webmanifest", "/sw.js", "/icon", "/apple-icon", "/offline"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Not set up yet: show a plain explanation instead of crashing.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return new NextResponse(
      "<body style='font:18px system-ui;background:#0b1026;color:#e6e8f5;padding:40px;max-width:560px;margin:auto'>" +
      "<h2>🌙 Almost there</h2><p>Supabase isn't connected yet. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and " +
      "<code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code> (or to Vercel), then restart. See README step 1.</p></body>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Important: this call refreshes the session cookie when needed.
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  if (!user && !isPublic && !path.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Skip static files and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)"],
};
