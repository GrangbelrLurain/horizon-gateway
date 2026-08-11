import type {
  Annotation_Serialize,
  AnnotationLocator_Serialize,
  LocatorStrategy,
  LocatorValidation_Serialize,
  LocatorValidationStatus,
} from "@/shared/api";

/** Runtime annotation from the API (required fields). Prefer over the specta Serialize|Deserialize union. */
export type Annotation = Annotation_Serialize;
export type AnnotationLocator = AnnotationLocator_Serialize;
export type LocatorValidation = LocatorValidation_Serialize;
export type { LocatorStrategy, LocatorValidationStatus };

/** FE-only: captured element before saving as annotation */
export interface CapturedElement {
  selector: string;
  content: string;
  tagName: string;
  thumbnail: string;
  domain: string;
  url: string;
}
