

// Parses out environment variables, the command, and the rest of the arguments
// from the input string.
const parserRx = /(?<env>(?:(?:[A-Z0-9_-]+)=(?:[A-Z0-9_-]+) )+)(?<cmd>[^ =]+) (?<args>.+)/i;

/**
 * echo foo
 * echo foo bar
 * VARIABLE1=FOOBAR echo foo
 * echo foo "bar baz"
 * echo foo 'bar baz'
 */
export const ParseCommand = (commandInput: string) => {
    commandInput = commandInput.replace(/[\n]/g, '');

    const { env, cmd, args } = commandInput.match(parserRx)?.groups ?? {};

    if (!cmd) {
        throw new Error("No command specified.");
    }

    const environment = env.split(/\s+/) // split whitespace
        .map(set => set.split('='))      // split the equals
        .map(set => ({ [set[0]]: set[1] })) // make it an object
        .reduce((a, b) => ({ ...a, ...b}), {}); // merge the objects into one

    let word = '';
    let argList: string[] = [];

    for (let i = 0; i < args.length; i++) {
        const char = args[i];

        // If the char is a whitespace, commit the word
        if (char == ' ') {
            if (word.length > 0)
                argList.push(word);
            word = '';
        }
        else if (char == '"') {
            // read up to the next " char.
            const tOff = args.indexOf('"', i);

            if (tOff == -1)
                throw new Error("Invalid command");

            word += args.slice(i, tOff);
            i = tOff;
        }
        else if (char == '\'') {
            // read up to the next ' char.
            const tOff = args.indexOf('\'', i);

            if (tOff == -1)
                throw new Error("Invalid command");

            word += args.slice(i, tOff);
            i = tOff;
        }
        else {
            // This is a normal argument (at least we'll assume so.)
            const tOff = args.indexOf(' ', i);

            // This can terminate the command string, we don't care.
            word += args.slice(i, tOff == -1 ? 0 : tOff);
            i = tOff;
        }
    }

    return {
        command: cmd,
        args: argList,
        env: environment
    }
}
