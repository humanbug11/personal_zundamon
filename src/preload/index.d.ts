import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getDesktopSources: () => Promise<{ id: string, name: string }[]>
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward: true }) => void
      moveWindow: (offset: { x: number, y: number }) => void
    }
  }
}
