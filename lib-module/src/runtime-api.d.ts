export interface TurboWarpExtension {
    getInfo(): Record<string, unknown>;
}
export interface ScratchTranslate {
    (text: string): string;
    (message: {
        default: string;
        description?: string;
    }, placeholders?: Record<string, string | number>): string;
}
export interface ScratchApi {
    extensions: {
        unsandboxed: boolean;
        register(extension: TurboWarpExtension): void;
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
export interface ExtensionModuleMetadata {
    readonly formatVersion: 1;
    readonly id: string;
    readonly unsandboxed: 'required' | 'optional' | 'not-needed';
}
