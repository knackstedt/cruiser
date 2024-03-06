import AdmZip from "adm-zip";

// TODO: support reading subfolders!
export const readZipFolder = (absPath: string, subpath = '') => {
    absPath = absPath.replace(/\/{2,}/g, '/'); // collapse extra slashes
    subpath = subpath.replace(/\/{2,}/g, '/');
    const zip = new AdmZip(absPath);
    const zipEntries = zip.getEntries();

    const zipName = absPath.split('/').pop().replace(/\.zip$/, '');

    const out = {
        dirs: [],
        files: []
    };

    const localPath = zipName + '/' + subpath;
    const subpathMatcher = new RegExp('[' + subpath.split('').join('][') + ']\/?');

    function filterLocalPath(entry: AdmZip.IZipEntry) {
        // Omit anything that's in a different directory altogether
        if (!entry.entryName.startsWith(subpath)) return false;

        // Skip if the entry is the item selected from the subpath
        if (entry.entryName.replace(subpath, '').length <= 1) return false;

        // Check if the entry is the root file
        // if (entry.isDirectory && entry.entryName != (localPath + '/')) return false;

        // Check if the file is nested deeper than we're looking
        const local = entry.entryName.replace(subpathMatcher, '');
        if (!local || local.split('/').filter(e => e).length > 1) return false;

        return true;
    }

    zipEntries
        .filter(e => e.isDirectory)
        .filter(e => filterLocalPath(e))
        .forEach(e => {
            let path = absPath + "#/" + e.entryName.split('/').slice(0, -2).join('/') + '/';
            path = path.replace(/\/{2,}/g, '/');

            out.dirs.push({
                path: path,
                name: e.entryName.split('/').slice(-2, -1)[0],
                kind: "directory",
                comment: e.comment,
                entry: e.entryName
            });
        });

    zipEntries
        .filter(e => !e.isDirectory)
        .filter(e => filterLocalPath(e))
        .forEach(e => {
            let path = absPath + "#/" + e.entryName.split('/').slice(0, -1).join('/');
            path = path.replace(/\/{2,}/g, '/');

            out.files.push({
                kind: "file",
                path: path,
                name: e.name,
                ext: e.name.split('.').pop(),
                stats: {
                    size: e.header.size,
                    compressedSize: e.header.compressedSize,
                    mtimeMs: e.header.time.getTime(),
                    atimeMs: e.header.time.getTime(),
                    ctimeMs: e.header.time.getTime()
                }
            });
        });

    return out;
};
