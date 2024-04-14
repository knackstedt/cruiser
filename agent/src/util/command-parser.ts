

// Parses out environment variables, the command, and the rest of the arguments
// from the input string.
const parserRx = /(?<env>(?:(?:[A-Z0-9_-]+)=(?:[A-Z0-9_-]+) )*)(?<cmd>[^ =]+) ?(?<args>.*)/i;

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

    let chunk = '';
    let argList: string[] = [];

    for (let i = 0; i < args.length; i++) {
        const char = args[i];
        // console.log({i, char, args, word: chunk});

        // If the char is a whitespace, commit the word
        if (char == ' ') {
            if (chunk.length > 0)
                argList.push(chunk);
            chunk = '';
        }
        else if (char == '"') {
            // read up to the next " char.
            let j = 0;
            for (j = i+1; args[j] != '"' && j < args.length; j++)
                if (args[j] == '\\') j++;

            // If there is no match, set to -1
            if (args[j] != '"')
                throw new Error("Invalid command");

            chunk += args.slice(i+1, j);
            i = j;
        }
        else if (char == '\'') {
            // read up to the next ' char.
            let j = 0;
            for (j = i + 1; args[j] != "'" && j < args.length; j++)
                if (args[j] == '\\') j++;

            // If there is no match, set to -1
            if (args[j] != "'")
                throw new Error("Invalid command");

            chunk += args.slice(i+1, j);
            i = j;
        }
        else {
            chunk += char;
        }
    }
    if (chunk) argList.push(chunk);

    return {
        command: cmd,
        args: argList,
        env: environment
    }
}

// Test commands
// console.log(ParseCommand('git commit -m "⚛ [automation]\\"\\"asd\\"\\"aasd\\" \\"asdincrement version"'))
