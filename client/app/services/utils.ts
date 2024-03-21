import { MatDialog } from '@angular/material/dialog';

/**
 * Wait for a speficied amount of time to pass
 * @param ms time in ms to sleep for
 * @returns
 */
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export const orderSort = (a, b) => {
    if (typeof a.order != 'number') return 1;
    if (typeof b.order != 'number') return -1;
    return a.order - b.order;
};

/**
 * Helper to update the page URL.
 * @param page component page ID to load.
 * @param data string or JSON data for query params.
 */
export const updateUrl = (page?: string, data: string | string[][] | Record<string, string | number> | URLSearchParams = {}, replaceState = false) => {
    const [oldHash, qstring] = location.hash.split('?');

    if (!page)
        page = oldHash.split('/')[1];

    const hash = `#/${page}`;

    // Convert the data object to JSON.
    if (data instanceof URLSearchParams) {
        data = [...data.entries()].map(([k, v]) => ({ [k]: v })).reduce((a, b) => ({ ...a, ...b }), {});
    }

    const query = new URLSearchParams(data as any);
    const prevParams = new URLSearchParams(qstring);

    // If the hash is the same, retain params.
    if (hash == oldHash) {
        replaceState = true;
        for (const [key, value] of prevParams.entries())
            if (!query.has(key))
                query.set(key, prevParams.get(key));
    }

    // @ts-ignore
    for (const [key, val] of query.entries()) {
        if (
            val == null ||
            val == undefined ||
            val == '' ||
            val == 'null' ||
            Number.isNaN(val) ||
            val == 'NaN'
        )
            query.delete(key);
    }

    if (!(hash.toLowerCase() == "#/frame") || data['id'] == -1)
        query.delete('id');


    const strQuery = query.toString();
    console.log(data, hash, strQuery);
    if (replaceState) {
        window.history.replaceState(data, '', hash + (strQuery ? ('?' + strQuery) : ''));
    }
    else {
        window.history.pushState(data, '', hash + (strQuery ? ('?' + strQuery) : ''));
    }
};

export const getUrlData = (source = window.location.hash) => {
    const [hash, query] = source.split('?');
    let data = new URLSearchParams(query);
    return [...data.entries()].map(([k, v]) => ({ [k]: v })).reduce((a, b) => ({ ...a, ...b }), {});
};


export const Logger = (context: string, contextColor: string, textColor: string = "#03a9f4") => ({
    log: (message, ...args) => {
        console.log(`%c[${context}] %c${message}`, 'color: ' + contextColor, 'color: ' + textColor, ...args);
    },
    warn: (message, ...args) => {
        console.warn(`%c[${context}] %c${message}`, 'color: ' + contextColor, 'color: ' + textColor, ...args);
    },
    err: (message, ...args) => {
        console.error(`%c[${context}] %c${message}`, 'color: ' + contextColor, 'color: ' + textColor, ...args);
    },
    error: (message, ...args) => {
        console.error(`%c[${context}] %c${message}`, 'color: ' + contextColor, 'color: ' + textColor, ...args);
    }
});

export const ViewJsonInMonacoDialog = async (matDialog: MatDialog, data: Object) => {
    const VscodeComponent = await import("@dotglitch/ngx-common").then(m => m.VscodeComponent);

    const d = matDialog.open(VscodeComponent, {
        width: "90vw",
        height: "90vh"
    });
    d.componentInstance.tabSize = 4;
    d.componentInstance.language = "json";
    d.componentInstance.code = JSON.stringify(data, null, 4);

    return d;
};
