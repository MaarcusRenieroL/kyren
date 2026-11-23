import type { ModuleManifest } from "./types";
import { coreManifests } from "./manifests/core";
import { collabManifests } from "./manifests/collab";
import { extendedManifests } from "./manifests/extended";

// Registration order decides the order of items inside a nav section.
export const moduleRegistry: readonly ModuleManifest[] = [
  ...coreManifests,
  ...collabManifests,
  ...extendedManifests,
];
