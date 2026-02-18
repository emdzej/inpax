import { SectionHeader } from "@inpax/core";

export type ParseResult<T> = {
    readonly result: T;
    readonly offset: number;
};

export type ParseFunction<T extends SectionHeader> = (buffer: Uint8Array, startOffset: number) => ParseResult<T>;

