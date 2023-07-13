type PngChunk = {
  name: 'IHDR' | 'IDAT' | 'IEND' | 'tEXt';
  data: Uint8Array;
};

declare module 'png-chunks-extract' {
  export default function pngExtract(data: Uint8Array): Array<PngChunk>;
}

declare module 'png-chunks-encode' {
  export default function pngEncode(chunks: Array<PngChunk>): Uint8Array;
}

declare module 'png-chunk-text' {
  export function encode(key: string, value: string): PngChunk;
  export function decode(data: Uint8Array): {
    keyword: string;
    text: string;
  };
}
