export const envSubstitute = (text) =>
    text.replace(/\$\{([^}]+?)\}/g, (match, group) => {
        const [key, placeholder] = group.split('|');
        return process.env[key] || placeholder;
    });
