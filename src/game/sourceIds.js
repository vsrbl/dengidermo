export function sourceId(source) {
  return typeof source === "string" ? source : source?.ownerId || source?.id || null;
}

export function ownerPlayer(state, source) {
  const id = sourceId(source);
  return id ? state?.players?.[id] || null : null;
}
