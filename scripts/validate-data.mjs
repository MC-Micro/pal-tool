import fs from 'node:fs';
import path from 'node:path';

import { validatePublishedPassiveReferenceAgainstApproval } from '../tools/pal-data-core/scripts/publish-passive-reference.mjs';

const root = path.resolve(process.cwd());

try {
  const passiveReference = JSON.parse(
    fs.readFileSync(path.join(root, 'data/palworld-core/passives.json'), 'utf8')
  );
  const passiveApproval = JSON.parse(
    fs.readFileSync(path.join(root, 'data/palworld-core/passives.approval.json'), 'utf8')
  );
  validatePublishedPassiveReferenceAgainstApproval(passiveReference, passiveApproval);
  console.log('Validierung erfolgreich: Der kanonische 115er Passive-Referenzraum stimmt mit seiner Approval überein.');
} catch (error) {
  console.error(`Kanonischer Passive-Referenzraum ist ungültig: ${error.message}`);
  process.exit(1);
}
