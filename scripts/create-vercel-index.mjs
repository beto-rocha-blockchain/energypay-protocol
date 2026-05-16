import fs from "node:fs";
import path from "node:path";

const clientDir = path.resolve("dist/client");
const assetsDir = path.join(clientDir, "assets");

if (!fs.existsSync(assetsDir)) {
  throw new Error("dist/client/assets not found. Run vite build first.");
}

const files = fs.readdirSync(assetsDir);

const cssFile = files.find((file) => file.startsWith("styles-") && file.endsWith(".css"));

const startEntry = files.find((file) => file.startsWith("start-") && file.endsWith(".js"));

if (!startEntry) {
  throw new Error("No start-*.js client entry found in dist/client/assets.");
}

const html = `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EnergyPay</title>
    ${cssFile ? `<link rel="stylesheet" href="/assets/${cssFile}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/${startEntry}"></script>
  </body>
</html>
`;

fs.writeFileSync(path.join(clientDir, "index.html"), html);

console.log(`Created dist/client/index.html using ${startEntry}`);