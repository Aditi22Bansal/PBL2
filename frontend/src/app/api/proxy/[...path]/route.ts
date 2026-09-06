/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { NextResponse, NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

// Generic authenticated proxy: every admin/dashboard/chat/change-request call goes
// through here instead of hitting the Node backend directly. This is the one place
// that verifies the real NextAuth session server-side and attaches a trusted
// X-User-Email header - the value is ALWAYS session.user.email, never anything
// read from the incoming request (query params, body, or otherwise), so a client
// cannot assert someone else's identity no matter what it sends.
//
// One catch-all route instead of one file per endpoint (the pattern
// frontend/src/app/api/student/profile/route.ts already used) because the surface
// area here is ~20 backend endpoints across admin/student/chat; a single generic
// proxy means every current and future endpoint is covered automatically with no
// per-route boilerplate to keep in sync, at the cost of per-endpoint customization
// this app doesn't currently need (every route is plain JSON in/out except the CSV
// report download, which this proxy passes through by content-type instead of
// assuming JSON).
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await context.params;
  const targetPath = path.join("/");
  const search = request.nextUrl.search;
  const targetUrl = `${BACKEND_URL}/api/${targetPath}${search}`;

  const method = request.method;
  const headers: Record<string, string> = {
    "X-User-Email": session.user.email
  };

  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const raw = await request.text();
    if (raw) {
      body = raw;
      headers["Content-Type"] = request.headers.get("content-type") || "application/json";
    }
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, { method, headers, body });
  } catch (error: any) {
    console.error("Proxy request to backend failed:", error.message);
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }

  const responseBody = await backendRes.arrayBuffer();
  const contentType = backendRes.headers.get("content-type") || "application/json";
  const responseHeaders: Record<string, string> = { "Content-Type": contentType };
  const disposition = backendRes.headers.get("content-disposition");
  if (disposition) responseHeaders["Content-Disposition"] = disposition;

  return new NextResponse(responseBody, {
    status: backendRes.status,
    headers: responseHeaders
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
