import { open } from 'node:fs/promises';
import { paperLoopInputSchema } from '../../application/paperLoop/input.ts';

/** Local operator-provided file; never resolve dataRef or fetch a client-supplied URL. */
export async function readPaperLoopTask(path: string) {
  const file = await open(path, 'r');
  try {
    if ((await file.stat()).size > 1048576) throw new Error('Paper loop task too large');
    return paperLoopInputSchema.parse(JSON.parse(await file.readFile('utf8')));
  } finally { await file.close(); }
}
