import { type RefObject, useRef } from "react";
import {
  GUIDE_FEATURE_ALIASES,
  type GuideFeatureAlias,
  type GuideFeatureLang,
  isGuideFeatureAlias,
} from "@/shared/lib/guideFeatureLinks";
import { GuideMarkdownEditor, type GuideMarkdownEditorHandle } from "@/shared/ui/markdown-textarea/GuideMarkdownEditor";
import type { policiesKo } from "./policies-ko";

type Labels = typeof policiesKo;

function featureLabel(alias: GuideFeatureAlias, t: Labels): string {
  switch (alias) {
    case "mocking":
      return t.featureLinkMocking;
    case "logs":
      return t.featureLinkLogs;
    case "schema":
      return t.featureLinkSchema;
    case "local":
      return t.featureLinkLocal;
    case "inject":
      return t.featureLinkInject;
  }
}

export function GuideDescriptionField({
  id,
  value,
  onChange,
  placeholder,
  t,
  lang = "ko",
  editorRef,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  t: Labels;
  lang?: GuideFeatureLang;
  editorRef?: RefObject<GuideMarkdownEditorHandle | null>;
}) {
  const localRef = useRef<GuideMarkdownEditorHandle>(null);
  const resolvedRef = editorRef ?? localRef;

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <select
          className="select select-bordered select-xs h-7 min-h-7 text-[10px] font-bold w-auto max-w-[11rem]"
          value=""
          aria-label={t.featureLinkInsert}
          onChange={(e) => {
            const alias = e.target.value;
            if (isGuideFeatureAlias(alias)) {
              resolvedRef.current?.insertAlias(alias, featureLabel(alias, t));
            }
            e.currentTarget.value = "";
          }}
        >
          <option value="">{t.featureLinkInsert}</option>
          {GUIDE_FEATURE_ALIASES.map((alias) => (
            <option key={alias} value={alias}>
              {featureLabel(alias, t)}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-base-content/40 m-0 truncate">{t.featureLinkHint}</p>
      </div>
      <GuideMarkdownEditor
        ref={resolvedRef}
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        lang={lang}
        variant="hub"
      />
    </div>
  );
}
