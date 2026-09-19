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
  financeDownloadUrl: (id, fid) => `/api/events/${id}/finances/${fid}/download`,
  addBudget: (id, body) => request('POST', `/api/events/${id}/budget`, body),
  updateBudget: (id, bid, body) => request('PUT', `/api/events/${id}/budget/${bid}`, body),
  deleteBudget: (id, bid) => request('DELETE', `/api/events/${id}/budget/${bid}`),
  addLocation: (id, body) => request('POST', `/api/events/${id}/design/locations`, body),
  updateLocation: (id, lid, body) => request('PUT', `/api/events/${id}/design/locations/${lid}`, body),
  deleteLocation: (id, lid) => request('DELETE', `/api/events/${id}/design/locations/${lid}`),
  addDesignPlan: (id, body) => request('POST', `/api/events/${id}/design/plans`, body),
  updateDesignPlan: (id, pid, body) => request('PUT', `/api/events/${id}/design/plans/${pid}`, body),
  deleteDesignPlan: (id, pid) => request('DELETE', `/api/events/${id}/design/plans/${pid}`),

  addParticipant: (id, body) => request('POST', `/api/events/${id}/participants`, body),
  updateParticipant: (id, pid, body) => request('PUT', `/api/events/${id}/participants/${pid}`, body),
  deleteParticipant: (id, pid) => request('DELETE', `/api/events/${id}/participants/${pid}`),

  addGuest: (id, body) => request('POST', `/api/events/${id}/guests`, body),
  updateGuest: (id, gid, body) => request('PUT', `/api/events/${id}/guests/${gid}`, body),
  deleteGuest: (id, gid) => request('DELETE', `/api/events/${id}/guests/${gid}`),

  addSpeaker: (id, body) => request('POST', `/api/events/${id}/speakers`, body),
  updateSpeaker: (id, sid, body) => request('PUT', `/api/events/${id}/speakers/${sid}`, body),
  deleteSpeaker: (id, sid) => request('DELETE', `/api/events/${id}/speakers/${sid}`),

  addWorkshop: (id, body) => request('POST', `/api/events/${id}/workshops`, body),
  updateWorkshop: (id, wid, body) => request('PUT', `/api/events/${id}/workshops/${wid}`, body),
  deleteWorkshop: (id, wid) => request('DELETE', `/api/events/${id}/workshops/${wid}`),

  addAdventure: (id, body) => request('POST', `/api/events/${id}/adventures`, body),
  updateAdventure: (id, aid, body) => request('PUT', `/api/events/${id}/adventures/${aid}`, body),
  deleteAdventure: (id, aid) => request('DELETE', `/api/events/${id}/adventures/${aid}`),

  addShow: (id, body) => request('POST', `/api/events/${id}/shows`, body),
  updateShow: (id, sid, body) => request('PUT', `/api/events/${id}/shows/${sid}`, body),
  deleteShow: (id, sid) => request('DELETE', `/api/events/${id}/shows/${sid}`),

  addMeeting: (id, body) => request('POST', `/api/events/${id}/meetings`, body),
  updateMeeting: (id, mid, body) => request('PUT', `/api/events/${id}/meetings/${mid}`, body),
  deleteMeeting: (id, mid) => request('DELETE', `/api/events/${id}/meetings/${mid}`),

  myTasks: () => request('GET', '/api/my-tasks'),
  assigneeUsers: () => request('GET', '/api/assignee-users'),
};