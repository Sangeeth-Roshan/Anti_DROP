import React, { createContext, useContext, useState } from 'react'
import type { UploadContext } from './types'

interface AppContextValue {
  upload: UploadContext
  setUpload: (u: UploadContext) => void
}

const DEFAULT_UPLOAD: UploadContext = {
  upload_id: 'default',
  label:     'Default Dataset',
  total:     0,
}

const AppContext = createContext<AppContextValue>({
  upload:    DEFAULT_UPLOAD,
  setUpload: () => {},
})

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [upload, setUpload] = useState<UploadContext>(DEFAULT_UPLOAD)
  return (
    <AppContext.Provider value={{ upload, setUpload }}>
      {children}
    </AppContext.Provider>
  )
}

export function useUpload() {
  return useContext(AppContext)
}
