const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, stopServer, removeDir, tempDataDir, login, client } = require('../test-utils/harness');

test('API permissions, meeting attendees and backup/restore round-trip', async (t) => {
  const dataDir = tempDataDir();
  const server = await startServer({
    DATA_DIR: dataDir,
    LEGACY_DB: path.join(dataDir, 'no-legacy.db'),
    ADMIN_USER: 'admin',
    ADMIN_PASS: 'admin123',
  });
  t.after(async () => {
    await stopServer(server);
    await removeDir(dataDir);
  });

  const base = server.base;
  const admin = await login(base, 'admin', 'admin123');
  const asAdmin = client(base, admin.cookie);

  // --- create a full event ---
  let res = await asAdmin('POST', '/api/events', { name: 'Test Gala', date: '2026-11-01', location: 'Hall' });
  assert.equal(res.status, 201);
  const eventId = res.data.id;

  res = await asAdmin('POST', `/api/events/${eventId}/members`, { name: 'Alice', role: 'Lead' });
  assert.equal(res.status, 201);
  const aliceId = res.data.id;

  res = await asAdmin('POST', `/api/events/${eventId}/tasks`, { title: 'Book venue', memberIds: [aliceId] });
  assert.equal(res.status, 201);

  res = await asAdmin('POST', `/api/events/${eventId}/design/locations`, { name: 'Main Hall' });
  assert.equal(res.status, 201);
  const locationId = res.data.id;

  res = await asAdmin('POST', `/api/events/${eventId}/shows`, {
    name: 'Opening', type: 'opening', location_id: locationId, segments: [{ name: 'Intro' }],
  });
  assert.equal(res.status, 201);
  const showId = res.data.id;

  res = await asAdmin('POST', `/api/events/${eventId}/meetings`, {
    title: 'Kickoff',
    attendees: [{ ref_type: 'member', ref_id: aliceId, label: 'Alice', status: 'confirmed' }],
  });
  assert.equal(res.status, 201);
  const meetingId = res.data.id;

  const fileBody = Buffer.from('hello attachment').toString('base64');
  res = await asAdmin('POST', `/api/events/${eventId}/files`, { name: 'note.txt', mime: 'text/plain', data: fileBody });
  assert.equal(res.status, 201);
  const fileId = res.data.id;

  // Bug regression: meeting attendees were queried with the wrong column.
  res = await asAdmin('GET', `/api/events/${eventId}`);
  assert.equal(res.status, 200);
  assert.equal(res.data.meetings.length, 1);
  assert.equal(res.data.meetings[0].id, meetingId);
  assert.equal(res.data.meetings[0].attendees.length, 1);
  assert.equal(res.data.meetings[0].attendees[0].ref_id, aliceId);
  assert.equal(res.data.shows[0].location_id, locationId);
  assert.equal(res.data.tasks[0].memberIds.length, 1);

  // --- viewer: assigned event, read-only team tab ---
  res = await asAdmin('POST', '/api/users', {
    username: 'viewer1',
    password: 'pass1234',
    role: 'viewer',
    permissions: { team: 'view' },
    eventIds: [eventId],
  });
  assert.equal(res.status, 201);

  const viewer = await login(base, 'viewer1', 'pass1234');
  const asViewer = client(base, viewer.cookie);

  // Bug regression: every non-admin request was stopped by the admin route guard.
  res = await asViewer('GET', '/api/events');
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.length, 1);
  assert.equal(res.data[0].id, eventId);

  res = await asViewer('GET', `/api/events/${eventId}`);
  assert.equal(res.status, 200);

  res = await asViewer('POST', `/api/events/${eventId}/members`, { name: 'Should fail' });
  assert.equal(res.status, 403);

  res = await asViewer('GET', '/api/users');
  assert.equal(res.status, 403);

  // --- assignee: sees assigned tasks via /api/my-tasks ---
  res = await asAdmin('POST', '/api/users', {
    username: 'worker1', password: 'pass1234', role: 'assignee', permissions: [],
  });
  assert.equal(res.status, 201);
  const workerId = res.data.id;

  res = await asAdmin('GET', `/api/events/${eventId}`);
  const task = res.data.tasks[0];
  res = await asAdmin('PUT', `/api/events/${eventId}/tasks/${task.id}`, {
    title: task.title, memberIds: [aliceId], assigneeIds: [workerId],
  });
  assert.equal(res.status, 200);

  const worker = await login(base, 'worker1', 'pass1234');
  const asWorker = client(base, worker.cookie);
  res = await asWorker('GET', '/api/my-tasks');
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.length, 1);
  assert.equal(res.data[0].event_id, eventId);

  // --- backup + restore ---
  const backupRes = await fetch(base + '/api/admin/backup', {
    headers: { Cookie: admin.cookie, Origin: base },
  });
  assert.equal(backupRes.status, 200);
  assert.equal(backupRes.headers.get('content-type'), 'application/zip');
  const zip = Buffer.from(await backupRes.arrayBuffer());
  assert.ok(zip.length > 0);

  const form = new FormData();
  form.append('backup', new Blob([zip], { type: 'application/zip' }), 'backup.zip');
  const restoreRes = await fetch(base + '/api/admin/restore', {
    method: 'POST',
    headers: { Cookie: admin.cookie, Origin: base },
    body: form,
  });
  const restoreText = await restoreRes.text();
  assert.equal(restoreRes.status, 200, restoreText);
  const restore = JSON.parse(restoreText);
  assert.equal(restore.importedEvents, 1);

  res = await asAdmin('GET', '/api/events');
  assert.equal(res.data.length, 2);
  const restored = res.data.find((e) => e.name.startsWith('Test Gala_restored_'));
  assert.ok(restored, JSON.stringify(res.data));

  res = await asAdmin('GET', `/api/events/${restored.id}`);
  assert.equal(res.status, 200);
  const copy = res.data;
  assert.equal(copy.members.length, 1);
  assert.equal(copy.tasks.length, 1);
  assert.equal(copy.tasks[0].memberIds.length, 1);
  assert.equal(copy.tasks[0].memberIds[0], copy.members[0].id);
  assert.equal(copy.meetings.length, 1);
  assert.equal(copy.meetings[0].attendees.length, 1);
  assert.equal(copy.meetings[0].attendees[0].ref_id, copy.members[0].id);
  assert.equal(copy.shows.length, 1);
  assert.equal(copy.shows[0].segments.length, 1);
  assert.equal(copy.design.locations.length, 1);
  assert.equal(copy.shows[0].location_id, copy.design.locations[0].id);
  assert.equal(copy.files.length, 1);

  const download = await fetch(base + `/api/events/${restored.id}/files/${copy.files[0].id}`, {
    headers: { Cookie: admin.cookie },
  });
  assert.equal(download.status, 200);
  assert.equal(await download.text(), 'hello attachment');
});
