import * as cp from 'child_process';
import * as fs from 'fs';
import { decode, encodingExists } from 'iconv-lite';
import * as path from 'path';

const DRIVE_LETTER_PATH_REGEX = /^[a-z]:\//;
const EOL_REGEX = /\r\n|\r|\n/g;
const INVALID_BRANCH_REGEXP = /^\(.* .*\)$/;
const REMOTE_HEAD_BRANCH_REGEXP = /^remotes\/.*\/HEAD$/;
const GIT_LOG_SEPARATOR = 'XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb';

export const enum GitConfigKey {
    DiffGuiTool = 'diff.guitool',
    DiffTool = 'diff.tool',
    RemotePushDefault = 'remote.pushdefault',
    UserEmail = 'user.email',
    UserName = 'user.name'
}


/**
 * Interfaces Git Graph with the Git executable to provide all Git integrations.
 */
export class DataSource {
    private gitExecutable!: GitExecutable | null;
    private gitExecutableSupportsGpgInfo!: boolean;
    private gitFormatCommitDetails!: string;
    private gitFormatLog!: string;
    private gitFormatStash!: string;

    /**
     * Creates the Git Graph Data Source.
     * @param gitExecutable The Git executable available to Git Graph at startup.
     * @param onDidChangeGitExecutable The Event emitting the Git executable for Git Graph to use.
     * @param logger The Git Graph Logger instance.
     */
    constructor(gitExecutable: GitExecutable | null) {
        this.setGitExecutable(gitExecutable);
    }

    /**
     * Check if the Git executable is unknown.
     * @returns TRUE => Git executable is unknown, FALSE => Git executable is known.
     */
    public isGitExecutableUnknown() {
        return this.gitExecutable === null;
    }

    /**
     * Set the Git executable used by the DataSource.
     * @param gitExecutable The Git executable.
     */
    private setGitExecutable(gitExecutable: GitExecutable | null) {
        this.gitExecutable = gitExecutable;
        this.gitExecutableSupportsGpgInfo = gitExecutable !== null && doesVersionMeetRequirement(gitExecutable.version, GitVersionRequirement.GpgInfo);
        this.generateGitCommandFormats();
    }

    /**
     * Generate the format strings used by various Git commands.
     */
    private generateGitCommandFormats() {
        const config = getConfig();
        const dateType = config.dateType === DateType.Author ? '%at' : '%ct';
        const useMailmap = config.useMailmap;

        this.gitFormatCommitDetails = [
            '%H', '%P', // Hash & Parent Information
            useMailmap ? '%aN' : '%an', useMailmap ? '%aE' : '%ae', '%at', useMailmap ? '%cN' : '%cn', useMailmap ? '%cE' : '%ce', '%ct', // Author / Commit Information
            ...(config.showSignatureStatus && this.gitExecutableSupportsGpgInfo ? ['%G?', '%GS', '%GK'] : ['', '', '']), // GPG Key Information
            '%B' // Body
        ].join(GIT_LOG_SEPARATOR);

        this.gitFormatLog = [
            '%H', '%P', // Hash & Parent Information
            useMailmap ? '%aN' : '%an', useMailmap ? '%aE' : '%ae', dateType, // Author / Commit Information
            '%s' // Subject
        ].join(GIT_LOG_SEPARATOR);

        this.gitFormatStash = [
            '%H', '%P', '%gD', // Hash, Parent & Selector Information
            useMailmap ? '%aN' : '%an', useMailmap ? '%aE' : '%ae', dateType, // Author / Commit Information
            '%s' // Subject
        ].join(GIT_LOG_SEPARATOR);
    }


    /* Get Data Methods - Core */

    /**
     * Get the high-level information of a repository.
     * @param repo The path of the repository.
     * @param showRemoteBranches Are remote branches shown.
     * @param showStashes Are stashes shown.
     * @param hideRemotes An array of hidden remotes.
     * @returns The repositories information.
     */
    public getRepoInfo(repo: string, showRemoteBranches: boolean, showStashes: boolean, hideRemotes: ReadonlyArray<string>): Promise<GitRepoInfo> {
        return Promise.all([
            this.getBranches(repo, showRemoteBranches, hideRemotes),
            this.getRemotes(repo),
            showStashes ? this.getStashes(repo) : Promise.resolve([])
        ]).then((results) => {
            /* eslint no-console: "error" */
            return { branches: results[0].branches, head: results[0].head, remotes: results[1], stashes: results[2], error: null };
        }).catch((errorMessage) => {
            return { branches: [], head: null, remotes: [], stashes: [], error: errorMessage };
        });
    }

    /**
     * Get the commits in a repository.
     * @param repo The path of the repository.
     * @param branches The list of branch heads to display, or NULL (show all).
     * @param maxCommits The maximum number of commits to return.
     * @param showTags Are tags are shown.
     * @param showRemoteBranches Are remote branches shown.
     * @param includeCommitsMentionedByReflogs Should commits mentioned by reflogs being included.
     * @param onlyFollowFirstParent Only follow the first parent of commits.
     * @param commitOrdering The order for commits to be returned.
     * @param remotes An array of known remotes.
     * @param hideRemotes An array of hidden remotes.
     * @param stashes An array of all stashes in the repository.
     * @returns The commits in the repository.
     */
    public getCommits(repo: string, branches: ReadonlyArray<string> | null, authors: ReadonlyArray<string> | null, maxCommits: number, showTags: boolean, showRemoteBranches: boolean, includeCommitsMentionedByReflogs: boolean, onlyFollowFirstParent: boolean, commitOrdering: CommitOrdering, remotes: ReadonlyArray<string>, hideRemotes: ReadonlyArray<string>, stashes: ReadonlyArray<GitStash>): Promise<GitCommitData> {
        const config = getConfig();
        return Promise.all([
            this.getLog(repo, branches, authors, maxCommits + 1, showTags && config.showCommitsOnlyReferencedByTags, showRemoteBranches, includeCommitsMentionedByReflogs, onlyFollowFirstParent, commitOrdering, remotes, hideRemotes, stashes),
            this.getRefs(repo, showRemoteBranches, config.showRemoteHeads, hideRemotes).then((refData: GitRefData) => refData, (errorMessage: string) => errorMessage)
        ]).then(async (results) => {
            let commits: GitCommitRecord[] = results[0], refData: GitRefData | string = results[1], i;
            let moreCommitsAvailable = commits.length === maxCommits + 1;
            if (moreCommitsAvailable) commits.pop();

            // It doesn't matter if getRefs() was rejected if no commits exist
            if (typeof refData === 'string') {
                // getRefs() returned an error message (string)
                if (commits.length > 0) {
                    // Commits exist, throw the error
                    throw refData;
                } else {
                    // No commits exist, so getRefs() will always return an error. Set refData to the default value
                    refData = { head: null, heads: [], tags: [], remotes: [] };
                }
            }

            if (refData.head !== null && config.showUncommittedChanges) {
                for (i = 0; i < commits.length; i++) {
                    if (refData.head === commits[i].hash) {
                        const numUncommittedChanges = await this.getUncommittedChanges(repo);
                        if (numUncommittedChanges > 0) {
                            commits.unshift({ hash: UNCOMMITTED, parents: [refData.head], author: '*', email: '', date: Math.round((new Date()).getTime() / 1000), message: 'Uncommitted Changes (' + numUncommittedChanges + ')' });
                        }
                        break;
                    }
                }
            }

            let commitNodes: DeepWriteable<GitCommit>[] = [];
            let commitLookup: { [hash: string]: number; } = {};

            for (i = 0; i < commits.length; i++) {
                commitLookup[commits[i].hash] = i;
                commitNodes.push({ ...commits[i], heads: [], tags: [], remotes: [], stash: null });
            }

            /* Insert Stashes */
            let toAdd: { index: number, data: GitStash; }[] = [];
            for (i = 0; i < stashes.length; i++) {
                if (typeof commitLookup[stashes[i].hash] === 'number') {
                    commitNodes[commitLookup[stashes[i].hash]].stash = {
                        selector: stashes[i].selector,
                        baseHash: stashes[i].baseHash,
                        untrackedFilesHash: stashes[i].untrackedFilesHash
                    };
                } else if (typeof commitLookup[stashes[i].baseHash] === 'number') {
                    toAdd.push({ index: commitLookup[stashes[i].baseHash], data: stashes[i] });
                }
            }
            toAdd.sort((a, b) => a.index !== b.index ? a.index - b.index : b.data.date - a.data.date);
            for (i = toAdd.length - 1; i >= 0; i--) {
                let stash = toAdd[i].data;
                commitNodes.splice(toAdd[i].index, 0, {
                    hash: stash.hash,
                    parents: [stash.baseHash],
                    author: stash.author,
                    email: stash.email,
                    date: stash.date,
                    message: stash.message,
                    heads: [], tags: [], remotes: [],
                    stash: {
                        selector: stash.selector,
                        baseHash: stash.baseHash,
                        untrackedFilesHash: stash.untrackedFilesHash
                    }
                });
            }
            for (i = 0; i < commitNodes.length; i++) {
                // Correct commit lookup after stashes have been spliced in
                commitLookup[commitNodes[i].hash] = i;
            }

            /* Annotate Heads */
            for (i = 0; i < refData.heads.length; i++) {
                if (typeof commitLookup[refData.heads[i].hash] === 'number') commitNodes[commitLookup[refData.heads[i].hash]].heads.push(refData.heads[i].name);
            }

            /* Annotate Tags */
            if (showTags) {
                for (i = 0; i < refData.tags.length; i++) {
                    if (typeof commitLookup[refData.tags[i].hash] === 'number') commitNodes[commitLookup[refData.tags[i].hash]].tags.push({ name: refData.tags[i].name, annotated: refData.tags[i].annotated });
                }
            }

            /* Annotate Remotes */
            for (i = 0; i < refData.remotes.length; i++) {
                if (typeof commitLookup[refData.remotes[i].hash] === 'number') {
                    let name = refData.remotes[i].name;
                    let remote = remotes.find(remote => name.startsWith(remote + '/'));
                    commitNodes[commitLookup[refData.remotes[i].hash]].remotes.push({ name: name, remote: remote ? remote : null });
                }
            }

            return {
                commits: commitNodes,
                head: refData.head,
                tags: unique(refData.tags.map((tag) => tag.name)),
                moreCommitsAvailable: moreCommitsAvailable,
                error: null
            };
        }).catch((errorMessage) => {
            return { commits: [], head: null, tags: [], moreCommitsAvailable: false, error: errorMessage };
        });
    }

    /**
     * Get various Git config variables for a repository that are consumed by the Git Graph View.
     * @param repo The path of the repository.
     * @param remotes An array of known remotes.
     * @returns The config data.
     */
    public getConfig(repo: string, remotes: ReadonlyArray<string>): Promise<GitRepoConfigData> {
        return Promise.all([
            this.getConfigList(repo),
            this.getConfigList(repo, GitConfigLocation.Local),
            this.getConfigList(repo, GitConfigLocation.Global),
            this.getAuthorList(repo)
        ]).then((results) => {
            const consolidatedConfigs = results[0], localConfigs = results[1], globalConfigs = results[2], authors = results[3];

            const branches: GitRepoConfigBranches = {};
            Object.keys(localConfigs).forEach((key) => {
                if (key.startsWith('branch.')) {
                    if (key.endsWith('.remote')) {
                        const branchName = key.substring(7, key.length - 7);
                        branches[branchName] = {
                            pushRemote: typeof branches[branchName] !== 'undefined' ? branches[branchName].pushRemote : null,
                            remote: localConfigs[key]
                        };
                    } else if (key.endsWith('.pushremote')) {
                        const branchName = key.substring(7, key.length - 11);
                        branches[branchName] = {
                            pushRemote: localConfigs[key],
                            remote: typeof branches[branchName] !== 'undefined' ? branches[branchName].remote : null
                        };
                    }
                }
            });
            return {
                config: {
                    branches: branches,
                    authors,
                    diffTool: getConfigValue(consolidatedConfigs, GitConfigKey.DiffTool),
                    guiDiffTool: getConfigValue(consolidatedConfigs, GitConfigKey.DiffGuiTool),
                    pushDefault: getConfigValue(consolidatedConfigs, GitConfigKey.RemotePushDefault),
                    remotes: remotes.map((remote) => ({
                        name: remote,
                        url: getConfigValue(localConfigs, 'remote.' + remote + '.url'),
                        pushUrl: getConfigValue(localConfigs, 'remote.' + remote + '.pushurl')
                    })),
                    user: {
                        name: {
                            local: getConfigValue(localConfigs, GitConfigKey.UserName),
                            global: getConfigValue(globalConfigs, GitConfigKey.UserName)
                        },
                        email: {
                            local: getConfigValue(localConfigs, GitConfigKey.UserEmail),
                            global: getConfigValue(globalConfigs, GitConfigKey.UserEmail)
                        }
                    }
                },
                error: null
            };
        }).catch((errorMessage) => {
            return { config: null, error: errorMessage };
        });
    }

    private async getAuthorList(repo: string): Promise<ActionedUser[]> {
        const args = ['shortlog', '-e', '-s', '-n', 'HEAD'];
        const dict = new Set<string>();
        const result = await this.spawnGit(args, repo, (authors) => {
            return authors.split(/\r?\n/g)
                .map(line => line.trim())
                .filter(line => line.trim().length > 0)
                .map(line => line.substring(line.indexOf('\t') + 1))
                .map(line => {
                    const indexOfEmailSeparator = line.indexOf('<');
                    if (indexOfEmailSeparator === -1) {
                        return {
                            name: line.trim(),
                            email: ''
                        };
                    } else {
                        const nameParts = line.split('<');
                        const name = nameParts.shift()!.trim();
                        const email = nameParts[0].substring(0, nameParts[0].length - 1).trim();
                        return {
                            name,
                            email
                        };
                    }
                })
                .filter(item => {
                    if (dict.has(item.name)) {
                        return false;
                    }
                    dict.add(item.name);
                    return true;
                })
                .sort((a, b) => (a.name > b.name ? 1 : -1));
        }).catch((errorMessage) => {
            if (typeof errorMessage === 'string') {
                const message = errorMessage.toLowerCase();
                if (message.startsWith('fatal: unable to read config file') && message.endsWith('no such file or directory')) {
                    // If the Git command failed due to the configuration file not existing, return an empty list instead of throwing the exception
                    return {};
                }
            } else {
                errorMessage = 'An unexpected error occurred while spawning the Git child process.';
            }
            throw errorMessage;
        }) as Promise<ActionedUser[]>;
        return result;
    }
    /* Get Data Methods - Commit Details View */

    /**
     * Get the commit details for the Commit Details View.
     * @param repo The path of the repository.
     * @param commitHash The hash of the commit open in the Commit Details View.
     * @param hasParents Does the commit have parents
     * @returns The commit details.
     */
    public getCommitDetails(repo: string, commitHash: string, hasParents: boolean): Promise<GitCommitDetailsData> {
        const fromCommit = commitHash + (hasParents ? '^' : '');
        return Promise.all([
            this.getCommitDetailsBase(repo, commitHash),
            this.getDiffNameStatus(repo, fromCommit, commitHash),
            this.getDiffNumStat(repo, fromCommit, commitHash)
        ]).then((results) => {
            results[0].fileChanges = generateFileChanges(results[1], results[2], null);
            return { commitDetails: results[0], error: null };
        }).catch((errorMessage) => {
            return { commitDetails: null, error: errorMessage };
        });
    }

    /**
     * Get the stash details for the Commit Details View.
     * @param repo The path of the repository.
     * @param commitHash The hash of the stash commit open in the Commit Details View.
     * @param stash The stash.
     * @returns The stash details.
     */
    public getStashDetails(repo: string, commitHash: string, stash: GitCommitStash): Promise<GitCommitDetailsData> {
        return Promise.all([
            this.getCommitDetailsBase(repo, commitHash),
            this.getDiffNameStatus(repo, stash.baseHash, commitHash),
            this.getDiffNumStat(repo, stash.baseHash, commitHash),
            stash.untrackedFilesHash !== null ? this.getDiffNameStatus(repo, stash.untrackedFilesHash, stash.untrackedFilesHash) : Promise.resolve([]),
            stash.untrackedFilesHash !== null ? this.getDiffNumStat(repo, stash.untrackedFilesHash, stash.untrackedFilesHash) : Promise.resolve([])
        ]).then((results) => {
            results[0].fileChanges = generateFileChanges(results[1], results[2], null);
            if (stash.untrackedFilesHash !== null) {
                generateFileChanges(results[3], results[4], null).forEach((fileChange) => {
                    if (fileChange.type === GitFileStatus.Added) {
                        fileChange.type = GitFileStatus.Untracked;
                        results[0].fileChanges.push(fileChange);
                    }
                });
            }
            return { commitDetails: results[0], error: null };
        }).catch((errorMessage) => {
            return { commitDetails: null, error: errorMessage };
        });
    }

    /**
     * Get the uncommitted details for the Commit Details View.
     * @param repo The path of the repository.
     * @returns The uncommitted details.
     */
    public getUncommittedDetails(repo: string): Promise<GitCommitDetailsData> {
        return Promise.all([
            this.getDiffNameStatus(repo, 'HEAD', ''),
            this.getDiffNumStat(repo, 'HEAD', ''),
            this.getStatus(repo)
        ]).then((results) => {
            return {
                commitDetails: {
                    hash: UNCOMMITTED, parents: [],
                    author: '', authorEmail: '', authorDate: 0,
                    committer: '', committerEmail: '', committerDate: 0, signature: null,
                    body: '', fileChanges: generateFileChanges(results[0], results[1], results[2])
                },
                error: null
            };
        }).catch((errorMessage) => {
            return { commitDetails: null, error: errorMessage };
        });
    }

    /**
     * Get the comparison details for the Commit Comparison View.
     * @param repo The path of the repository.
     * @param fromHash The commit hash the comparison is from.
     * @param toHash The commit hash the comparison is to.
     * @returns The comparison details.
     */
    public getCommitComparison(repo: string, fromHash: string, toHash: string): Promise<GitCommitComparisonData> {
        return Promise.all([
            this.getDiffNameStatus(repo, fromHash, toHash === UNCOMMITTED ? '' : toHash),
            this.getDiffNumStat(repo, fromHash, toHash === UNCOMMITTED ? '' : toHash),
            toHash === UNCOMMITTED ? this.getStatus(repo) : Promise.resolve(null)
        ]).then((results) => {
            return {
                fileChanges: generateFileChanges(results[0], results[1], results[2]),
                error: null
            };
        }).catch((errorMessage) => {
            return { fileChanges: [], error: errorMessage };
        });
    }

    /**
     * Get the contents of a file at a specific revision.
     * @param repo The path of the repository.
     * @param commitHash The commit hash specifying the revision of the file.
     * @param filePath The path of the file relative to the repositories root.
     * @returns The file contents.
     */
    public getCommitFile(repo: string, commitHash: string, filePath: string) {
        return this._spawnGit(['show', commitHash + ':' + filePath], repo, stdout => {
            const encoding = getConfig(repo).fileEncoding;
            return decode(stdout, encodingExists(encoding) ? encoding : 'utf8');
        });
    }


    /* Get Data Methods - General */

    /**
     * Get the subject of a commit.
     * @param repo The path of the repository.
     * @param commitHash The commit hash.
     * @returns The subject string, or NULL if an error occurred.
     */
    public getCommitSubject(repo: string, commitHash: string): Promise<string | null> {
        return this.spawnGit(['-c', 'log.showSignature=false', 'log', '--format=%s', '-n', '1', commitHash, '--'], repo, (stdout) => {
            return stdout.trim().replace(/\s+/g, ' ');
        }).then((subject) => subject, () => null);
    }

    /**
     * Get the URL of a repositories remote.
     * @param repo The path of the repository.
     * @param remote The name of the remote.
     * @returns The URL, or NULL if an error occurred.
     */
    public getRemoteUrl(repo: string, remote: string): Promise<string | null> {
        return this.spawnGit(['config', '--get', 'remote.' + remote + '.url'], repo, (stdout) => {
            return stdout.split(EOL_REGEX)[0];
        }).then((url) => url, () => null);
    }

    /**
     * Check to see if a file has been renamed between a commit and the working tree, and return the new file path.
     * @param repo The path of the repository.
     * @param commitHash The commit hash where `oldFilePath` is known to have existed.
     * @param oldFilePath The file path that may have been renamed.
     * @returns The new renamed file path, or NULL if either: the file wasn't renamed or the Git command failed to execute.
     */
    public getNewPathOfRenamedFile(repo: string, commitHash: string, oldFilePath: string) {
        return this.getDiffNameStatus(repo, commitHash, '', 'R').then((renamed) => {
            const renamedRecordForFile = renamed.find((record) => record.oldFilePath === oldFilePath);
            return renamedRecordForFile ? renamedRecordForFile.newFilePath : null;
        }).catch(() => null);
    }

    /**
     * Get the details of a tag.
     * @param repo The path of the repository.
     * @param tagName The name of the tag.
     * @returns The tag details.
     */
    public getTagDetails(repo: string, tagName: string): Promise<GitTagDetailsData> {
        if (this.gitExecutable !== null && !doesVersionMeetRequirement(this.gitExecutable.version, GitVersionRequirement.TagDetails)) {
            return Promise.resolve({ details: null, error: constructIncompatibleGitVersionMessage(this.gitExecutable, GitVersionRequirement.TagDetails, 'retrieving Tag Details') });
        }

        const ref = 'refs/tags/' + tagName;
        return this.spawnGit(['for-each-ref', ref, '--format=' + ['%(objectname)', '%(taggername)', '%(taggeremail)', '%(taggerdate:unix)', '%(contents:signature)', '%(contents)'].join(GIT_LOG_SEPARATOR)], repo, (stdout) => {
            const data = stdout.split(GIT_LOG_SEPARATOR);
            return {
                hash: data[0],
                taggerName: data[1],
                taggerEmail: data[2].substring(data[2].startsWith('<') ? 1 : 0, data[2].length - (data[2].endsWith('>') ? 1 : 0)),
                taggerDate: parseInt(data[3]),
                message: removeTrailingBlankLines(data.slice(5).join(GIT_LOG_SEPARATOR).replace(data[4], '').split(EOL_REGEX)).join('\n'),
                signed: data[4] !== ''
            };
        }).then(async (tag) => ({
            details: {
                hash: tag.hash,
                taggerName: tag.taggerName,
                taggerEmail: tag.taggerEmail,
                taggerDate: tag.taggerDate,
                message: tag.message,
                signature: tag.signed
                    ? await this.getTagSignature(repo, ref)
                    : null
            },
            error: null
        })).catch((errorMessage) => ({
            details: null,
            error: errorMessage
        }));
    }

    /**
     * Get the submodules of a repository.
     * @param repo The path of the repository.
     * @returns An array of the paths of the submodules.
     */
    public getSubmodules(repo: string) {
        return new Promise<string[]>(resolve => {
            fs.readFile(path.join(repo, '.gitmodules'), { encoding: 'utf8' }, async (err, data) => {
                let submodules: string[] = [];
                if (!err) {
                    let lines = data.split(EOL_REGEX), inSubmoduleSection = false, match;
                    const section = /^\s*\[.*\]\s*$/, submodule = /^\s*\[submodule "([^"]+)"\]\s*$/, pathProp = /^\s*path\s+=\s+(.*)$/;

                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].match(section) !== null) {
                            inSubmoduleSection = lines[i].match(submodule) !== null;
                            continue;
                        }

                        if (inSubmoduleSection && (match = lines[i].match(pathProp)) !== null) {
                            let root = await this.repoRoot(getPathFromUri(vscode.Uri.file(path.join(repo, getPathFromStr(match[1])))));
                            if (root !== null && !submodules.includes(root)) {
                                submodules.push(root);
                            }
                        }
                    }
                }
                resolve(submodules);
            });
        });
    }


    /* Repository Info Methods */


    /**
     * Get the root of the repository containing the specified path.
     * @param pathOfPotentialRepo The path that is potentially a repository (or is contained within a repository).
     * @returns STRING => The root of the repository, NULL => `pathOfPotentialRepo` is not in a repository.
     */
    public repoRoot(pathOfPotentialRepo: string) {
        return this.spawnGit(['rev-parse', '--show-toplevel'], pathOfPotentialRepo, (stdout) => getPathFromUri(vscode.Uri.file(path.normalize(stdout.trim())))).then(async (pathReturnedByGit) => {
            if (process.platform === 'win32') {
                // On Windows Mapped Network Drives with Git >= 2.25.0, `git rev-parse --show-toplevel` returns the UNC Path for the Mapped Network Drive, instead of the Drive Letter.
                // Attempt to replace the UNC Path with the Drive Letter.
                let driveLetterPathMatch: RegExpMatchArray | null;
                if ((driveLetterPathMatch = pathOfPotentialRepo.match(DRIVE_LETTER_PATH_REGEX)) && !pathReturnedByGit.match(DRIVE_LETTER_PATH_REGEX)) {
                    const realPathForDriveLetter = pathWithTrailingSlash(await realpath(driveLetterPathMatch[0], true));
                    if (realPathForDriveLetter !== driveLetterPathMatch[0] && pathReturnedByGit.startsWith(realPathForDriveLetter)) {
                        pathReturnedByGit = driveLetterPathMatch[0] + pathReturnedByGit.substring(realPathForDriveLetter.length);
                    }
                }
            }
            let path = pathOfPotentialRepo;
            let first = path.indexOf('/');
            while (true) {
                if (pathReturnedByGit === path || pathReturnedByGit === await realpath(path)) return path;
                let next = path.lastIndexOf('/');
                if (first !== next && next > -1) {
                    path = path.substring(0, next);
                } else {
                    return pathReturnedByGit;
                }
            }
        }).catch(() => null); // null => path is not in a repo
    }


    /* Private Data Providers */

    /**
     * Get the branches in a repository.
     * @param repo The path of the repository.
     * @param showRemoteBranches Are remote branches shown.
     * @param hideRemotes An array of hidden remotes.
     * @returns The branch data.
     */
    private getBranches(repo: string, showRemoteBranches: boolean, hideRemotes: ReadonlyArray<string>) {
        let args = ['branch'];
        if (showRemoteBranches) args.push('-a');
        args.push('--no-color');

        const hideRemotePatterns = hideRemotes.map((remote) => 'remotes/' + remote + '/');
        const showRemoteHeads = getConfig().showRemoteHeads;

        return this.spawnGit(args, repo, (stdout) => {
            let branchData: GitBranchData = { branches: [], head: null, error: null };
            let lines = stdout.split(EOL_REGEX);
            for (let i = 0; i < lines.length - 1; i++) {
                let name = lines[i].substring(2).split(' -> ')[0];
                if (INVALID_BRANCH_REGEXP.test(name) || hideRemotePatterns.some((pattern) => name.startsWith(pattern)) || (!showRemoteHeads && REMOTE_HEAD_BRANCH_REGEXP.test(name))) {
                    continue;
                }

                if (lines[i][0] === '*') {
                    branchData.head = name;
                    branchData.branches.unshift(name);
                } else {
                    branchData.branches.push(name);
                }
            }
            return branchData;
        });
    }

    /**
     * Get the base commit details for the Commit Details View.
     * @param repo The path of the repository.
     * @param commitHash The hash of the commit open in the Commit Details View.
     * @returns The base commit details.
     */
    private getCommitDetailsBase(repo: string, commitHash: string) {
        return this.spawnGit(['-c', 'log.showSignature=false', 'show', '--quiet', commitHash, '--format=' + this.gitFormatCommitDetails], repo, (stdout): DeepWriteable<GitCommitDetails> => {
            const commitInfo = stdout.split(GIT_LOG_SEPARATOR);
            return {
                hash: commitInfo[0],
                parents: commitInfo[1] !== '' ? commitInfo[1].split(' ') : [],
                author: commitInfo[2],
                authorEmail: commitInfo[3],
                authorDate: parseInt(commitInfo[4]),
                committer: commitInfo[5],
                committerEmail: commitInfo[6],
                committerDate: parseInt(commitInfo[7]),
                signature: ['G', 'U', 'X', 'Y', 'R', 'E', 'B'].includes(commitInfo[8])
                    ? {
                        key: commitInfo[10].trim(),
                        signer: commitInfo[9].trim(),
                        status: <GitSignatureStatus>commitInfo[8]
                    }
                    : null,
                body: removeTrailingBlankLines(commitInfo.slice(11).join(GIT_LOG_SEPARATOR).split(EOL_REGEX)).join('\n'),
                fileChanges: []
            };
        });
    }

    /**
     * Get the configuration list of a repository.
     * @param repo The path of the repository.
     * @param location The location of the configuration to be listed.
     * @returns A set of key-value pairs of Git configuration records.
     */
    private getConfigList(repo: string, location?: GitConfigLocation): Promise<GitConfigSet> {
        const args = ['--no-pager', 'config', '--list', '-z', '--includes'];
        if (location) {
            args.push('--' + location);
        }

        return this.spawnGit(args, repo, (stdout) => {
            const configs: GitConfigSet = {}, keyValuePairs = stdout.split('\0');
            const numPairs = keyValuePairs.length - 1;
            let comps, key;
            for (let i = 0; i < numPairs; i++) {
                comps = keyValuePairs[i].split(EOL_REGEX);
                key = comps.shift()!;
                configs[key] = comps.join('\n');
            }
            return configs;
        }).catch((errorMessage) => {
            if (typeof errorMessage === 'string') {
                const message = errorMessage.toLowerCase();
                if (message.startsWith('fatal: unable to read config file') && message.endsWith('no such file or directory')) {
                    // If the Git command failed due to the configuration file not existing, return an empty list instead of throwing the exception
                    return {};
                }
            } else {
                errorMessage = 'An unexpected error occurred while spawning the Git child process.';
            }
            throw errorMessage;
        });
    }

    /**
     * Get the diff `--name-status` records.
     * @param repo The path of the repository.
     * @param fromHash The revision the diff is from.
     * @param toHash The revision the diff is to.
     * @param filter The types of file changes to retrieve (defaults to `AMDR`).
     * @returns An array of `--name-status` records.
     */
    private getDiffNameStatus(repo: string, fromHash: string, toHash: string, filter: string = 'AMDR') {
        return this.execDiff(repo, fromHash, toHash, '--name-status', filter).then((output) => {
            let records: DiffNameStatusRecord[] = [], i = 0;
            while (i < output.length && output[i] !== '') {
                let type = <GitFileStatus>output[i][0];
                if (type === GitFileStatus.Added || type === GitFileStatus.Deleted || type === GitFileStatus.Modified) {
                    // Add, Modify, or Delete
                    let p = getPathFromStr(output[i + 1]);
                    records.push({ type: type, oldFilePath: p, newFilePath: p });
                    i += 2;
                } else if (type === GitFileStatus.Renamed) {
                    // Rename
                    records.push({ type: type, oldFilePath: getPathFromStr(output[i + 1]), newFilePath: getPathFromStr(output[i + 2]) });
                    i += 3;
                } else {
                    break;
                }
            }
            return records;
        });
    }

    /**
     * Get the diff `--numstat` records.
     * @param repo The path of the repository.
     * @param fromHash The revision the diff is from.
     * @param toHash The revision the diff is to.
     * @param filter The types of file changes to retrieve (defaults to `AMDR`).
     * @returns An array of `--numstat` records.
     */
    private getDiffNumStat(repo: string, fromHash: string, toHash: string, filter: string = 'AMDR') {
        return this.execDiff(repo, fromHash, toHash, '--numstat', filter).then((output) => {
            let records: DiffNumStatRecord[] = [], i = 0;
            while (i < output.length && output[i] !== '') {
                let fields = output[i].split('\t');
                if (fields.length !== 3) break;
                if (fields[2] !== '') {
                    // Add, Modify, or Delete
                    records.push({ filePath: getPathFromStr(fields[2]), additions: parseInt(fields[0]), deletions: parseInt(fields[1]) });
                    i += 1;
                } else {
                    // Rename
                    records.push({ filePath: getPathFromStr(output[i + 2]), additions: parseInt(fields[0]), deletions: parseInt(fields[1]) });
                    i += 3;
                }
            }
            return records;
        });
    }

    /**
     * Get the raw commits in a repository.
     * @param repo The path of the repository.
     * @param branches The list of branch heads to display, or NULL (show all).
     * @param num The maximum number of commits to return.
     * @param includeTags Include commits only referenced by tags.
     * @param includeRemotes Include remote branches.
     * @param includeCommitsMentionedByReflogs Include commits mentioned by reflogs.
     * @param onlyFollowFirstParent Only follow the first parent of commits.
     * @param order The order for commits to be returned.
     * @param remotes An array of the known remotes.
     * @param hideRemotes An array of hidden remotes.
     * @param stashes An array of all stashes in the repository.
     * @returns An array of commits.
     */
    private getLog(repo: string, branches: ReadonlyArray<string> | null, authors: ReadonlyArray<string> | null, num: number, includeTags: boolean, includeRemotes: boolean, includeCommitsMentionedByReflogs: boolean, onlyFollowFirstParent: boolean, order: CommitOrdering, remotes: ReadonlyArray<string>, hideRemotes: ReadonlyArray<string>, stashes: ReadonlyArray<GitStash>) {
        const args = ['-c', 'log.showSignature=false', 'log', '--max-count=' + num, '--format=' + this.gitFormatLog, '--' + order + '-order'];
        if (onlyFollowFirstParent) {
            args.push('--first-parent');
        }
        if (authors !== null) {
            for (let i = 0; i < authors.length; i++) {
                args.push(`--author=${authors[i]} <`);
            }
        }
        if (branches !== null) {
            for (let i = 0; i < branches.length; i++) {
                args.push(branches[i]);
            }
        } else {
            // Show All
            args.push('--branches');
            if (includeTags) args.push('--tags');
            if (includeCommitsMentionedByReflogs) args.push('--reflog');
            if (includeRemotes) {
                if (hideRemotes.length === 0) {
                    args.push('--remotes');
                } else {
                    remotes.filter((remote) => !hideRemotes.includes(remote)).forEach((remote) => {
                        args.push('--glob=refs/remotes/' + remote);
                    });
                }
            }
            // Add the unique list of base hashes of stashes, so that commits only referenced by stashes are displayed
            const stashBaseHashes = stashes.map((stash) => stash.baseHash);
            stashBaseHashes.filter((hash, index) => stashBaseHashes.indexOf(hash) === index).forEach((hash) => args.push(hash));

            args.push('HEAD');
        }
        args.push('--');



        return this.spawnGit(args, repo, (stdout) => {
            let lines = stdout.split(EOL_REGEX);
            let commits: GitCommitRecord[] = [];
            for (let i = 0; i < lines.length - 1; i++) {
                let line = lines[i].split(GIT_LOG_SEPARATOR);
                if (line.length !== 6) break;
                commits.push({ hash: line[0], parents: line[1] !== '' ? line[1].split(' ') : [], author: line[2], email: line[3], date: parseInt(line[4]), message: line[5] });
            }
            return commits;
        });
    }

    /**
     * Get the references in a repository.
     * @param repo The path of the repository.
     * @param showRemoteBranches Are remote branches shown.
     * @param showRemoteHeads Are remote heads shown.
     * @param hideRemotes An array of hidden remotes.
     * @returns The references data.
     */
    private getRefs(repo: string, showRemoteBranches: boolean, showRemoteHeads: boolean, hideRemotes: ReadonlyArray<string>) {
        let args = ['show-ref'];
        if (!showRemoteBranches) args.push('--heads', '--tags');
        args.push('-d', '--head');

        const hideRemotePatterns = hideRemotes.map((remote) => 'refs/remotes/' + remote + '/');

        return this.spawnGit(args, repo, (stdout) => {
            let refData: GitRefData = { head: null, heads: [], tags: [], remotes: [] };
            let lines = stdout.split(EOL_REGEX);
            for (let i = 0; i < lines.length - 1; i++) {
                let line = lines[i].split(' ');
                if (line.length < 2) continue;

                let hash = line.shift()!;
                let ref = line.join(' ');

                if (ref.startsWith('refs/heads/')) {
                    refData.heads.push({ hash: hash, name: ref.substring(11) });
                } else if (ref.startsWith('refs/tags/')) {
                    let annotated = ref.endsWith('^{}');
                    refData.tags.push({ hash: hash, name: (annotated ? ref.substring(10, ref.length - 3) : ref.substring(10)), annotated: annotated });
                } else if (ref.startsWith('refs/remotes/')) {
                    if (!hideRemotePatterns.some((pattern) => ref.startsWith(pattern)) && (showRemoteHeads || !ref.endsWith('/HEAD'))) {
                        refData.remotes.push({ hash: hash, name: ref.substring(13) });
                    }
                } else if (ref === 'HEAD') {
                    refData.head = hash;
                }
            }
            return refData;
        });
    }

    /**
     * Get the stashes in a repository.
     * @param repo The path of the repository.
     * @returns An array of stashes.
     */
    private getStashes(repo: string) {
        return this.spawnGit(['reflog', '--format=' + this.gitFormatStash, 'refs/stash', '--'], repo, (stdout) => {
            let lines = stdout.split(EOL_REGEX);
            let stashes: GitStash[] = [];
            for (let i = 0; i < lines.length - 1; i++) {
                let line = lines[i].split(GIT_LOG_SEPARATOR);
                if (line.length !== 7 || line[1] === '') continue;
                let parentHashes = line[1].split(' ');
                stashes.push({
                    hash: line[0],
                    baseHash: parentHashes[0],
                    untrackedFilesHash: parentHashes.length === 3 ? parentHashes[2] : null,
                    selector: line[2],
                    author: line[3],
                    email: line[4],
                    date: parseInt(line[5]),
                    message: line[6]
                });
            }
            return stashes;
        }).catch(() => <GitStash[]>[]);
    }

    /**
     * Get the names of the remotes of a repository.
     * @param repo The path of the repository.
     * @returns An array of remote names.
     */
    private getRemotes(repo: string) {
        return this.spawnGit(['remote'], repo, (stdout) => {
            let lines = stdout.split(EOL_REGEX);
            lines.pop();
            return lines;
        });
    }

    /**
     * Get the signature of a signed tag.
     * @param repo The path of the repository.
     * @param ref The reference identifying the tag.
     * @returns A Promise resolving to the signature.
     */
    private getTagSignature(repo: string, ref: string): Promise<GitSignature> {
        return this._spawnGit(['verify-tag', '--raw', ref], repo, (stdout, stderr) => stderr || stdout.toString(), true).then((output) => {
            const records = output.split(EOL_REGEX)
                .filter((line) => line.startsWith('[GNUPG:] '))
                .map((line) => line.split(' '));

            let signature: Writeable<GitSignature> | null = null, trustLevel: string | null = null, parsingDetails: GpgStatusCodeParsingDetails | undefined;
            for (let i = 0; i < records.length; i++) {
                parsingDetails = GPG_STATUS_CODE_PARSING_DETAILS[records[i][1]];
                if (parsingDetails) {
                    if (signature !== null) {
                        throw new Error('Multiple Signatures Exist: As Git currently doesn\'t support them, nor does Git Graph (for consistency).');
                    } else {
                        signature = {
                            status: parsingDetails.status,
                            key: records[i][2],
                            signer: parsingDetails.uid ? records[i].slice(3).join(' ') : '' // When parsingDetails.uid === TRUE, the signer is the rest of the record (so join the remaining arguments)
                        };
                    }
                } else if (records[i][1].startsWith('TRUST_')) {
                    trustLevel = records[i][1];
                }
            }

            if (signature !== null && signature.status === GitSignatureStatus.GoodAndValid && (trustLevel === 'TRUST_UNDEFINED' || trustLevel === 'TRUST_NEVER')) {
                signature.status = GitSignatureStatus.GoodWithUnknownValidity;
            }

            if (signature !== null) {
                return signature;
            } else {
                throw new Error('No Signature could be parsed.');
            }
        }).catch(() => ({
            status: GitSignatureStatus.CannotBeChecked,
            key: '',
            signer: ''
        }));
    }

    /**
     * Get the number of uncommitted changes in a repository.
     * @param repo The path of the repository.
     * @returns The number of uncommitted changes.
     */
    private getUncommittedChanges(repo: string) {
        return this.spawnGit(['status', '--untracked-files=' + (getConfig().showUntrackedFiles ? 'all' : 'no'), '--porcelain'], repo, (stdout) => {
            const numLines = stdout.split(EOL_REGEX).length;
            return numLines > 1 ? numLines - 1 : 0;
        });
    }

    /**
     * Get the untracked and deleted files that are not staged or committed.
     * @param repo The path of the repository.
     * @returns The untracked and deleted files.
     */
    private getStatus(repo: string) {
        return this.spawnGit(['status', '-s', '--untracked-files=' + (getConfig().showUntrackedFiles ? 'all' : 'no'), '--porcelain', '-z'], repo, (stdout) => {
            let output = stdout.split('\0'), i = 0;
            let status: GitStatusFiles = { deleted: [], untracked: [] };
            let path = '', c1 = '', c2 = '';
            while (i < output.length && output[i] !== '') {
                if (output[i].length < 4) break;
                path = output[i].substring(3);
                c1 = output[i].substring(0, 1);
                c2 = output[i].substring(1, 2);
                if (c1 === 'D' || c2 === 'D') status.deleted.push(path);
                else if (c1 === '?' || c2 === '?') status.untracked.push(path);

                if (c1 === 'R' || c2 === 'R' || c1 === 'C' || c2 === 'C') {
                    // Renames or copies
                    i += 2;
                } else {
                    i += 1;
                }
            }
            return status;
        });
    }


    /* Private Utils */

    /**
     * Get the diff between two revisions.
     * @param repo The path of the repository.
     * @param fromHash The revision the diff is from.
     * @param toHash The revision the diff is to.
     * @param arg Sets the data reported from the diff.
     * @param filter The types of file changes to retrieve.
     * @returns The diff output.
     */
    private execDiff(repo: string, fromHash: string, toHash: string, arg: '--numstat' | '--name-status', filter: string) {
        let args: string[];
        if (fromHash === toHash) {
            args = ['diff-tree', arg, '-r', '--root', '--find-renames', '--diff-filter=' + filter, '-z', fromHash];
        } else {
            args = ['diff', arg, '--find-renames', '--diff-filter=' + filter, '-z', fromHash];
            if (toHash !== '') args.push(toHash);
        }

        return this.spawnGit(args, repo, (stdout) => {
            let lines = stdout.split('\0');
            if (fromHash === toHash) lines.shift();
            return lines;
        });
    }

    /**
     * Spawn Git, with the return value resolved from `stdout` as a string.
     * @param args The arguments to pass to Git.
     * @param repo The repository to run the command in.
     * @param resolveValue A callback invoked to resolve the data from `stdout`.
     */
    private spawnGit<T>(args: string[], repo: string, resolveValue: { (stdout: string): T; }) {
        return this._spawnGit(args, repo, (stdout) => resolveValue(stdout.toString()));
    }

    /**
     * Spawn Git, with the return value resolved from `stdout` as a buffer.
     * @param args The arguments to pass to Git.
     * @param repo The repository to run the command in.
     * @param resolveValue A callback invoked to resolve the data from `stdout` and `stderr`.
     * @param ignoreExitCode Ignore the exit code returned by Git (default: `FALSE`).
     */
    private _spawnGit<T>(args: string[], repo: string, resolveValue: { (stdout: Buffer, stderr: string): T; }, ignoreExitCode: boolean = false) {
        return new Promise<T>((resolve, reject) => {
            if (this.gitExecutable === null) {
                return reject(UNABLE_TO_FIND_GIT_MSG);
            }

            resolveSpawnOutput(cp.spawn(this.gitExecutable.path, args, {
                cwd: repo,
                env: Object.assign({}, process.env)
            })).then((values) => {
                const status = values[0], stdout = values[1], stderr = values[2];
                if (status.code === 0 || ignoreExitCode) {
                    resolve(resolveValue(stdout, stderr));
                } else {
                    reject(getErrorMessage(status.error, stdout, stderr));
                }
            });

            this.logger.logCmd('git', args);
        });
    }
}


/**
 * Generates the file changes from the diff output and status information.
 * @param nameStatusRecords The `--name-status` records.
 * @param numStatRecords The `--numstat` records.
 * @param status The deleted and untracked files.
 * @returns An array of file changes.
 */
function generateFileChanges(nameStatusRecords: DiffNameStatusRecord[], numStatRecords: DiffNumStatRecord[], status: GitStatusFiles | null) {
    let fileChanges: Writeable<GitFileChange>[] = [], fileLookup: { [file: string]: number; } = {}, i = 0;

    for (i = 0; i < nameStatusRecords.length; i++) {
        fileLookup[nameStatusRecords[i].newFilePath] = fileChanges.length;
        fileChanges.push({ oldFilePath: nameStatusRecords[i].oldFilePath, newFilePath: nameStatusRecords[i].newFilePath, type: nameStatusRecords[i].type, additions: null, deletions: null });
    }

    if (status !== null) {
        let filePath;
        for (i = 0; i < status.deleted.length; i++) {
            filePath = getPathFromStr(status.deleted[i]);
            if (typeof fileLookup[filePath] === 'number') {
                fileChanges[fileLookup[filePath]].type = GitFileStatus.Deleted;
            } else {
                fileChanges.push({ oldFilePath: filePath, newFilePath: filePath, type: GitFileStatus.Deleted, additions: null, deletions: null });
            }
        }
        for (i = 0; i < status.untracked.length; i++) {
            filePath = getPathFromStr(status.untracked[i]);
            fileChanges.push({ oldFilePath: filePath, newFilePath: filePath, type: GitFileStatus.Untracked, additions: null, deletions: null });
        }
    }

    for (i = 0; i < numStatRecords.length; i++) {
        if (typeof fileLookup[numStatRecords[i].filePath] === 'number') {
            fileChanges[fileLookup[numStatRecords[i].filePath]].additions = numStatRecords[i].additions;
            fileChanges[fileLookup[numStatRecords[i].filePath]].deletions = numStatRecords[i].deletions;
        }
    }

    return fileChanges;
}

/**
 * Get the specified config value from a set of key-value config pairs.
 * @param configs A set key-value pairs of Git configuration records.
 * @param key The key of the desired config.
 * @returns The value for `key` if it exists, otherwise NULL.
 */
function getConfigValue(configs: GitConfigSet, key: string) {
    return typeof configs[key] !== 'undefined' ? configs[key] : null;
}

/**
 * Produce a suitable error message from a spawned Git command that terminated with an erroneous status code.
 * @param error An error generated by JavaScript (optional).
 * @param stdoutBuffer A buffer containing the data outputted to `stdout`.
 * @param stderr A string containing the data outputted to `stderr`.
 * @returns A suitable error message.
 */
function getErrorMessage(error: Error | null, stdoutBuffer: Buffer, stderr: string) {
    let stdout = stdoutBuffer.toString(), lines: string[];
    if (stdout !== '' || stderr !== '') {
        lines = (stderr + stdout).split(EOL_REGEX);
        lines.pop();
    } else if (error) {
        lines = error.message.split(EOL_REGEX);
    } else {
        lines = [];
    }
    return lines.join('\n');
}

/**
 * Remove trailing blank lines from an array of lines.
 * @param lines The array of lines.
 * @returns The same array.
 */
function removeTrailingBlankLines(lines: string[]) {
    while (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    return lines;
}

/**
 * Get all the unique strings from an array of strings.
 * @param items The array of strings with duplicates.
 * @returns An array of unique strings.
 */
function unique(items: ReadonlyArray<string>) {
    const uniqueItems: { [item: string]: true; } = {};
    items.forEach((item) => uniqueItems[item] = true);
    return Object.keys(uniqueItems);
}


/* Types */

interface DiffNameStatusRecord {
    type: GitFileStatus;
    oldFilePath: string;
    newFilePath: string;
}

interface DiffNumStatRecord {
    filePath: string;
    additions: number;
    deletions: number;
}

interface GitBranchData {
    branches: string[];
    head: string | null;
    error: ErrorInfo;
}

interface GitCommitRecord {
    hash: string;
    parents: string[];
    author: string;
    email: string;
    date: number;
    message: string;
}

interface GitCommitData {
    commits: GitCommit[];
    head: string | null;
    tags: string[];
    moreCommitsAvailable: boolean;
    error: ErrorInfo;
}

export interface GitCommitDetailsData {
    commitDetails: GitCommitDetails | null;
    error: ErrorInfo;
}

interface GitCommitComparisonData {
    fileChanges: GitFileChange[];
    error: ErrorInfo;
}

type GitConfigSet = { [key: string]: string; };

interface GitRef {
    hash: string;
    name: string;
}

interface GitRefTag extends GitRef {
    annotated: boolean;
}

interface GitRefData {
    head: string | null;
    heads: GitRef[];
    tags: GitRefTag[];
    remotes: GitRef[];
}

interface GitRepoInfo extends GitBranchData {
    remotes: string[];
    stashes: GitStash[];
}

interface GitRepoConfigData {
    config: GitRepoConfig | null;
    error: ErrorInfo;
}

interface GitStatusFiles {
    deleted: string[];
    untracked: string[];
}

interface GitTagDetailsData {
    details: GitTagDetails | null;
    error: ErrorInfo;
}

interface GpgStatusCodeParsingDetails {
    readonly status: GitSignatureStatus,
    readonly uid: boolean;
}