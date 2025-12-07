import { NextRequest, NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { ZodError } from "zod";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { getAuthSession } from "@/lib/auth";
import { checkRateLimit, RATE_LIMIT_DEFAULT } from "@/lib/rate-limit";
import { logRequest } from "@/lib/logger";

type HandlerContext<TParams = unknown> = {
  params?: TParams;
  session?: Awaited<ReturnType<typeof getAuthSession>>;
};

type Handler<TParams> = (
  req: NextRequest,
  context: HandlerContext<TParams>,
) => Promise<Response>;

type ApiHandlerOptions = {
  requireAuth?: boolean;
  rateLimit?: {
    limit: number;
    windowMs: number;
  };
};

function mapPrismaError(error: PrismaClientKnownRequestError) {
  switch (error.code) {
    case "P2002":
      return {
        status: 409,
        body: {
          error: "Unique constraint failed",
          target: error.meta?.target,
        },
      };
    case "P2025":
      return {
        status: 404,
        body: { error: "Record not found" },
      };
    default:
      return {
        status: 400,
        body: { error: error.message, code: error.code },
      };
  }
}

function getClientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function getRequestKey(req: NextRequest) {
  const url = req.nextUrl;
  return `${req.method}:${url.pathname}`;
}

export function withApiHandler<TParams = unknown>(
  handler: Handler<TParams>,
  options: ApiHandlerOptions = {},
) {
  return async function wrapped(
    req: NextRequest,
    context: { params: Promise<TParams> },
  ) {
    const start = performance.now();
    const ip = getClientIp(req);
    const key = `${ip}:${getRequestKey(req)}`;
    const rateLimitOptions = options.rateLimit ?? RATE_LIMIT_DEFAULT;
    const { success, retryAfter } = checkRateLimit(
      key,
      rateLimitOptions.limit,
      rateLimitOptions.windowMs,
    );

    if (!success) {
      const response = NextResponse.json(
        { error: "Too Many Requests" },
        {
          status: 429,
          headers: { "Retry-After": retryAfter.toString() },
        },
      );
      logRequest({
        method: req.method,
        path: req.nextUrl.pathname,
        status: response.status,
        duration: performance.now() - start,
        ip,
      });
      return response;
    }

    let session: Awaited<ReturnType<typeof getAuthSession>> | undefined;

    if (options.requireAuth !== false) {
      session = await getAuthSession();
      if (!session?.user) {
        const response = NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 },
        );
        logRequest({
          method: req.method,
          path: req.nextUrl.pathname,
          status: response.status,
          duration: performance.now() - start,
          ip,
        });
        return response;
      }
    }

    try {
      const resolvedParams = await context.params;

      const response = await handler(req, {
        session,
        params: resolvedParams,
      });
      logRequest({
        method: req.method,
        path: req.nextUrl.pathname,
        status: response.status,
        duration: performance.now() - start,
        ip,
      });
      return response;
    } catch (error) {
      const duration = performance.now() - start;
      let status = 500;
      let body: Record<string, unknown> = {
        error: "Internal Server Error",
      };

      if (error instanceof ZodError) {
        status = 422;
        body = { error: "Validation failed", details: error.flatten() };
      } else if (error instanceof PrismaClientKnownRequestError) {
        const mapped = mapPrismaError(error);
        status = mapped.status;
        body = mapped.body;
      } else if (error instanceof Error) {
        const customStatus = (error as { status?: number }).status;
        if (typeof customStatus === "number") {
          status = customStatus;
        }
        body = { error: error.message };
      }

      console.error("API handler error", {
        path: req.nextUrl.pathname,
        method: req.method,
        error,
      });

      const response = NextResponse.json(body, { status });
      logRequest({
        method: req.method,
        path: req.nextUrl.pathname,
        status,
        duration,
        ip,
      });
      return response;
    }
  };
}
