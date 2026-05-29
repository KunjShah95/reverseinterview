const DEFAULT_SITE_URL = "http://localhost:5173";

export function getSiteUrl() {
  const siteUrl = import.meta.env.VITE_SITE_URL?.trim();
  if (!siteUrl) return DEFAULT_SITE_URL;
  return siteUrl.replace(/\/+$/, "");
}

export function getAbsoluteUrl(pathname: string) {
  const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getSiteUrl()}${cleanPath}`;
}