// Export requirements only. This command never runs Kane or approves a test.
import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { campaignRequirements } from './assurance.js';
import { candidate, fingerprint, readState } from './state.js';

try {
  const revision = candidate(readState());
  if (!revision) throw new Error('Confirm a promotion in LaunchGate first.');
  const id = fingerprint(revision);
  const folder = path.resolve(process.env.LAUNCHGATE_DATA_DIR || 'data', 'operator', `revision-${revision.id}-${id.slice(0, 12)}`);
  const source = campaignRequirements(revision);
  const sourceFile = path.join(folder, 'campaign.md');
  if (existsSync(sourceFile)) {
    if (readFileSync(sourceFile, 'utf8') !== source) throw new Error('This export targets a different URL or requirement version. Restore the original settings or use a separate LAUNCHGATE_DATA_DIR; existing work was not overwritten.');
  } else {
    mkdirSync(path.join(folder, '.testmuai/variables'), { recursive: true });
    writeFileSync(sourceFile, source, { flag: 'wx' });
    writeFileSync(path.join(folder, '.testmuai/variables/assurance.json'), JSON.stringify({ start_url: { value: `http://127.0.0.1:${process.env.PORT || 4173}/?campaign=${revision.id}`, secret: false, description: 'Exact confirmed candidate preview' } }, null, 2), { flag: 'wx' });
    writeFileSync(path.join(folder, 'export.json'), JSON.stringify({ revisionId: revision.id, fingerprint: id, exportedAt: new Date().toISOString(), source: 'confirmed policy and demo catalog', purpose: 'Independent CLI testing; does not authorize activation' }, null, 2), { flag: 'wx' });
  }
  // Only the path goes to stdout so it can be used in a quoted shell variable.
  console.log(folder);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Could not export the current promotion.');
  process.exitCode = 1;
}
