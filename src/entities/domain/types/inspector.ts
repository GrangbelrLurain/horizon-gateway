export interface CapturedElement {
  selector: string;
  content: string;
  tagName: string;
  thumbnail: string;
  domain: string;
  url: string;
}

export interface Annotation extends CapturedElement {
  id: string;
  role: string;
  description: string;
  timestamp: number;
}
