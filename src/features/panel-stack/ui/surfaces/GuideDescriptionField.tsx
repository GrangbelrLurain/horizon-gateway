import { useAtomValue } from "jotai";
import { type RefObject, useImperativeHandle, useMemo, useRef } from "react";
import { themeAtom } from "@/entities/app";
import {
  buildUnifiedGuideSuggestions,
  GUIDE_FEATURE_ALIASES,
  type GuideFeatureAlias,
  type GuideFeatureLang,
  guideFeatureMarkdown,
  isGuideFeatureAlias,
} from "@/shared/lib/guideFeatureLinks";
import type { GuideMarkdownEditorHandle } from "@/shared/ui/markdown-textarea/GuideMarkdownEditor";
import { type MonacoEditorInstance, type SuggestionItem, TsCodeEditor } from "@/shared/ui/ts-code-editor/TsCodeEditor";
import { useDomainHubData } from "../../hooks/useDomainHubData";
import type { policiesKo } from "./policies-ko";

type Labels = typeof policiesKo;

function featureLabel(alias: GuideFeatureAlias, t: Labels): string {
  switch (alias) {
    case "mocking":
      return t.featureLinkMocking;
    case "logs":
    case "api-logs":
      return t.featureLinkLogs;
    case "schema":
    case "json-schema":
      return t.featureLinkSchema;
    case "local":
    case "proxy-graph":
      return t.featureLinkLocal;
    case "inject":
    case "live-capture":
      return t.featureLinkInject;
    default:
      return alias;
  }
}

export function GuideDescriptionField({
  value,
  onChange,
  t,
  editorRef,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  t: Labels;
  lang?: GuideFeatureLang;
  editorRef?: RefObject<GuideMarkdownEditorHandle | null>;
}) {
  const theme = useAtomValue(themeAtom);
  const { domains: registeredDomains, getDomainHost } = useDomainHubData();
  const monacoEditorRef = useRef<MonacoEditorInstance | null>(null);

  const insertAlias = (alias: GuideFeatureAlias, labelOverride?: string) => {
    const label = labelOverride?.trim() || featureLabel(alias, t);
    const snippet = guideFeatureMarkdown(alias, label);
    const editor = monacoEditorRef.current;
    if (editor) {
      const selection = editor.getSelection();
      if (selection) {
        editor.executeEdits("guide-feature-insert", [
          {
            range: selection,
            text: snippet,
            forceMoveMarkers: true,
          },
        ]);
        editor.focus();
        return;
      }
    }
    onChange(value ? `${value} ${snippet}` : snippet);
  };

  useImperativeHandle(editorRef, () => ({
    insertAlias,
    getValue: () => monacoEditorRef.current?.getValue() ?? value,
  }));

  const customSuggestions = useMemo<SuggestionItem[]>(() => {
    const domainInfos = registeredDomains.map((d) => ({
      id: d.id,
      host: getDomainHost(d),
    }));
    const unifiedItems = buildUnifiedGuideSuggestions({ domains: domainInfos });
    return unifiedItems.map((item) => ({
      label: item.labels.ko,
      insertText: item.customMarkdown || guideFeatureMarkdown(item.alias, item.labels.ko, item),
      detail: item.description.ko,
    }));
  }, [registeredDomains, getDomainHost]);

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <select
          className="select select-bordered select-xs h-7 min-h-7 text-[10px] font-medium w-auto max-w-[11rem]"
          value=""
          aria-label={t.featureLinkInsert}
          onChange={(e) => {
            const alias = e.target.value;
            if (isGuideFeatureAlias(alias)) {
              insertAlias(alias, featureLabel(alias, t));
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
      <div className="flex-1 min-h-[160px] overflow-hidden">
        <TsCodeEditor
          value={value}
          onChange={onChange}
          language="markdown"
          theme={theme}
          customSuggestions={customSuggestions}
          editorRef={monacoEditorRef}
          className="h-full min-h-[160px]"
        />
      </div>
    </div>
  );
}
