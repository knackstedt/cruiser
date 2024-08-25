export type CruiserSettings = {
    // All environment variables
    environmentVars: {
        key: string,
        value: string,
        immutable: boolean;
    }[],
    // Actual settings that were consumed
    settings: {
        key: string,
        value: string,
        immutable: boolean;
    }[];
}
