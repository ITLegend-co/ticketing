import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pastedPhotos, appendReplyPhotos } from '../src/paste-photos.ts';
const photo = () => new File(['screenshot'], 'image.png', { type: 'image/png' });
const item = (file) => ({ kind: 'file', type: file.type, getAsFile: () => file });
test('clipboard text is left alone and image files receive distinct screenshot names', () => {
  assert.deepEqual(pastedPhotos([{ kind: 'string', type: 'text/plain' }]), []);
  const files = pastedPhotos([item(photo()), item(photo())]);
  assert.equal(files.length, 2);
  assert.equal(files[0].type, 'image/png');
  assert.equal(files[0].size, photo().size);
  assert.match(files[0].name, /^Screenshot-.*\.png$/);
  assert.notEqual(files[0].name, files[1].name);
});
test('unsupported and excessive images leave the original draft intact', () => {
  const original = [photo()];
  assert.throws(() => appendReplyPhotos(original, [new File(['x'],'a.gif',{type:'image/gif'})]));
  assert.equal(original.length,1);
  assert.throws(() => appendReplyPhotos(original, Array.from({length:5},photo)));
  assert.equal(appendReplyPhotos(original,[photo()]).length,2);
  assert.equal(original.length,1);
  assert.throws(() => appendReplyPhotos([], [new File([new Uint8Array(5*1024*1024+1)],'large.png',{type:'image/png'})]));
});
