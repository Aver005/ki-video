// Модель проекта. Общая для сервера и интерфейса: одна математика для превью и экспорта.

export type Id = string;

export type VideoCodec = "h264" | "hevc";

export interface OutputSpec {
  width: number;
  height: number;
  fps: number;
  codec: VideoCodec;
  /** Качество кодека: CQ/CRF, 0..51, меньше — лучше. */
  quality: number;
}

/** Ключевой кадр окна кадрирования: центр в пикселях исходника и зум (>= 1). */
export interface FrameKeyframe {
  /** Секунды от начала клипа. */
  t: number;
  cx: number;
  cy: number;
  zoom: number;
}

export type FrameState = Omit<FrameKeyframe, "t">;

export interface Clip {
  id: Id;
  assetId: Id;
  /** Секунды внутри исходного файла. */
  in: number;
  out: number;
  /** Отсортированы по t. Пустой список — окно по центру без зума. */
  frame: FrameKeyframe[];
}

export interface ColorGrade {
  /** -1..1 */
  brightness: number;
  /** 0..2, нейтраль 1 */
  contrast: number;
  /** 0..3, нейтраль 1 */
  saturation: number;
  /** 0.1..10, нейтраль 1 */
  gamma: number;
  /** -2..2, нейтраль 0 */
  vibrance: number;
  /** 0..3, нейтраль 0 */
  sharpen: number;
}

export interface AudioChain {
  /** 0..1, 0 — выключено */
  denoise: number;
  highpass: boolean;
  compressor: boolean;
  /** Целевая громкость LUFS, 0 — выключено */
  loudness: number;
}

export type TextAnimation = "none" | "fade" | "pop";

export interface TextLayer {
  id: Id;
  text: string;
  start: number;
  end: number;
  /** Позиция центра, доли от ширины/высоты кадра, 0..1. */
  x: number;
  y: number;
  /** Кегль в пикселях кадра экспорта. */
  size: number;
  color: string;
  outline: string;
  animation: TextAnimation;
}

export interface SubtitleCue {
  id: Id;
  start: number;
  end: number;
  text: string;
}

export type SubtitlePreset = "bold" | "clean" | "yellow";

export interface Subtitles {
  preset: SubtitlePreset;
  /** Позиция строки по вертикали, доля высоты кадра. */
  y: number;
  cues: SubtitleCue[];
}

export interface Project {
  version: 1;
  id: Id;
  name: string;
  output: OutputSpec;
  clips: Clip[];
  color: ColorGrade;
  audio: AudioChain;
  texts: TextLayer[];
  subtitles: Subtitles;
}

export type AssetStatus = "processing" | "ready" | "error";

export interface MediaAsset {
  id: Id;
  name: string;
  path: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  videoCodec: string;
  audioCodec: string | null;
  status: AssetStatus;
  error?: string;
  /** Размер прокси-видео, чтобы пересчитывать координаты окна. */
  proxy?: { width: number; height: number };
  thumbs?: { count: number; fps: number };
  /** Пики громкости 0..255, PEAKS_PER_SECOND значений в секунду. */
  peaks?: number[];
}

export const PEAKS_PER_SECOND = 50;

export const DEFAULT_OUTPUT: OutputSpec = { width: 1080, height: 1920, fps: 60, codec: "h264", quality: 23 };

export const NEUTRAL_COLOR: ColorGrade = {
  brightness: 0,
  contrast: 1,
  saturation: 1,
  gamma: 1,
  vibrance: 0,
  sharpen: 0,
};

export const SILENT_AUDIO: AudioChain = { denoise: 0, highpass: false, compressor: false, loudness: 0 };

export function createProject(id: Id, name = "Без названия"): Project {
  return {
    version: 1,
    id,
    name,
    output: { ...DEFAULT_OUTPUT },
    clips: [],
    color: { ...NEUTRAL_COLOR },
    audio: { ...SILENT_AUDIO },
    texts: [],
    subtitles: { preset: "bold", y: 0.8, cues: [] },
  };
}
