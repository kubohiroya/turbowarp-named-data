interface TurboWarpExtension {
  getInfo(): Record<string, unknown>;
}

interface ScratchTranslate {
  (text: string): string;
  (message: {default: string; description?: string}, placeholders?: Record<string, string | number>): string;
}

interface ScratchApi {
  extensions: {
    unsandboxed: boolean;
    register(extension: TurboWarpExtension): void;
  };
  vm: {
    runtime: ScratchRuntime;
  };
  BlockType: Record<'COMMAND' | 'REPORTER' | 'BOOLEAN' | 'HAT', string>;
  ArgumentType: Record<'STRING' | 'NUMBER' | 'BOOLEAN', string>;
  Cast: {
    toString(value: unknown): string;
    toNumber(value: unknown): number;
    toBoolean(value: unknown): boolean;
  };
  translate: ScratchTranslate;
}

declare const Scratch: ScratchApi;

interface ScratchRuntime {
  on(event: string, listener: () => void): void;
  off?(event: string, listener: () => void): void;
}

interface NamedDataFeatureFlagConfiguration {
  NAMED_DATA_REGISTRY_MVP?: boolean | 'true' | 'false';
}

// eslint-disable-next-line no-var
declare var __TW_NAMED_DATA_FEATURE_FLAGS__: NamedDataFeatureFlagConfiguration | undefined;
