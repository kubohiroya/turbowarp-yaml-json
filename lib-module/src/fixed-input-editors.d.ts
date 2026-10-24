import type { FixedInputEditorOptions, JsonValue, LiteralValue } from '@kubohiroya/turbowarp-extension-data-editor';
/** Legacy nonempty finite aliases are projections; opening never creates a write. */
export declare function existingFixedNumber(value: JsonValue | LiteralValue): number;
export declare const fixedInputEditors: readonly FixedInputEditorOptions[];
/** Registration follows the advertised opcode membership and the optional host capability. */
export declare function fixedInputRegistration(scratch: unknown): {
    ensure(visibleOpcodes: readonly string[]): void;
    dispose: () => void;
};
