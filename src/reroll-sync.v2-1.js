// Reconcile optimistic reroll clicks with the authoritative remaining server charges.
export function reconcileRerollAvailability(serverValue, pendingValue = 0, seenValue = null) {
  const serverLeft = Math.max(0, Number(serverValue || 0) | 0);
  let pending = Math.max(0, Number(pendingValue || 0) | 0);
  const hadSeen = Number.isFinite(Number(seenValue));
  const seen = hadSeen ? Math.max(0, Number(seenValue) | 0) : serverLeft;

  // Every authoritative decrease acknowledges that many optimistic clicks. Remove
  // those clicks from the pending counter before calculating visible availability.
  if (hadSeen && serverLeft < seen) pending = Math.max(0, pending - (seen - serverLeft));

  return {
    serverLeft,
    pending,
    seen: serverLeft,
    available: Math.max(0, serverLeft - pending)
  };
}
