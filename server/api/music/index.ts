import * as express from "express";
import { route, getFilesInFolderFlat } from '../../util';
import fs from "fs-extra";
import { IAudioMetadata, parseFile } from 'music-metadata';
import { Server, Socket } from "socket.io";
import { Level } from 'level';
import { musicdb } from '../../db';

const router = express.Router();

/**
 * Scan the library and build the metadata database.
 */
router.use('/scan', route(async (req, res, next) => {

    const files = await getFilesInFolderFlat(`/home/knackstedt/Music`);

    // Custom JSON replacer to encode buffers as simple objects.
    function replacer(key, value) {
        if (Buffer.isBuffer(value)) return `Buffer[${value.byteLength}]`;
        if (key == "quality") return undefined;
        if (key == "native") return undefined;
        return value;
    }

    let count = 0;
    let dbEntries = [];

    // Iterate through all files.
    for (let i = 0; i < files.length; i++) {
        const f = files[i]
        const file = f.path + f.name;
        const meta: IAudioMetadata = await parseFile(file).catch(e => (null));
        if (!meta) continue;

        let images = [];
        for (let j = 0; j < meta.common.picture?.length; j++) {
            let picture = meta.common.picture[j];
            const type =
                picture.type?.includes("front") && "front" ||
                picture.type?.includes("back") && "back" ||
                "other";
                
            let out = file + "_" + type + "." + picture.format.split('/').pop();
            images.push(out);
            await fs.outputFile(out, picture.data);
        }

        const entry = {
            path: f.path,
            name: f.name,
            duration: meta.format.duration,
            images,
            ...meta,
        };

        // Clear out image buffers from native metadata
        Object.keys(entry.native).forEach(nk => {
            entry.native[nk].forEach(e => {
                if (typeof e.value == "object")
                    e.value.data = undefined;
            })
        });

        // Clear normal picture data.
        entry.common.picture?.forEach(p => {
            p.data = undefined;
        })

        dbEntries.push(entry);

        count++;
    }


    let ids = [];
    for await (const key of musicdb.keys()) {
        ids.push(parseInt(key.split('!').pop()));
    }
    ids = ids.filter(i => i != 'NaN');

    ids.sort();
    let itemId = (parseInt(ids.pop()) + 1) || 1;

    dbEntries.forEach(e => e['_id'] = itemId++);

    let tx = musicdb.batch();

    dbEntries.forEach(e => tx.put(e['_id'], JSON.stringify(e, replacer)));

    await tx.write();

    res.send({ status: "ok", scanned: count });
}));

/**
 * Load the whole music library... (/home/user/Music)
 */
router.use('/library', route(async (req, res, next) => {
    let ids = [];
    for await (const key of musicdb.keys()) {
        ids.push(parseInt(key.split('!').pop()));
    }
    ids = ids.sort();
    ids = ids.filter(i => !Number.isNaN(i));

    let values = await musicdb.getMany(ids);

    res.send(values.map(v => JSON.parse(v)));
}));


export const MusicApi = router;


class MusicLibrary {
    private db: Level;

    constructor(private socket: Socket, opts) {

        this.db = new Level(opts.path + ".db", { valueEncoding: 'json' });
    }

    scanNum = 0;
    isScanning = false;
    async scan(folder: string) {
        if (this.isScanning) {
            this.socket.emit("scanstart-err", new Error("Scan is already running"));
            return;
        }


        this.socket.emit("scanstart");
        let files = await getFilesInFolderFlat(folder);

        let start = Date.now()
        this.socket.emit("scan", this.scanNum = 0);


        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const meta = await parseFile(f.path + f.name).catch(e => (null));

            this.db.put(`meta-${f.path+f.name}`, meta);

            this.socket.emit("scan", this.scanNum+=1);
        }

        this.isScanning = false;
        let duration = Date.now() - start;
        this.socket.emit("scanend", {duration, count: this.scanNum});
    }

    dispose() {
        this.socket.disconnect();
        this.socket._cleanup();
    }
}

export class MusicSocketService {
    constructor(server) {
        const io = new Server(server, { path: "/ws/music.io" });

        // "connection" event happens when any client connects to this io instance.
        io.on("connection", socket => {
            let mlib;
            // Create a new pty service when client connects.
            socket.on("start", (data) => {
                mlib = new MusicLibrary(socket, data);
            });

            socket.on("disconnect", () => {
                mlib.dispose();
            });

            socket.on("scan", input => {
                mlib.scan(input);
            });

            socket.on("resize", data => {
                mlib.resize(data);
            });
        });
    }
}
