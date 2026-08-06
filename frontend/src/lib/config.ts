/**
 * Public application URL (Cloudflare Tunnel / ngrok / production domain).
 *
 * The attendance QR code is generated server-side by the backend using
 * PUBLIC_APP_URL (see backend/.env). This frontend value is available for
 * displaying/sharing attendance links from the UI.
 */
export const PUBLIC_APP_URL: string = import.meta.env.VITE_PUBLIC_APP_URL ?? '';
