import Command from './command.json'
import Shell from './shell.json'

export const DefaultSchema = { kind: 'command', label: 'Command', schema: Command };

export const Schemas = [
    DefaultSchema,
    { kind: 'shell', label: 'Shell', schema: Shell }
];
