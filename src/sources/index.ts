import type { ImageSource } from "../imageSearch";
import { artic } from "./artic";
import { commons } from "./commons";
import { smk } from "./smk";
import { wellcome } from "./wellcome";

/**
 * Each is searched directly from the browser, so every one allows
 * cross-origin requests for both its API and its image files.
 */
export const IMAGE_SOURCES: ImageSource[] = [commons, artic, smk, wellcome];
