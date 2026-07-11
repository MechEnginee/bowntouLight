# Worship Lighting Sim

React + TypeScript + Vite + Three.js 로 만든 클라이언트 사이드 조명 시뮬레이터입니다.
백엔드/DB가 없는 순수 정적 앱이라 정적 호스팅 어디서든 무료로 배포할 수 있습니다.

## 로컬 실행

```bash
yarn install
yarn dev      # 개발 서버
yarn build    # 프로덕션 빌드 → dist/
yarn preview  # 빌드 결과 미리보기
```

## 배포 (GitHub Pages — 무료)

`main` 브랜치에 푸시하면 `.github/workflows/deploy.yml` 이 자동으로 빌드·배포합니다.

**최초 1회 설정** (GitHub 웹에서):

1. 레포 → **Settings → Pages** 이동
2. **Build and deployment → Source** 를 **GitHub Actions** 로 선택
3. `main` 에 푸시하거나 Actions 탭에서 워크플로를 수동 실행

배포 주소: `https://mechenginee.github.io/bowntouLight/`

> 자산 경로 때문에 `vite.config.ts` 의 `base` 가 `/bowntouLight/` 로 설정되어 있습니다.
> 커스텀 도메인을 붙이거나 Cloudflare Pages / Netlify 등 루트(`/`)에 배포하는 호스팅으로
> 옮길 땐 `base` 를 `'/'` 로 바꾸면 됩니다.

---

## Vite 템플릿 참고

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```
