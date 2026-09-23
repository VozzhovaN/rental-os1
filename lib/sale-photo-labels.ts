export function isFloorPlanCaption(caption: string | null | undefined) {
  if (!caption) return false;
  return /планировк|floor\s*plan|layout/i.test(caption);
}
