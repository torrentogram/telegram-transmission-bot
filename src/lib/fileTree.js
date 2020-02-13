const bytes = require("bytes");
const { dirname, basename } = require("path");
const SIZE_LIMIT = bytes.parse("50MB");

/**
 * @typedef FileItem
 * @property {string} name
 * @property {number} length
 * @property {number} bytesCompleted
 *
 * @typedef FileNode
 * @property primaryText
 * @property secondaryText
 * @property link
 */

/**
 * @param {Array<FileItem>} files
 * @param {number} torrentId
 * @returns {Array<FileNode>}
 */
function parseFilesList(files, torrentId) {
    /**
     * @type Array<FileNode>
     */
    const nodes = [];
    let currentDir = "";
    let i = 0;
    for (const file of files) {
        const dir = dirname(file.name);
        if (currentDir !== dir) {
            nodes.push({
                primaryText: `${dir}/:`
            });
            currentDir = dir;
        }
        const isDownloaded = file.bytesCompleted === file.length;
        const isUnderSizeLimit = file.length <= SIZE_LIMIT;
        nodes.push({
            primaryText: basename(file.name),
            secondaryText: bytes(file.length),
            link:
                isDownloaded && isUnderSizeLimit
                    ? `/file${torrentId}_${i}`
                    : null
        });

        i = i + 1;
    }

    return nodes;
}

/**
 *
 * @param {Array<FileNode>} nodes
 * @returns {string}
 */
function renderNodes(nodes) {
    return nodes
        .map(node => {
            const lines = [];
            if (node.link) {
                lines.push(node.link);
            }
            if (node.primaryText) {
                lines.push(`<pre>${node.primaryText}</pre>`);
            }
            if (node.secondaryText) {
                lines.push(`<i>${node.secondaryText}</i>`);
            }
            return lines.join("\n");
        })
        .join("\n\n");
}

/**
 * @param {Array<FileItem>} files
 * @param {number} torrentId
 * @returns {string}
 */
function renderFilesList(files, torrentId) {
    return renderNodes(parseFilesList(files, torrentId));
}

exports.parseFilesList = parseFilesList;
exports.renderNodes = renderNodes;
exports.renderFilesList = renderFilesList;
