import bytes from 'bytes';
import { dirname, basename } from 'path';
import { TransmissionFile } from '../transmissionTypes';

const SIZE_LIMIT = bytes.parse('50MB');

interface FileNode {
    icon: string;
    primaryText: string;
    secondaryText?: string;
    link?: string | null;
}

export function parseFilesList(files: TransmissionFile[], torrentId: number): FileNode[] {
    const nodes: FileNode[] = [];
    let currentDir = '';
    let i = 0;
    for (const file of files) {
        const dir = dirname(file.name);
        if (currentDir !== dir) {
            nodes.push({
                primaryText: `${dir}/:`,
                icon: '📂',
            });
            currentDir = dir;
        }
        const isDownloaded = file.bytesCompleted === file.length;
        const isUnderSizeLimit = file.length <= SIZE_LIMIT;
        nodes.push({
            icon: '📄',
            primaryText: basename(file.name),
            secondaryText: bytes(file.length),
            link:
                isDownloaded && isUnderSizeLimit
                    ? `/file${torrentId}_${i}`
                    : null,
        });

        i = i + 1;
    }

    return nodes;
}

export function renderNodes(nodes: FileNode[]): string {
    return nodes
        .map((node) => {
            const lines = [];
            if (node.link) {
                lines.push(node.link);
            }
            if (node.primaryText) {
                lines.push(
                    `<pre>${node.icon ? `${node.icon} ` : ''}${
                        node.primaryText
                    }</pre>`
                );
            }
            if (node.secondaryText) {
                lines.push(`<i>${node.secondaryText}</i>`);
            }
            return lines.join('\n');
        })
        .join('\n\n');
}

export function renderFilesList(files: TransmissionFile[], torrentId: number): string {
    return renderNodes(parseFilesList(files, torrentId));
}
