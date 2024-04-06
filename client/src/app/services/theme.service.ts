import { Injectable } from '@angular/core';
import { RGBValues } from 'ansicolor';
import { ITheme } from 'xterm';



export const darkTheme: RGBValues = {
    black:        [ 0x1F, 0x1F, 0x1F],
    darkGray:     [ 0x39, 0x3F, 0x3D],
    lightBlue:    [ 0x62, 0x72, 0xA4],
    lightCyan:    [ 0x8B, 0xE9, 0xFD],
    lightGreen:   [ 0x8B, 0xE9, 0xFD],
    lightMagenta: [ 0xFF, 0x79, 0xC6],
    lightRed:     [ 0xFF, 0xB8, 0x6C],
    lightYellow:  [ 0xF1, 0xFA, 0x8C],
    white:        [ 0xD7, 0xFE, 0xF4],
    blue:         [ 0x62, 0x72, 0xA4],
    cyan:         [ 0x8B, 0xE9, 0xFD],
    green:        [ 0x50, 0xFA, 0x7B],
    magenta:      [ 0xFF, 0x79, 0xC6],
    red:          [ 0xFF, 0x55, 0x55],
    lightGray:    [ 0xBD, 0xDE, 0xD6],
    yellow:       [ 0xF1, 0xFA, 0x8C],
}

function tupleToHex([r,g,b]: [number, number, number]) {
    return `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`;
}

export const AnsiToXTermTheme = (theme: RGBValues) => {

    const out: ITheme = {
        black:         tupleToHex(theme.black),
        brightBlack:   tupleToHex(theme.darkGray),
        red:           tupleToHex(theme.red),
        brightRed:     tupleToHex(theme.lightRed),
        green:         tupleToHex(theme.green),
        brightGreen:   tupleToHex(theme.lightGreen),
        yellow:        tupleToHex(theme.yellow),
        brightYellow:  tupleToHex(theme.lightYellow),
        blue:          tupleToHex(theme.blue),
        brightBlue:    tupleToHex(theme.lightBlue),
        magenta:       tupleToHex(theme.magenta),
        brightMagenta: tupleToHex(theme.lightMagenta),
        cyan:          tupleToHex(theme.cyan),
        brightCyan:    tupleToHex(theme.lightCyan),
        white:         tupleToHex(theme.lightGray),
        brightWhite:   tupleToHex(theme.white),
    };

    return out;
}

@Injectable({
    providedIn: "root"
})
export class ThemeService {
    constructor(

    ) {

    }
}
