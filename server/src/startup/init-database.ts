import fs from 'fs/promises';
import { db } from '../util/db';

/**
 * This script is executed once upon startup to populate the database.
 */

export const InitDatabase = async () => {

    // Insert the builtin task definitions as immutable.
    if (false) {
        const contents = await fs.readdir(__dirname + "/../tasks/", { withFileTypes: true });

        // Collect all files that end in .ts and do not start with _.
        const scripts = contents.filter(c => c.isFile() && c.name.endsWith(".ts") && !c.name.startsWith('_'));

        const tasks = await Promise.all(scripts.map(async s =>
            fs.readFile(s.path + '/' + s.name, 'utf8')
            .then(data => JSON.parse(data))
            .then(data => {
                data.immutable = true;
                return data as {};
            })
        ));

        // Replace all of the builtin tasks.
        await db.query("DELETE task_definition WHERE immutable = true");

        await Promise.all(tasks.map(t => db.insert("task_definition", t)));
    }
}
