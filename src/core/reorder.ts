import type { ItemDropTarget, Key } from "react-aria-components";

/** Moves the dragged ids to where they were dropped in a list's order. */
export function reorder(ids: string[], keys: Set<Key>, target: ItemDropTarget) {
  const moving = ids.filter((id) => keys.has(id));
  const rest = ids.filter((id) => !keys.has(id));
  let index = rest.indexOf(String(target.key));
  if (target.dropPosition === "after") index++;
  rest.splice(index, 0, ...moving);
  return rest;
}
