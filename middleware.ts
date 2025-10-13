import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

const routeRolePolicies = [
  { pattern: /^\/dashboard\/admin(?:\/|$)/, allowedRoles: new Set(["ADMIN"]) },
];

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role as string | undefined;
    if (!role) {
      const url = new URL("/", req.url);
      return NextResponse.redirect(url, { status: 302 });
    }

    if (role === "CLIENT") {
      const portalUrl = new URL("/portal", req.url);
      return NextResponse.redirect(portalUrl, { status: 302 });
    }

    const pathname = req.nextUrl.pathname;
    for (const policy of routeRolePolicies) {
      if (policy.pattern.test(pathname)) {
        if (!policy.allowedRoles.has(role)) {
          return new NextResponse("Forbidden", { status: 403 });
        }
        break;
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized() {
        return true;
      },
    },
  },
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/contacts/:path*",
    "/matters/:path*",
    "/documents/:path*",
    "/events/:path*",
    "/tasks/:path*",
    "/users/:path*",
  ],
};
