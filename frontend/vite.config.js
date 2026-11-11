import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // 데모 빌드(VITE_DEMO=true)는 GitHub Pages 하위 경로(/gyeongja-pt/)에 올라간다.
  const DEMO = loadEnv(mode, process.cwd(), 'VITE_').VITE_DEMO === 'true';
  const base = DEMO ? '/gyeongja-pt/' : '/';

  return {
  base,
  // 투자 권유 필터(../shared)를 서버와 함께 쓰므로 개발 서버가 frontend 밖 파일을 읽도록 허용한다.
  server: { fs: { allow: ['..'] } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: '경자피티',
        short_name: '경자피티',
        description: '쇼츠에서 본 경제 뉴스, 내 지갑엔 얼마?',
        lang: 'ko',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      }
    })
  ]
  };
});
