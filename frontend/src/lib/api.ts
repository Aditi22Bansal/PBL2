let _url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
if (!_url.startsWith("http")) {
  _url = "https://" + _url;
}
export const API_URL = _url;

// Authenticated calls (admin/dashboard/chat/change-request) go through this
// same-origin Next.js proxy instead of API_URL directly, so the real NextAuth
// session gets verified server-side and a trusted X-User-Email header is
// attached before the request ever reaches the Node backend. See
// frontend/src/app/api/proxy/[...path]/route.ts.
export const PROXY_URL = "/api/proxy";
