let _url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
if (!_url.startsWith("http")) {
  _url = "https://" + _url;
}
export const API_URL = _url;
