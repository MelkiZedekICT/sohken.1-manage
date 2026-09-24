import { mkdir, readFile, writeFile } from 'node:fs/promises';

const read = (name) => readFile(`web/${name}`, 'utf8');
const templateIndex = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>APP_TITLE</title>
    <link rel="stylesheet" href="./src/styles.css">
</head>
<body>
    <div id="app">APP_CONTENT</div>
    <script type="module" src="./src/main.ts"></script>
</body>
</html>
`;
const templateStyles = `@tailwind base;
@tailwind components;
@tailwind utilities;

/* STYLES */
`;
const templateMain = `import './styles.css';
`;
const templateBackend = `import { router, json, error } from "@appdeploy/sdk";

import { notifySubscribers, realtimeSubscriptionRoutes } from "./realtime-subscribers";

export const handler = router({
    "GET /api/_healthcheck": [async () => json({ message: "Success" })],

    ...realtimeSubscriptionRoutes,
})`;

const files = [
  { filename: 'package.json', diffs: [{ from: '"name": "html-static-app"', to: '"name": "sohken-web"' }] },
  { filename: 'index.html', diffs: [{ from: templateIndex, to: await read('index.html') }] },
  { filename: 'src/styles.css', diffs: [{ from: templateStyles, to: await read('src/styles.css') }] },
  { filename: 'src/main.ts', diffs: [{ from: templateMain, to: await read('src/main.ts') }] },
  { filename: 'backend/index.ts', diffs: [{ from: templateBackend, to: await read('backend/index.ts') }] },
  { filename: 'tests/tests.json', content: await read('tests/tests.json') },
];
await mkdir('.cache', { recursive: true });
await writeFile('.cache/sohken-web-upload.json', JSON.stringify({ files, deletePaths: [] }));
console.log(`Prepared ${files.length} website changes.`);
