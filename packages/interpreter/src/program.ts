import { InpaFile } from "@inpax/core";

export class Program {
    private readonly _file: InpaFile;

    constructor(file: InpaFile) {
        this._file = file;
    }

    get file(): InpaFile {
        return this._file;
    }

    get code(): Buffer {
        return this._file.buffer;
    }
}
