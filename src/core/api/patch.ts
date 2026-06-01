import { ServerApi } from "@shared/contracts";

type TTopLevelDiffPatchOptions = {
  requiredPaths?: string[];
};

const pathToKey = (path: string): string => path.replace(/^\//, "");

export const buildTopLevelDiffPatch = <T extends object>(
  prev: T | null | undefined,
  next: T,
  options: TTopLevelDiffPatchOptions = {}
): ServerApi.PatchOperation[] => {
  const patch: ServerApi.PatchOperation[] = [];
  const requiredKeys = new Set((options.requiredPaths || []).map(pathToKey));
  const pushedKeys = new Set<string>();
  const nextRecord = next as Record<string, unknown>;

  if (!prev) {
    Object.entries(nextRecord).forEach(([key, value]) => {
      patch.push({ op: "replace", path: `/${key}`, value });
      pushedKeys.add(key);
    });
    return patch;
  }

  requiredKeys.forEach((key) => {
    if (!(key in nextRecord)) return;
    patch.push({ op: "replace", path: `/${key}`, value: nextRecord[key] });
    pushedKeys.add(key);
  });

  const prevRecord = prev as Record<string, unknown>;
  Object.keys(nextRecord).forEach((key) => {
    if (pushedKeys.has(key)) return;
    const prevValue = prevRecord[key];
    const nextValue = nextRecord[key];
    if (JSON.stringify(prevValue) === JSON.stringify(nextValue)) return;
    patch.push({ op: "replace", path: `/${key}`, value: nextValue });
  });

  return patch;
};
