import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { useSceneStore } from './store/scene-store'
import { useAudioStore } from './store/audio-store'
import './index.css'

// 개발 모드에서만 스토어를 window에 노출 (E2E/디버깅용). 프로덕션 번들엔 포함되지 않는다.
if (import.meta.env.DEV) {
  const w = window as unknown as { __sceneStore?: typeof useSceneStore; __audioStore?: typeof useAudioStore }
  w.__sceneStore = useSceneStore
  w.__audioStore = useAudioStore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
