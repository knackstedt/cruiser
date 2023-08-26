// Rewritten version of https://github.com/secure-rm/core

import fs from "fs-extra";
import glob from 'glob';
import crypto from 'crypto';

const passes = [
    '\x55',           /* 5  RLL MFM */
    '\xaa',           /* 6  RLL MFM */
    '\x92\x49\x24',   /* 7  RLL MFM */
    '\x49\x24\x92',   /* 8  RLL MFM */
    '\x24\x92\x49',   /* 9  RLL MFM */
    '\x00',           /* 10 RLL     */
    '\x11',           /* 11 RLL     */
    '\x22',           /* 12 RLL     */
    '\x33',           /* 13 RLL     */
    '\x44',           /* 14 RLL     */
    '\x55',           /* 15 RLL     */
    '\x66',           /* 16 RLL     */
    '\x77',           /* 17 RLL     */
    '\x88',           /* 18 RLL     */
    '\x99',           /* 19 RLL     */
    '\xaa',           /* 20 RLL     */
    '\xbb',           /* 21 RLL     */
    '\xcc',           /* 22 RLL     */
    '\xdd',           /* 23 RLL     */
    '\xee',           /* 24 RLL     */
    '\xff',           /* 25 RLL     */
    '\x92\x49\x24',   /* 26 RLL MFM */
    '\x49\x24\x92',   /* 27 RLL MFM */
    '\x24\x92\x49',   /* 28 RLL MFM */
    '\x6d\xb6\xdb',   /* 29 RLL     */
    '\xb6\xdb\x6d',   /* 30 RLL     */
    '\xdb\x6d\xb6'    /* 31 RLL     */
];


export const secureWipe = (files: string | string[], unlink = true) => {
    return _getFileMatches(files)
        .then((files) => files.map(file => _wipeFile(file, unlink)));
};

const _getFileMatches = (files) => {

    return new Promise((resolve, reject) => {
        if (files instanceof Array) {
            return resolve(files);
        }
        return glob(files).then(matches => {
            return resolve(matches);
        })
        .catch(err => reject(err));
    }) as Promise<string[]>;
};


const _wipeFile = (file: string, unlink = true) => {
    return fs.stat(file)
        .then(stats => {

            let noBytes = stats.size,
                randomPasses = [],
                allPasses = [],
                shuffledPasses = passes.map(p => passes[Math.round(Math.random() * passes.length)]);

            for (let i = 0; i < 7; i++) {

                randomPasses.push(crypto.randomBytes(noBytes));
            }

            allPasses = [...randomPasses.slice(0, 3), ...shuffledPasses, ...randomPasses.slice(4, 7)];

            return Promise.all(
                allPasses.map(pass => _applyPass(file, noBytes, pass))
            )
                .then(() => {
                    if (unlink) {
                        fs.unlink(file);
                    }
                    return file;
                })
                .catch(err => { throw err; });
        });
};

const _applyPass = (file: string, noBytes: number, pass: string | Buffer) => {

    return new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(file, { flags: 'w' });

        const buf = Buffer.isBuffer(pass)
            ? pass
            : (Buffer.alloc(noBytes, pass));

        ws.on("close", () => resolve(fs.writeFile(file, '')));

        ws.write(buf);
    })
};
