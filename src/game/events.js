import { nextId } from "./entityIds.js";

export function pushEvent(state, event) {
  if (!state || !Array.isArray(state.events)) return null;
  const queued = {
    ...(event || {}),
    id: event?.id || nextId("ev"),
    t: Number.isFinite(event?.t) ? event.t : state.time
  };
  state.events.push(queued);
  if (state.events.length > 32) state.events.splice(0, state.events.length - 32);
  return queued;
}
