import { AluOpCode, Instruction} from "../parser/types.js";
import { State } from "./types.js";

type AluHandler = (instruction: Instruction, state: State) => void;

type AluHandlers = {
    [opcode in AluOpCode]?: AluHandler;
}

/*
ADD: 0x60,
    SUB: 0x61,
    MUL: 0x62,
    DIV: 0x63,
    LT: 0x64,
    GT: 0x65,
    LE: 0x66,
    GE: 0x67,
    EQ: 0x68,
    NE: 0x69,
    AND: 0x6A,
    OR: 0x6B,
    NOT: 0x6E,
*/

function aluAdd(instruction: Instruction, state: State): void {

}

function aluSub(instruction: Instruction, state: State): void {

}

function aluMul(instruction: Instruction, state: State): void {

}

function aluDiv(instruction: Instruction, state: State): void {

}

function aluLt(instruction: Instruction, state: State): void {

}

function aluGt(instruction: Instruction, state: State): void {

}

function aluLe(instruction: Instruction, state: State): void {

}

function aluGe(instruction: Instruction, state: State): void {

}

function aluEq(instruction: Instruction, state: State): void {

}

function aluNe(instruction: Instruction, state: State): void {

}

function aluAnd(instruction: Instruction, state: State): void {

}

function aluOr(instruction: Instruction, state: State): void {

}

function aluNot(instruction: Instruction, state: State): void {

}


const aluHandlers: AluHandlers = {

};

export function alu(instruction: Instruction, state: State): void {

}
