import { randomBytes } from 'crypto';
import { NextFunction, Request, Response } from "express";
import * as fs from "fs-extra";


export const sleep = ms => new Promise(r => setTimeout(r, ms));

// We use this route to 'throw' an error when an async route has an unhandled exception.
export const route = (fn: (req: Request, res: Response, next: NextFunction) => any) => (req, res, next) => {
    try {
        // @ts-ignore
        fn(req, res, next).catch(ex => next(ex));
    }
    catch(ex) {
        next(ex);
    }
}

export const getFilesInFolder:
    (folder: string, showHidden: boolean, recurse?: number) => Promise<{
        dirs: {
            contents: any,
            path: string,
            name: string,
            kind: "directory"
        }[],
        files: {
            stats: Partial<fs.Stats>,
            path: string,
            name: string,
            ext: string,
            kind: "file"
        }[]
    }>
    = async (folder: string, showHidden = false, recurse = 2) => {
    if (!folder.endsWith('/')) folder += '/';

    const contents = await fs.readdir(folder, { withFileTypes: true }).catch(e => ([]));

    const dirs = await Promise.all(
        contents.filter(f => f.isDirectory())
            .filter(f => !f.name.startsWith('.'))
            .map(async p => ({
                contents: recurse -1 > 0 ? await getFilesInFolder(folder + p.name + '/', showHidden) : null,
                path: folder,
                name: p.name,
                kind: "directory" as "directory"
            }))
    );

    const files = await Promise.all(
        contents.filter(f => f.isFile())
            .filter(f => !f.name.startsWith('.'))
            .map(async p => {
                let stats = await fs.stat(folder + p.name).catch(e => null);

                if (!stats) return null;

                return {
                    stats: {
                        size: stats.size,
                        atimeMs: stats.atimeMs,
                        mtimeMs: stats.mtimeMs,
                        ctimeMs: stats.ctimeMs,
                        birthtimeMs: stats.birthtimeMs
                    },
                    path: folder,
                    name: p.name,
                    ext: p.name.split('.').pop(),
                    kind: "file" as "file"
                }
            })
    ).then(files => files.filter(e => !!e));

    return { dirs, files };
}

export const getFilesInFolderFlat = async (folder: string, showHidden?: boolean, depth: number = 20) => {
    let structured = await getFilesInFolder(folder, showHidden, depth);

    function r_files({dirs, files}) {
        return [
            ...dirs.map(d => r_files(d.contents)).flat(),
            ...files
        ];
    }
    return r_files(structured) as {
        stats: Partial<fs.Stats>,
        path: string,
        name: string,
        ext: string,
        kind: "file";
    }[];
}

export const randomString = (length: number) =>
    randomBytes(length/2).toString('hex');
