/**
 * The last step of `bun run build:lib`: takes the imports kept only for what they do out of the
 * declarations `tsc` writes into `dist/`, such as `import "./styles/order";` and the stylesheets
 * `styles/order.ts` imports. They put the CSS in order in the source, but in a declaration they'd
 * point at stylesheets the package doesn't ship (its CSS is `styles.css`), which an app's TypeScript
 * checking such imports (`noUncheckedSideEffectImports`) refuses. A declaration needs none of them.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SIDE_EFFECT_IMPORT = /^import ["'][^"']+["'];\r?\n/gm;

const declarationsIn = (folder: string): string[] =>
    readdirSync(folder).flatMap((name) => {
        const path = join(folder, name);

        if (statSync(path).isDirectory()) {
            return declarationsIn(path);
        }

        return name.endsWith(".d.ts") ? [path] : [];
    });

let cleaned = 0;

for (const path of declarationsIn("dist")) {
    const source = readFileSync(path, "utf8");
    const result = source.replace(SIDE_EFFECT_IMPORT, "");

    if (result !== source) {
        // A declaration left with nothing is still a module, as the file it stands for is.
        writeFileSync(path, result.trim() === "" ? "export {};\n" : result);
        cleaned += 1;
    }
}

console.log(`Took the side-effect imports out of ${cleaned} declarations.`);
