// Avoid downloading completed lookup results on every scheduled queue check.
export async function readLookupRequest(db, ref) {
  const [snap] = await db.getAll(ref, {fieldMask: ['status','owner','id','requestedAt','links']});
  const data = snap.data();
  return data?.status === 'pending' ? data : null;
}

// Read the marker inside the transaction: concurrent first imports remain serialized.
export async function withUnappliedSeed(db, marker, catalog, apply) {
  return db.runTransaction(async tx => {
    if ((await tx.get(marker)).exists) return false;
    const snapshot = await tx.get(catalog);
    await apply(tx, snapshot);
    return true;
  });
}
