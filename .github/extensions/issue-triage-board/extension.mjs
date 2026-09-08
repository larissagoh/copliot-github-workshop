import { createServer } from 'node:http';
import { createCanvas, joinSession } from '@github/copilot-sdk/extension';

// This curated snapshot keeps triage fast and reviewable for the team.
const issues = [
    {
        number: 8,
        title: 'Update our repository coding standards',
        url: 'https://github.com/larissagoh/copliot-github-workshop/issues/8',
        summary: 'Define intent-focused comments, data-layer TSDoc, component Props documentation, TypeScript formatting, and README guidance.',
        justification: 'The related coding-standards work appears to have landed on main already, so this likely needs a quick acceptance check and closure before it becomes stale.',
        priority: 1,
    },
    {
        number: 1,
        title: 'Add a search box to find games by title',
        url: 'https://github.com/larissagoh/copliot-github-workshop/issues/1',
        summary: 'Add accessible, case-insensitive title search with a clear empty state and unit plus end-to-end coverage.',
        justification: 'Search delivers immediate user value and establishes the query and UI patterns that later catalog controls can reuse.',
        priority: 2,
    },
    {
        number: 7,
        title: 'Allow users to filter games by category and publisher',
        url: 'https://github.com/larissagoh/copliot-github-workshop/issues/7',
        summary: 'Support combinable category and publisher filters across the data layer and accessible catalog controls.',
        justification: 'Filtering is the broadest remaining discoverability improvement and should be designed alongside search to avoid duplicating catalog-state logic.',
        priority: 3,
    },
    {
        number: 6,
        title: 'Implement pagination on the game list page',
        url: 'https://github.com/larissagoh/copliot-github-workshop/issues/6',
        summary: 'Add paginated data access and accessible list navigation with unit and end-to-end coverage.',
    },
    {
        number: 5,
        title: 'Show a catalog summary on the home page',
        url: 'https://github.com/larissagoh/copliot-github-workshop/issues/5',
        summary: 'Display total games and average rating, including empty-catalog edge cases.',
    },
    {
        number: 4,
        title: "Add a publisher page listing that publisher's games",
        url: 'https://github.com/larissagoh/copliot-github-workshop/issues/4',
        summary: 'Create prerendered publisher routes that reuse game cards and link from existing game views.',
    },
    {
        number: 3,
        title: 'Show category and publisher descriptions on the game detail page',
        url: 'https://github.com/larissagoh/copliot-github-workshop/issues/3',
        summary: 'Surface existing category and publisher descriptions while gracefully hiding missing content.',
    },
    {
        number: 2,
        title: 'Allow users to sort the game list',
        url: 'https://github.com/larissagoh/copliot-github-workshop/issues/2',
        summary: 'Add title and rating sort options with documented handling for unrated games.',
    },
];

const servers = new Map();
let session;

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function issuePrompt(issue) {
    return [
        `Begin work on GitHub issue #${issue.number}: ${issue.title}`,
        '',
        `Issue URL: ${issue.url}`,
        `Issue summary: ${issue.summary}`,
        '',
        'Treat this issue as the current task. Read the full issue and repository instructions, inspect the existing implementation, then implement and validate the complete change.',
    ].join('\n');
}

async function addIssueToContext(number) {
    const issue = issues.find((candidate) => candidate.number === number);
    if (!issue) {
        return { ok: false, status: 404, message: `Issue #${number} is not on this board.` };
    }

    await session.send({ prompt: issuePrompt(issue) });
    return {
        ok: true,
        status: 200,
        message: `Issue #${issue.number} was added to the current session.`,
        issue: { number: issue.number, title: issue.title, url: issue.url },
    };
}

function renderPriorityCard(issue) {
    return `
        <article class="card priority-card">
            <div class="card-topline">
                <span class="rank">Priority ${issue.priority}</span>
                <a href="${issue.url}" target="_blank" rel="noreferrer">#${issue.number}</a>
            </div>
            <h3>${escapeHtml(issue.title)}</h3>
            <p>${escapeHtml(issue.summary)}</p>
            <div class="reason">
                <strong>Why now</strong>
                <span>${escapeHtml(issue.justification)}</span>
            </div>
            <button type="button" data-issue="${issue.number}">Work on this issue</button>
        </article>`;
}

function renderBacklogCard(issue) {
    return `
        <article class="card backlog-card">
            <div>
                <div class="card-topline">
                    <span class="queue">Queued</span>
                    <a href="${issue.url}" target="_blank" rel="noreferrer">#${issue.number}</a>
                </div>
                <h3>${escapeHtml(issue.title)}</h3>
                <p>${escapeHtml(issue.summary)}</p>
            </div>
            <button type="button" data-issue="${issue.number}">Work on this issue</button>
        </article>`;
}

function renderHtml() {
    const priorityCards = issues.filter((issue) => issue.priority).map(renderPriorityCard).join('');
    const backlogCards = issues.filter((issue) => !issue.priority).map(renderBacklogCard).join('');

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Issue triage board</title>
    <style>
        :root { color-scheme: light dark; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            background: var(--background-color-default, #0d1117);
            color: var(--text-color-default, #f0f6fc);
            font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
            font-size: var(--text-body-medium, 14px);
            line-height: var(--leading-body-medium, 20px);
        }
        main { max-width: 1180px; margin: 0 auto; padding: 28px; }
        header { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
        h1 { margin: 0 0 6px; font-size: var(--text-title-large, 26px); line-height: 1.2; }
        h2 { margin: 0; font-size: var(--text-title-medium, 20px); }
        h3 { margin: 12px 0 8px; font-size: 16px; line-height: 1.35; }
        p { margin: 0; color: var(--text-color-muted, #8b949e); }
        .count { flex: 0 0 auto; color: var(--text-color-muted, #8b949e); }
        .section-heading { display: flex; align-items: center; justify-content: space-between; margin: 0 0 12px; }
        .priority-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .backlog { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
        section + section { margin-top: 36px; padding-top: 28px; border-top: 1px solid var(--border-color-default, #30363d); }
        .card {
            border: 1px solid var(--border-color-default, #30363d);
            border-radius: 12px;
            background: color-mix(in srgb, var(--background-color-default, #0d1117) 92%, var(--true-color-blue, #2f81f7) 8%);
            padding: 16px;
        }
        .priority-card { display: flex; min-height: 330px; flex-direction: column; border-top: 3px solid var(--true-color-blue, #2f81f7); }
        .backlog-card { display: flex; min-height: 190px; flex-direction: column; justify-content: space-between; }
        .card-topline { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .rank, .queue {
            border-radius: 999px;
            padding: 3px 9px;
            color: var(--color-white, #fff);
            background: var(--true-color-blue-muted, #1f6feb);
            font-size: 12px;
            font-weight: var(--font-weight-semibold, 600);
        }
        .queue { color: var(--text-color-muted, #8b949e); background: transparent; border: 1px solid var(--border-color-default, #30363d); }
        a { color: var(--true-color-blue, #58a6ff); font-weight: 600; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .reason {
            display: grid;
            gap: 4px;
            margin: 18px 0;
            padding: 12px;
            border-radius: 8px;
            background: var(--true-color-blue-muted, rgba(47, 129, 247, 0.12));
            color: var(--text-color-default, #f0f6fc);
        }
        .reason span { color: var(--text-color-muted, #8b949e); }
        button {
            width: 100%;
            margin-top: auto;
            border: 0;
            border-radius: 8px;
            padding: 10px 12px;
            background: var(--true-color-blue, #2f81f7);
            color: var(--color-white, #fff);
            font: inherit;
            font-weight: var(--font-weight-semibold, 600);
            cursor: pointer;
        }
        button:hover { filter: brightness(1.08); }
        button:focus-visible { outline: 2px solid var(--color-focus-outline, #58a6ff); outline-offset: 2px; }
        button:disabled { cursor: wait; opacity: 0.7; }
        #status {
            position: fixed;
            right: 18px;
            bottom: 18px;
            max-width: min(420px, calc(100vw - 36px));
            border: 1px solid var(--border-color-default, #30363d);
            border-radius: 10px;
            padding: 12px 16px;
            background: var(--background-color-default, #0d1117);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
        }
        #status:empty { display: none; }
        @media (max-width: 850px) {
            .priority-grid, .backlog { grid-template-columns: 1fr; }
            .priority-card, .backlog-card { min-height: auto; }
        }
        @media (max-width: 560px) {
            main { padding: 18px; }
            header { align-items: start; flex-direction: column; }
        }
    </style>
</head>
<body>
    <main>
        <header>
            <div>
                <h1>Issue triage board</h1>
                <p>Current open work for larissagoh/copliot-github-workshop</p>
            </div>
            <span class="count">${issues.length} open issues</span>
        </header>
        <section aria-labelledby="attention-heading">
            <div class="section-heading">
                <h2 id="attention-heading">Needs attention now</h2>
                <span class="count">Top 3</span>
            </div>
            <div class="priority-grid">${priorityCards}</div>
        </section>
        <section aria-labelledby="backlog-heading">
            <div class="section-heading">
                <h2 id="backlog-heading">Remaining queue</h2>
                <span class="count">${issues.length - 3} issues</span>
            </div>
            <div class="backlog">${backlogCards}</div>
        </section>
    </main>
    <div id="status" role="status" aria-live="polite"></div>
    <script>
        const status = document.querySelector('#status');
        document.querySelectorAll('button[data-issue]').forEach((button) => {
            button.addEventListener('click', async () => {
                const originalText = button.textContent;
                button.disabled = true;
                button.textContent = 'Adding to session...';
                status.textContent = '';
                try {
                    const response = await fetch('/context', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ number: Number(button.dataset.issue) }),
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message || 'Unable to add issue.');
                    button.textContent = 'Added to session';
                    status.textContent = result.message;
                } catch (error) {
                    button.disabled = false;
                    button.textContent = originalText;
                    status.textContent = error instanceof Error ? error.message : 'Unable to add issue.';
                }
            });
        });
    </script>
</body>
</html>`;
}

async function readJson(request) {
    let body = '';
    for await (const chunk of request) {
        body += chunk;
        if (body.length > 10_000) {
            throw new Error('Request body is too large.');
        }
    }
    return JSON.parse(body || '{}');
}

async function startServer() {
    const server = createServer(async (request, response) => {
        try {
            if (request.method === 'POST' && request.url === '/context') {
                const input = await readJson(request);
                const result = await addIssueToContext(Number(input.number));
                response.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
                response.end(JSON.stringify(result));
                return;
            }

            if (request.method === 'GET' && request.url === '/') {
                response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                response.end(renderHtml());
                return;
            }

            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Not found');
        } catch (error) {
            response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            response.end(JSON.stringify({
                ok: false,
                message: error instanceof Error ? error.message : 'Unable to process request.',
            }));
        }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    return { server, url: `http://127.0.0.1:${port}/` };
}

session = await joinSession({
    canvases: [
        createCanvas({
            id: 'issue-triage-board',
            displayName: 'Issue triage board',
            description: 'Prioritized Kanban board for the current repository issues with one-click session handoff.',
            actions: [
                {
                    name: 'work_on_issue',
                    description: 'Add an issue from the board to the current session and begin work.',
                    inputSchema: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['number'],
                        properties: {
                            number: { type: 'integer', minimum: 1 },
                        },
                    },
                    handler: async (ctx) => addIssueToContext(Number(ctx.input.number)),
                },
            ],
            open: async (ctx) => {
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer();
                    servers.set(ctx.instanceId, entry);
                }
                return {
                    title: 'Issue triage board',
                    status: `${issues.length} open issues`,
                    url: entry.url,
                };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (entry) {
                    servers.delete(ctx.instanceId);
                    await new Promise((resolve) => entry.server.close(resolve));
                }
            },
        }),
    ],
});
