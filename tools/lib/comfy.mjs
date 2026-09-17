/**
 * ComfyUI over its HTTP API, shared by gen-video-local and gen-image-local: start the portable
 * server if nothing is listening, upload an input image, queue an API-format graph, follow it
 * over the websocket, and fetch the output. See docs/local-video.md and docs/local-image.md.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function comfyDir() {
  return process.env['COMFYUI_DIR'] ?? 'C:\\Users\\smite\\ComfyUI_windows_portable';
}

export async function alive(server) {
  try {
    return (await fetch(`${server}/system_stats`)).ok;
  } catch {
    return false;
  }
}

/** Start the portable build headless if the server is not up; returns the child or null. */
export async function ensureServer(server, logFile) {
  if (await alive(server)) return null;
  const dir = comfyDir();
  const python = path.join(dir, 'python_embeded', 'python.exe');
  if (!fs.existsSync(python)) throw new Error(`ComfyUI not found at ${dir} (set COMFYUI_DIR)`);
  const port = new URL(server).port || '8188';
  console.log(`starting ComfyUI from ${dir} on port ${port} ...`);
  // The log goes to a file descriptor, not pipes, so a server left running (--keep-server)
  // does not keep this process alive.
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const log = fs.openSync(logFile, 'a');
  const child = spawn(
    python,
    ['-s', 'ComfyUI\\main.py', '--disable-auto-launch', '--listen', '127.0.0.1', '--port', port],
    { cwd: dir, stdio: ['ignore', log, log], windowsHide: true, detached: true },
  );
  for (let i = 0; i < 120 && !(await alive(server)); i++) await sleep(1000);
  if (!(await alive(server)))
    throw new Error(`ComfyUI did not come up in 2 minutes (see ${logFile})`);
  console.log('ComfyUI is up');
  return child;
}

/** Upload PNG bytes to the server's input folder; returns the name LoadImage wants. */
export async function upload(server, bytes, filename) {
  const form = new FormData();
  form.append('image', new Blob([bytes], { type: 'image/png' }), filename);
  form.append('overwrite', 'true');
  const res = await fetch(`${server}/upload/image`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`upload failed ${res.status}: ${await res.text()}`);
  const { name, subfolder } = await res.json();
  return subfolder ? `${subfolder}/${name}` : name;
}

/** Queue a graph; resolves to the prompt id, or throws with ComfyUI's node errors. */
export async function queue(server, graph, clientId) {
  const res = await fetch(`${server}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: graph, client_id: clientId }),
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(`queue failed: ${JSON.stringify(json)}`);
    err.nodeErrors = json.node_errors ?? {};
    throw err;
  }
  return json.prompt_id;
}

/** Follow a queued prompt over the websocket, printing sampler steps; resolves when it is done. */
export function follow(server, clientId, promptId) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${server.replace(/^http/, 'ws')}/ws?clientId=${clientId}`);
    let last = '';
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      const msg = JSON.parse(ev.data);
      const d = msg.data ?? {};
      if (msg.type === 'progress' && d.prompt_id === promptId) {
        const line = `  step ${d.value}/${d.max} (${Math.round((Date.now() - t0) / 1000)}s)`;
        if (line !== last) console.log((last = line));
      } else if (msg.type === 'execution_error' && d.prompt_id === promptId) {
        ws.close();
        reject(new Error(`ComfyUI error in node ${d.node_id}: ${d.exception_message}`));
      } else if (msg.type === 'executing' && d.prompt_id === promptId && d.node === null) {
        ws.close();
        resolve(Math.round((Date.now() - t0) / 1000));
      }
    };
    ws.onerror = () => reject(new Error('websocket error'));
  });
}

/** The finished prompt's first output file matching the pattern, as bytes plus its name. */
export async function output(server, promptId, pattern) {
  const hist = await (await fetch(`${server}/history/${promptId}`)).json();
  const entry = hist[promptId];
  if (!entry || entry.status?.status_str !== 'success')
    throw new Error(`run did not succeed: ${JSON.stringify(entry?.status)}`);
  const files = Object.values(entry.outputs).flatMap((o) => o.images ?? o.gifs ?? []);
  const file = files.find((f) => pattern.test(f.filename));
  if (!file) throw new Error(`no matching output: ${JSON.stringify(entry.outputs)}`);
  const q = new URLSearchParams({
    filename: file.filename,
    subfolder: file.subfolder ?? '',
    type: file.type ?? 'output',
  });
  const bytes = Buffer.from(await (await fetch(`${server}/view?${q}`)).arrayBuffer());
  return { bytes, filename: file.filename };
}

/** Stop a server this process started, or let it live on without holding this process open. */
export function stopServer(child, keep = false) {
  if (!child) return;
  if (keep) {
    child.unref();
    console.log('ComfyUI left running on its port');
  } else {
    child.kill();
    console.log('ComfyUI stopped');
  }
}
