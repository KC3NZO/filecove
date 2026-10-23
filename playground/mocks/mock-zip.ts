// A small zip writer for the mock adapter's `download`, as a backend building a download would
// make one: stored without compression, names in UTF-8, so the Arabic and Hebrew ones keep their
// letters. No zip64, which the mock's download limit keeps it well clear of.

/** A file or folder to pack: a folder's path ends in "/" and it has no data. */
export interface ZipItem {
    path: string;
    data: Blob | null;
    modified: Date;
}

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_DIRECTORY = 0x06054b50;
/** Zip 2.0, which stored files and folders need. */
const VERSION = 20;
/** General purpose bit 11: names are UTF-8. */
const UTF8_NAMES = 0x0800;
/** MS-DOS's directory attribute, for folders. */
const DOS_DIRECTORY = 0x10;

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
    let crc = index;

    for (let bit = 0; bit < 8; bit += 1) {
        crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }

    return crc >>> 0;
});

const crc32 = (bytes: Uint8Array) => {
    let crc = 0xffffffff;

    for (const byte of bytes) {
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
};

// MS-DOS time and date, as zip keeps them: local time, to two seconds, from 1980.
const dosTime = (date: Date) => (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);

const dosDate = (date: Date) =>
    ((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();

/** A header of `size` bytes, written little-endian by `write`, followed by `name`. */
const header = (size: number, name: Uint8Array, write: (view: DataView) => void) => {
    const bytes = new Uint8Array(size + name.length);

    write(new DataView(bytes.buffer));
    bytes.set(name, size);

    return bytes;
};

/** Packs the items into a zip, in the order given. */
export const zip = async (items: readonly ZipItem[]) => {
    const encoder = new TextEncoder();
    const parts: BlobPart[] = [];
    const directory: BlobPart[] = [];
    let offset = 0;
    let directorySize = 0;

    for (const item of items) {
        const name = encoder.encode(item.path);
        const data = item.data ? new Uint8Array(await item.data.arrayBuffer()) : new Uint8Array(0);
        const crc = crc32(data);
        const time = dosTime(item.modified);
        const date = dosDate(item.modified);

        const local = header(30, name, (view) => {
            view.setUint32(0, LOCAL_HEADER, true);
            view.setUint16(4, VERSION, true);
            view.setUint16(6, UTF8_NAMES, true);
            view.setUint16(10, time, true);
            view.setUint16(12, date, true);
            view.setUint32(14, crc, true);
            view.setUint32(18, data.length, true);
            view.setUint32(22, data.length, true);
            view.setUint16(26, name.length, true);
        });

        const central = header(46, name, (view) => {
            view.setUint32(0, CENTRAL_HEADER, true);
            view.setUint16(4, VERSION, true);
            view.setUint16(6, VERSION, true);
            view.setUint16(8, UTF8_NAMES, true);
            view.setUint16(12, time, true);
            view.setUint16(14, date, true);
            view.setUint32(16, crc, true);
            view.setUint32(20, data.length, true);
            view.setUint32(24, data.length, true);
            view.setUint16(28, name.length, true);
            view.setUint32(38, item.data ? 0 : DOS_DIRECTORY, true);
            view.setUint32(42, offset, true);
        });

        parts.push(local, data);
        directory.push(central);
        offset += local.length + data.length;
        directorySize += central.length;
    }

    const end = header(22, new Uint8Array(0), (view) => {
        view.setUint32(0, END_OF_DIRECTORY, true);
        view.setUint16(8, items.length, true);
        view.setUint16(10, items.length, true);
        view.setUint32(12, directorySize, true);
        view.setUint32(16, offset, true);
    });

    return new Blob([...parts, ...directory, end], { type: "application/zip" });
};
