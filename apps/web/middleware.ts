import { NextResponse, type NextRequest } from 'next/server';

const HOST_SUFFIX = process.env.NEXT_PUBLIC_BOOKING_HOST_SUFFIX ?? '.splash.app';

export const config = {
  matcher: ['/((?!_next|favicon|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webmanifest|txt)$).*)'],
};

export function middleware(req: NextRequest) {
  const host = req.headers.get('host')?.toLowerCase();
  const url = req.nextUrl.clone();
  const res = NextResponse.next();

  if (!host) return res;

  // app.splash.app → admin (tenant resolved server-side from session)
  if (host === `app${HOST_SUFFIX}`) {
    return NextResponse.next();
  }

  // splash.app / www.splash.app → marketing
  if (host === HOST_SUFFIX.replace(/^\./, '') || host === `www${HOST_SUFFIX}`) {
    return NextResponse.next();
  }

  // {slug}.splash.app → booking público
  if (host.endsWith(HOST_SUFFIX)) {
    const sub = host.slice(0, -HOST_SUFFIX.length);
    if (sub && sub !== 'api' && sub !== 'app' && sub !== 'www') {
      const rewrite = NextResponse.next();
      rewrite.headers.set('x-tenant-slug', sub);
      return rewrite;
    }
  }

  // Dominio custom: propagar host, resolver en server
  const reply = NextResponse.next();
  reply.headers.set('x-tenant-host', host);
  return reply;
}
