/** @type {import('next').NextConfig} */
const clean = (val) => (val ? String(val).trim().replace(/^["']|["'],?$|,$/g, '').trim() : '');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: clean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.apiKey),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: clean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.authDomain),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.projectId),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: clean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.storageBucket),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: clean(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.messagingSenderId),
    NEXT_PUBLIC_FIREBASE_APP_ID: clean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.appId),
  },
};

export default nextConfig;
