/// <reference types="vite/client" />

interface Window {
  api: {
    getDesktopSources: () => Promise<{ id: string; name: string }[]>
    setIgnoreMouseEvents: (ignore: boolean, options?: { forward: true }) => void
    moveWindow: (offset: { x: number, y: number }) => void
  }
}

declare module '*.png' {
  const content: string
  export default content
}
