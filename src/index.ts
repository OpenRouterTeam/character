import { load } from 'exifreader';
import json5 from 'json5';
import { decode } from 'png-chunk-text';
import pngEncode from 'png-chunks-encode';
import pngExtract from 'png-chunks-extract';

function assertUnreachable(_: never): never {
  throw new Error('Statement should be unreachable');
}

export type CharacterMetadata = {
  alternate_greetings: any[];
  avatar: string;
  character_book: null | string;
  character_version: string;
  chat: string;
  create_date: string;
  creator: string;
  creator_notes: string;
  description: string;
  extensions: {
    chub: {
      expressions: null | string;
      full_path: string;
      id: number;
      related_lorebooks: any[];
    };
    fav: boolean;
    talkativeness: string;
  };
  first_mes: string;
  mes_example: string;
  name: string;
  personality: string;
  post_history_instructions: string;
  scenario: string;
  system_prompt: string;
  tags: string[];
  char_greeting: string;
  example_dialogue: string;
  world_scenario: string;
  char_persona: string;
  char_name: string;
};

const VALID_FILE_TYPES = [
  'application/json',
  'image/png',
  'image/webp'
] as const;

type ValidCharacterFileType = (typeof VALID_FILE_TYPES)[number];

const VALID_FILE_EXTENSIONS = VALID_FILE_TYPES.map(
  (type) => `.${type.split('/')[1]}`
);

const INPUT_ACCEPT = VALID_FILE_EXTENSIONS.join(', ');

export class Character {
  static INPUT_ACCEPT = INPUT_ACCEPT;

  constructor(
    public metadata: CharacterMetadata,
    private fallbackAvatar = ''
  ) {}

  get avatar() {
    if (!!this.metadata.avatar && this.metadata.avatar !== 'none') {
      return this.metadata.avatar;
    } else {
      return this.fallbackAvatar;
    }
  }

  get description() {
    return this.metadata.system_prompt || this.metadata.description || '';
  }

  get name() {
    return this.metadata.name || this.metadata.char_name || '';
  }

  // Adapted from: https://github.com/SillyTavern/SillyTavern/blob/2befcd87124f30e09496a02e7ce203c3d9ba15fd/src/character-card-parser.js
  static async fromFile(file: File): Promise<Character> {
    const fileType = file.type as ValidCharacterFileType;

    switch (fileType) {
      case 'application/json': {
        const rawText = await file.text();
        return new Character(JSON.parse(rawText));
      }
      case 'image/png': {
        // work with v1/v2?
        const rawBuffer = await file.arrayBuffer();

        const chunks = pngExtract(new Uint8Array(rawBuffer));

        const extChunk = chunks
          .filter((chunk) => chunk.name === 'tEXt')
          .map((d) => decode(d.data))
          .find((d) => d.keyword === 'chara');

        if (!extChunk) {
          throw new Error('No character data found!');
        }

        const card = JSON.parse(
          Buffer.from(extChunk.text, 'base64').toString('utf8')
        );

        const pngChunks = chunks.filter((chunk) => chunk.name !== 'tEXt');
        const base64Avatar = `data:image/png;base64,${Buffer.from(
          pngEncode(pngChunks)
        ).toString('base64')}`;

        if (card.spec_version === '2.0') {
          return new Character(card.data, base64Avatar);
        }

        return new Character(card, base64Avatar);
      }
      case 'image/webp': {
        const rawBuffer = await file.arrayBuffer();

        const exifData = load(rawBuffer);

        const base64Avatar = `data:image/webp;base64,${Buffer.from(
          rawBuffer
        ).toString('base64')}`;

        if (exifData['UserComment']?.['description']) {
          const description = exifData['UserComment']['description'];

          if (description !== 'Undefined') {
            return new Character(json5.parse(description), base64Avatar);
          }

          if (
            exifData['UserComment'].value &&
            exifData['UserComment'].value.length === 1
          ) {
            // silly's way to store json data in webp exif
            const _temp = exifData['UserComment'].value as unknown as string[];
            const data = _temp[0];

            if (!!data) {
              const utf8Decoder = new TextDecoder('utf-8', { ignoreBOM: true });
              try {
                const card = json5.parse(data);
                return new Character(card, base64Avatar);
              } catch {
                const byteArr = data.split(',').map(Number);
                const uint8Array = new Uint8Array(byteArr);
                const utf8Data = utf8Decoder.decode(uint8Array);
                const card = json5.parse(utf8Data);
                return new Character(card, base64Avatar);
              }
            }
          }
        }

        throw new Error('No character data found!');
      }
      default: {
        assertUnreachable(fileType);
      }
    }
  }
}
