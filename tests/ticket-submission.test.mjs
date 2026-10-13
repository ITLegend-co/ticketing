import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_PHOTO_BYTES, validatePhotos, submitWithPhotos } from '../src/ticket-submission.ts';
const photo = (name = 'screenshot.png') => ({ name, type: 'image/png', size: 1024 });

test('rejects unsupported, empty, oversized and excess pictures before saving', async () => {
  for (const files of [
    [{ ...photo(), type: 'image/svg+xml' }], [{ ...photo(), size: 0 }],
    [{ ...photo(), size: MAX_PHOTO_BYTES + 1 }], Array.from({ length: 6 }, () => photo()),
  ]) {
    let saves = 0;
    await assert.rejects(submitWithPhotos(files, async () => { saves++; return { id: 'request' }; }, async () => {}));
    assert.equal(saves, 0);
  }
  assert.doesNotThrow(() => validatePhotos([{ ...photo(), size: MAX_PHOTO_BYTES }]));
});
test('saves once then uploads each picture against that request', async () => {
  const events = [];
  const result = await submitWithPhotos([photo('a.png'), photo('b.png')], async () => {
    events.push('save'); return { id: 'saved-request' };
  }, async (id, file) => events.push(`${id}/${file.name}`), (index, total) => events.push(`${index}/${total}`));
  assert.deepEqual(events, ['save', '1/2', 'saved-request/a.png', '2/2', 'saved-request/b.png']);
  assert.equal(result.ticket.id, 'saved-request');
  assert.deepEqual(result.incomplete, []);
});
test('a failed ticket save does not upload pictures', async () => {
  let uploads = 0;
  await assert.rejects(submitWithPhotos([photo()], async () => { throw new Error('Permission denied'); }, async () => { uploads++; }), /Permission denied/);
  assert.equal(uploads, 0);
});
test('partial upload failure keeps the saved request and never retries an uncertain upload', async () => {
  let saves = 0;
  const uploaded = [];
  const error = new Error('Connection interrupted');
  const result = await submitWithPhotos([photo('a.png'), photo('b.png'), photo('c.png')], async () => {
    saves++; return { id: 'existing-request' };
  }, async (_, file) => {
    uploaded.push(file.name);
    if (file.name === 'b.png') throw error;
  });
  assert.equal(saves, 1);
  assert.equal(result.ticket.id, 'existing-request');
  assert.deepEqual(uploaded, ['a.png', 'b.png']);
  assert.deepEqual(result.incomplete.map(file => file.name), ['b.png', 'c.png']);
  assert.equal(result.error, error);
});
test('requests without pictures still save normally', async () => {
  const result = await submitWithPhotos([], async () => ({ id: 'no-photos' }), async () => assert.fail('Unexpected upload'));
  assert.equal(result.ticket.id, 'no-photos');
  assert.deepEqual(result.incomplete, []);
});
