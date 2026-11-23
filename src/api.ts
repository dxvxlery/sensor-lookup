import { cachedGet } from "./cache";
import { apiGet } from "./net";

type Id = string;
const T = "/api/tracker/";
const m = (id: Id, sub = "") => `/members/${id}${sub}`;

export const api = {
  info: (id: Id, force?: boolean) => cachedGet(`${T}get-user-info?content=${id}`, m(id), force),
  friends: (id: Id, page: number, sort: string, order: string, force?: boolean) =>
    cachedGet(`${T}get-friends/${id}?page=${page}&sort=${sort}&order=${order}`, m(id, "/friends"), force),
  events: (id: Id, sub: string, page: number, sortBy: string, order: string, type: string, force?: boolean) =>
    cachedGet(
      `/api/users/get-latest-events/${id}?subTab=${sub}&limit=20&page=${page + 1}&sortBy=${sortBy}&sortOrder=${order}${type ? `&eventType=${type}` : ""}`,
      m(id, `/events?sub=${sub}`),
      force,
    ),
  voiceMembers: (id: Id, eventId: string | number, force?: boolean) =>
    cachedGet(`/api/users/get-voice-members/${eventId}`, m(id, "/events?sub=voice_history"), force),
  sessions: (id: Id, peer: Id, sort: string, page: number, force?: boolean) =>
    cachedGet(`${T}get-friends-voice-sessions/${id}/${peer}?page=${page}&sort=${sort}&order=desc`, m(id, "/friends"), force),
  nicknames: (id: Id, page: number, force?: boolean) =>
    cachedGet(`${T}get-nicknames/${id}?page=${page}&sort=desc`, m(id, "/nicknames"), force),
  guilds: (id: Id, force?: boolean) => cachedGet(`${T}get-mutual-guilds/${id}`, m(id), force),
  comments: (id: Id, page: number, force?: boolean) =>
    cachedGet(`/api/servers/get-comments/user/${id}?page=${page + 1}&page_size=50`, m(id), force),
  photos: (id: Id, type: string, page: number, force?: boolean) =>
    cachedGet(
      `/api/photos/list?type=${type}&page=${page + 1}&sort_by=${id}`,
      m(id, "/media" + (type === "deleted" ? "?view=deleted" : "")),
      force,
    ),
  voiceNow: (id: Id) => apiGet(`${T}member-voice-now?content=${id}`, m(id)),
};
