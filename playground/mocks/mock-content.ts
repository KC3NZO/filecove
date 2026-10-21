import type { FileContent } from "../../src";

// Made-up contents for the mock adapter's files, so the preview has something to show. Pictures,
// PDFs, sounds and text are made from the file's name; videos come from MDN's public samples, to
// show a URL being handed over rather than bytes.

/** Longest text made up for a file, however large it says it is. */
const MAX_TEXT = 1_000_000;

const SAMPLE_VIDEOS: Record<string, string> = {
    webm: "https://mdn.github.io/shared-assets/videos/flower.webm",
    mp4: "https://mdn.github.io/shared-assets/videos/flower.mp4",
};

const PICTURES = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp"]);
const SOUNDS = new Set(["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus"]);
const VIDEOS = new Set(["mp4", "webm", "mov", "m4v", "ogv"]);
const BINARIES = new Set(["zip", "gz", "tar", "parquet", "exe", "bin", "woff", "woff2"]);

// Whole files for names worth showing as they'd really be.
const KNOWN: Record<string, string> = {
    ".gitignore": "node_modules\ndist\n*.local\n.env\n",
    "robots.txt": "User-agent: *\nAllow: /\n",
    "go.mod": "module example.com/api\n\ngo 1.23\n\nrequire github.com/jackc/pgx/v5 v5.7.1\n",
    dockerfile: [
        "FROM golang:1.23 AS build",
        "WORKDIR /src",
        "COPY . .",
        "RUN go build -o /api ./cmd/server",
        "",
        "FROM gcr.io/distroless/base",
        "COPY --from=build /api /api",
        'ENTRYPOINT ["/api"]',
        "",
    ].join("\n"),
    "package.json": `${JSON.stringify(
        {
            name: "website",
            private: true,
            type: "module",
            scripts: { dev: "vite", build: "tsc -b && vite build" },
            dependencies: { react: "^19.2.0", "react-dom": "^19.2.0" },
        },
        null,
        2,
    )}\n`,
    "tsconfig.json": `${JSON.stringify({ files: [], references: [{ path: "./tsconfig.app.json" }] }, null, 2)}\n`,
    "index.html": [
        "<!doctype html>",
        '<html lang="en">',
        "  <head>",
        '    <meta charset="UTF-8" />',
        "    <title>Website</title>",
        "  </head>",
        "  <body>",
        '    <div id="root"></div>',
        '    <script type="module" src="/src/main.tsx"></script>',
        "  </body>",
        "</html>",
        "",
    ].join("\n"),
};

const pad = (value: number) => String(value).padStart(2, "0");

/** A file's start and a line to repeat after it, numbered from 1, until the file is as long as it says. */
interface TextPattern {
    head: string;
    line: (n: number) => string;
}

const textPattern = (name: string, extension: string): TextPattern => {
    switch (extension) {
        case "md":
            return {
                head:
                    `# ${name.replace(/\.md$/i, "")}\n\n` +
                    "Notes kept with the project, made up by the playground's mock adapter.\n\n",
                line: (n) => `## Part ${n}\n\n- A point worth keeping, number ${n}.\n- Another, with \`code\`.\n\n`,
            };
        case "json":
            return {
                head: "[\n",
                line: (n) =>
                    `  { "id": ${n}, "name": "record-${n}", "value": ${(n * 37) % 1000}, "active": ${n % 2 === 0} },\n`,
            };
        case "csv":
            return {
                head: "id,name,value,updated\n",
                line: (n) => `${n},item-${n},${(n * 7_919) % 10_000},2026-${pad((n % 12) + 1)}-${pad((n % 28) + 1)}\n`,
            };
        case "log":
            return {
                head: "",
                line: (n) =>
                    `2026-06-20T03:${pad(n % 60)}:${pad((n * 7) % 60)}Z ${n % 17 === 0 ? "WARN" : "INFO"} ` +
                    `GET /api/files/${n} status=${n % 23 === 0 ? 404 : 200} duration=${(n * 13) % 250}ms\n`,
            };
        case "ts":
        case "tsx":
        case "js":
            return {
                head: `// ${name}\n\n`,
                line: (n) => `export const step${n} = (value: number) => value * ${n};\n\n`,
            };
        case "go":
            return {
                head: `package main\n\nimport "fmt"\n\n`,
                line: (n) => `func step${n}() {\n\tfmt.Println("step ${n}")\n}\n\n`,
            };
        case "sql":
            return {
                head: `-- ${name}\n\n`,
                line: (n) =>
                    `CREATE TABLE table_${n} (\n    id BIGSERIAL PRIMARY KEY,\n    name TEXT NOT NULL,\n` +
                    `    created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n`,
            };
        case "yml":
        case "yaml":
            return {
                head: `# ${name}\n`,
                line: (n) => `job-${n}:\n  runs-on: ubuntu-latest\n  steps:\n    - run: echo "step ${n}"\n`,
            };
        case "lock":
        case "sum":
            return {
                head: "",
                line: (n) => `example.com/package-${n} v1.${n}.0 h1:${btoa(`package-${n}`).replace(/=/g, "")}=\n`,
            };
        default:
            return {
                head: "",
                line: (n) => `Line ${n} of ${name}, made up by the playground's mock adapter.\n`,
            };
    }
};

/** Text as long as the file says it is, up to `MAX_TEXT`. */
const text = (name: string, size = 0) => {
    const extension = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
    const known = KNOWN[name.toLowerCase()];

    if (known) {
        return known;
    }

    const { head, line } = textPattern(name, extension);
    const target = Math.min(size, MAX_TEXT);
    const parts = [head];
    let length = head.length;

    for (let n = 1; length < target || n === 1; n += 1) {
        const next = line(n);

        parts.push(next);
        length += next.length;
    }

    return parts.join("");
};

// A hue from the name, so each picture looks different.
const hueOf = (name: string) => [...name].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 360, 7);

const escapeXml = (value: string) => value.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);

/** A landscape in the name's colours, with the name on it. */
const picture = (name: string) => {
    const hue = hueOf(name);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
<defs><linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue} 70% 62%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360} 65% 34%)"/>
</linearGradient></defs>
<rect width="1600" height="1000" fill="url(#sky)"/>
<circle cx="1240" cy="260" r="140" fill="hsl(${(hue + 30) % 360} 90% 88% / 0.6)"/>
<path d="M0 820 L420 480 L760 760 L1060 560 L1600 900 L1600 1000 L0 1000 Z" fill="hsl(${hue} 40% 18% / 0.6)"/>
<text x="80" y="150" font-family="system-ui, sans-serif" font-size="72" font-weight="600" fill="white">
${escapeXml(name)}</text>
</svg>`;

    return new Blob([svg], { type: "image/svg+xml" });
};

/** A round logo with the name's first letter. */
const logo = (name: string) => {
    const hue = hueOf(name);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<circle cx="128" cy="128" r="120" fill="hsl(${hue} 70% 50%)"/>
<text x="128" y="166" text-anchor="middle" font-family="system-ui, sans-serif" font-size="120" font-weight="700"
fill="white">${escapeXml(name[0]?.toUpperCase() ?? "?")}</text>
</svg>`;

    return new Blob([svg], { type: "image/svg+xml" });
};

/** A one-page PDF with the name on it. Its offsets count characters as bytes, which holds for ASCII names. */
const pdf = (name: string) => {
    const title = name.replace(/[\\()]/g, "\\$&");
    const stream =
        `BT /F1 28 Tf 72 720 Td (${title}) Tj /F1 14 Tf 0 -40 Td ` +
        "(A sample document made up by the playground's mock adapter.) Tj ET";
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R " +
            "/Resources << /Font << /F1 5 0 R >> >> >>",
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
    const offsets: number[] = [];
    let body = "%PDF-1.4\n";

    objects.forEach((object, index) => {
        offsets.push(body.length);
        body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xref = body.length;
    const entries = offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");

    body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${entries}`;
    body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

    return new Blob([body], { type: "application/pdf" });
};

/** A rising chime, as 16-bit mono WAV. */
const chime = () => {
    const rate = 22_050;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const spacing = 0.4;
    const samples = Math.round(rate * (spacing * notes.length + 1.2));
    const view = new DataView(new ArrayBuffer(44 + samples * 2));
    const write = (offset: number, value: string) =>
        [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));

    write(0, "RIFF");
    view.setUint32(4, 36 + samples * 2, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, samples * 2, true);

    for (let sample = 0; sample < samples; sample += 1) {
        const time = sample / rate;
        const value = notes.reduce((sum, frequency, note) => {
            const since = time - note * spacing;

            return since < 0 ? sum : sum + Math.sin(2 * Math.PI * frequency * since) * Math.exp(-since * 3);
        }, 0);

        view.setInt16(44 + sample * 2, Math.max(-1, Math.min(1, value * 0.3)) * 0x7fff, true);
    }

    return new Blob([view.buffer], { type: "audio/wav" });
};

/** Contents for a mock file, made up from its name, claimed size and type. */
export const sampleContent = (name: string, size?: number, mimeType?: string): FileContent => {
    const dot = name.lastIndexOf(".");
    const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";

    if (VIDEOS.has(extension) || mimeType?.startsWith("video/")) {
        return { url: SAMPLE_VIDEOS[extension] ?? SAMPLE_VIDEOS.mp4 };
    }

    if (extension === "svg") {
        return { blob: logo(name) };
    }

    if (PICTURES.has(extension) || mimeType?.startsWith("image/")) {
        return { blob: picture(name) };
    }

    if (SOUNDS.has(extension) || mimeType?.startsWith("audio/")) {
        return { blob: chime() };
    }

    if (extension === "pdf") {
        return { blob: pdf(name) };
    }

    if (BINARIES.has(extension)) {
        return { blob: new Blob([new Uint8Array(Math.min(size ?? 0, 65_536))], { type: mimeType }) };
    }

    return { blob: new Blob([text(name, size)], { type: mimeType ?? "text/plain" }) };
};
