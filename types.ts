
export interface AppState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
}

export enum ModelType {
  FLASH = 'gemini-3-flash-preview',
  PRO = 'gemini-3-pro-preview',
  IMAGE = 'gemini-2.5-flash-image',
  AUDIO = 'gemini-2.5-flash-native-audio-preview-12-2025'
}
