export enum TransmissionTorrentStatus {
    Stopped = 0,
    CheckQueued = 1,
    Checking = 2,
    DownloadQueued = 3,
    Downloading = 4,
    SeedQueued = 5,
    Seeding = 6,
    //TODO: find the docs for this status. It does not exist in transmission docs. Looks at the transmission sources
    __UndocumentedCantFindPeers__ = 7,
}

export interface TransmissionTorrent {
    id: number;
    files: TransmissionFile[];
    downloadDir: string;
    status: TransmissionTorrentStatus;
    percentDone: number;
    eta: number;
    sizeWhenDone: number;
    name: string;
}

export interface TransmissionFile {
    bytesCompleted: number;
    length: number;
    name: string;
}

export interface TransmissionResponseTorrentGet {
    torrents: TransmissionTorrent[];
}
