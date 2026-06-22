export type { Annotation } from "@/shared/api";

/** FE-only: captured element before saving as annotation */
export interface CapturedElement {
  selector: string;
  content: string;
  tagName: string;
  thumbnail: string;
  domain: string;
  url: string;
}
