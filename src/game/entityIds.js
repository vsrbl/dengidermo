let entitySeq = 1;

export function resetEntityIds() {
  entitySeq = 1;
}

export function nextId(prefix) {
  entitySeq += 1;
  return `${prefix}${entitySeq}`;
}
