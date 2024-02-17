import Surreal from 'surrealdb.js';
import fs from 'fs-extra';

const getDirectories = async source =>
    (await fs.readdir(source, { withFileTypes: true }))
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
const getFiles = async source =>
    (await fs.readdir(source, { withFileTypes: true }))
        .filter(dirent => dirent.isFile())
        .map(dirent => dirent.name)

export const sleep = ms => new Promise(r => setTimeout(r, ms));

const db = new Surreal();

(async () => {

    // Select the right directory.
    if (!process.cwd().endsWith('database'))
        process.chdir("database");

    console.log("\x1b[1;36mConnecting to Surreal...");
    await db.connect(process.env['SURREAL_URL'] || 'http://127.0.0.1:8000/rpc');

    await db.signin({
        username: process.env['SURREAL_USER'] || 'root',
        password: process.env['SURREAL_PASSWORD'] || 'root',
    });

    await db.query(await fs.readFile("01-database/database.surql", "utf8"))
    await db.use({ namespace: 'dotglitch', database: 'dotops' });


    console.log("\x1b[1;36mConnected to Surreal");
    const dirs = await getDirectories('.');

    let errors = 0;

    for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i];
        console.log("\x1b[1;36m Begin applying " + dir);
        const files = await getFiles(dir);

        await Promise.all(
            files
                .filter(f => f.endsWith(".surql"))
                .map(async f => {
                    const text = await fs.readFile(dir + '/' + f, "utf-8");
                    return db.query(text.trim())
                            .then(e => console.log("\x1b[1;30m    Applied ", f))
                            .catch(e => { errors++; console.error("\x1b[1;31m    Failed to apply '" + f + "'\n        : " + e.message) })
                    }
                )
        )

        console.log("\x1b[1;36m End applying " + dir);
    }

    console.log("\x1b[1;36m Done applying database template.");
    if (errors > 0)
        console.error(`\x1b[1;31m There were ${errors} errors.`);

    process.exit();
})();
