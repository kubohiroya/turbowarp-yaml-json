import type { FixedInputEditorOptions, JsonValue, LiteralValue } from '@kubohiroya/turbowarp-extension-data-editor';
/** Legacy nonempty finite aliases are projections; opening never creates a write. */
export declare function existingFixedNumber(value: JsonValue | LiteralValue): number;
export declare const fixedInputEditors: readonly FixedInputEditorOptions[];
/**
 * Registration follows the advertised opcode membership and the optional host capability.
 * Loading a project disposes the runtime, which releases the registrations, but the extension
 * stays loaded for the next project: they are registered again once that project has loaded.
 * Only the owner's dispose is final.
 */
export declare function fixedInputRegistration(scratch: unknown): {
    ensure(visibleOpcodes: readonly string[]): void;
    dispose: () => void;
};
