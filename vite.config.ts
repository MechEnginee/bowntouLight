import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// GitHub Pages(프로젝트 사이트)는 https://<user>.github.io/<repo>/ 하위 경로에 배포되므로
// 자산 경로가 깨지지 않도록 base를 레포 이름으로 지정한다.
// 커스텀 도메인을 붙이거나 다른 호스팅(Cloudflare/Netlify 등 루트 배포)으로 옮길 땐 '/'로 바꾸면 된다.
export default defineConfig({
  base: '/bowntouLight/',
  plugins: [react()],
})
