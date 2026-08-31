async function request(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

const api = {
  events: () => request('GET', '/api/events'),
  event: (id) => request('GET', '/api/events/' + id),
  createEvent: (body) => request('POST', '/api/events', body),
  updateEvent: (id, body) => request('PUT', '/api/events/' + id, body),
  deleteEvent: (id) => request('DELETE', '/api/events/' + id),

  addMember: (id, body) => request('POST', `/api/events/${id}/members`, body),
  updateMember: (id, mid, body) => request('PUT', `/api/events/${id}/members/${mid}`, body),
  deleteMember: (id, mid) => request('DELETE', `/api/events/${id}/members/${mid}`),

  addTask: (id, body) => request('POST', `/api/events/${id}/tasks`, body),
  updateTask: (id, tid, body) => request('PUT', `/api/events/${id}/tasks/${tid}`, body),
  deleteTask: (id, tid) => request('DELETE', `/api/events/${id}/tasks/${tid}`),

  addSponsor: (id, body) => request('POST', `/api/events/${id}/sponsors`, body),
  updateSponsor: (id, sid, body) => request('PUT', `/api/events/${id}/sponsors/${sid}`, body),
  deleteSponsor: (id, sid) => request('DELETE', `/api/events/${id}/sponsors/${sid}`),

  addTimelineItem: (id, body) => request('POST', `/api/events/${id}/timeline`, body),
  updateTimelineItem: (id, tid, body) => request('PUT', `/api/events/${id}/timeline/${tid}`, body),
  deleteTimelineItem: (id, tid) => request('DELETE', `/api/events/${id}/timeline/${tid}`),

  listFiles: (id) => request('GET', `/api/events/${id}/files`),
  addFile: (id, body) => request('POST', `/api/events/${id}/files`, body),
  deleteFile: (id, fid) => request('DELETE', `/api/events/${id}/files/${fid}`),
  downloadUrl: (id, fid) => `/api/events/${id}/files/${fid}`,

  addFinance: (id, body) => request('POST', `/api/events/${id}/finances`, body),
  updateFinance: (id, fid, body) => request('PUT', `/api/events/${id}/finances/${fid}`, body),
  deleteFinance: (id, fid) => request('DELETE', `/api/events/${id}/finances/${fid}`),

  addParticipant: (id, body) => request('POST', `/api/events/${id}/participants`, body),
  updateParticipant: (id, pid, body) => request('PUT', `/api/events/${id}/participants/${pid}`, body),
  deleteParticipant: (id, pid) => request('DELETE', `/api/events/${id}/participants/${pid}`),

  addGuest: (id, body) => request('POST', `/api/events/${id}/guests`, body),
  updateGuest: (id, gid, body) => request('PUT', `/api/events/${id}/guests/${gid}`, body),
  deleteGuest: (id, gid) => request('DELETE', `/api/events/${id}/guests/${gid}`),

  myTasks: () => request('GET', '/api/my-tasks'),
  assigneeUsers: () => request('GET', '/api/assignee-users'),
};