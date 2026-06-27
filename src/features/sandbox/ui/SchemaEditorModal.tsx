import { useAtom } from "jotai";
import { Check, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type SavedJsonSchema, savedJsonSchemasAtom } from "@/entities/sandbox";

interface SchemaProperty {
  id: string;
  name: string;
  type: "string" | "number" | "integer" | "boolean" | "object" | "array";
  description: string;
  required: boolean;
}

interface SchemaEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  schemaId?: string; // If provided, we edit this schema; if undefined, we create a new one
  onSave?: (savedSchemaId: string) => void;
}

export function SchemaEditorModal({ isOpen, onClose, schemaId, onSave }: SchemaEditorModalProps) {
  const [savedSchemas, setSavedSchemas] = useAtom(savedJsonSchemasAtom);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [properties, setProperties] = useState<SchemaProperty[]>([]);
  const [justSaved, setJustSaved] = useState(false);

  // Load existing schema if schemaId is passed
  useEffect(() => {
    if (isOpen) {
      if (schemaId) {
        const found = savedSchemas.find((s) => s.id === schemaId);
        if (found) {
          setTitle(found.name);
          setDescription(found.description);
          setProperties((found.properties as SchemaProperty[]) || []);
        }
      } else {
        // Reset to initial blank state for new schema creation
        setTitle("");
        setDescription("");
        setProperties([
          {
            id: Math.random().toString(36).substring(2, 9),
            name: "message",
            type: "string",
            description: "Default property",
            required: true,
          },
        ]);
      }
    }
  }, [isOpen, schemaId, savedSchemas]);

  // Generate JSON Schema Draft-07 live
  const generatedSchemaText = useMemo(() => {
    const propsObj: Record<string, any> = {};
    const requiredList: string[] = [];

    for (const prop of properties) {
      if (!prop.name.trim()) {
        continue;
      }
      propsObj[prop.name.trim()] = {
        type: prop.type,
        description: prop.description.trim() || undefined,
      };
      if (prop.required) {
        requiredList.push(prop.name.trim());
      }
    }

    const schemaObj: Record<string, any> = {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      type: "object",
      properties: propsObj,
    };

    if (requiredList.length > 0) {
      schemaObj.required = requiredList;
    }

    return JSON.stringify(schemaObj, null, 2);
  }, [title, description, properties]);

  // Add a new property row
  const addProperty = () => {
    const newProp: SchemaProperty = {
      id: Math.random().toString(36).substring(2, 9),
      name: "",
      type: "string",
      description: "",
      required: false,
    };
    setProperties([...properties, newProp]);
  };

  const removeProperty = (id: string) => {
    setProperties(properties.filter((p) => p.id !== id));
  };

  const updateProperty = (id: string, field: keyof SchemaProperty, val: any) => {
    setProperties(properties.map((p) => (p.id === id ? { ...p, [field]: val } : p)));
  };

  // Save changes back to Jotai
  const handleSave = () => {
    const targetTitle = title.trim() || "UntitledSchema";
    const targetDesc = description.trim();
    const finalSchemaId = schemaId || `schema_${Math.random().toString(36).substring(2, 9)}`;

    const newSchemaEntry: SavedJsonSchema = {
      id: finalSchemaId,
      name: targetTitle,
      description: targetDesc,
      schemaText: generatedSchemaText,
      properties: properties,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (schemaId) {
      // Update existing schema
      setSavedSchemas(savedSchemas.map((s) => (s.id === schemaId ? newSchemaEntry : s)));
    } else {
      // Insert new schema
      setSavedSchemas([...savedSchemas, newSchemaEntry]);
    }

    setJustSaved(true);
    setTimeout(() => {
      setJustSaved(false);
      if (onSave) {
        onSave(finalSchemaId);
      }
      onClose();
    }, 800);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-[999] p-4 select-none animate-fadeIn">
      <div className="bg-base-100 rounded-3xl shadow-2xl border border-base-300 w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-zoomIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-base-200/40 shrink-0">
          <span className="font-bold text-sm text-base-content/85 flex items-center gap-1.5">
            📝 {schemaId ? "JSON 스키마 편집기" : "새 JSON 스키마 생성"}
          </span>
          <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle text-base-content/50 hover:bg-base-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dual Panel Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden items-stretch">
          {/* Left Panel: Properties Builder (8 cols) */}
          <div className="lg:col-span-8 p-6 overflow-y-auto flex flex-col gap-4 border-r border-base-200">
            {/* Meta details */}
            <div className="grid grid-cols-2 gap-4 shrink-0">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider">
                  스키마 제목
                </label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full text-xs font-bold focus:outline-none"
                  placeholder="e.g. UserPropsSchema"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider">설명</label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full text-xs focus:outline-none"
                  placeholder="스키마 용도 설명..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Properties Builder Title */}
            <div className="flex items-center justify-between border-b border-base-200 pb-2 shrink-0">
              <span className="font-semibold text-xs text-base-content/70">속성 정의 (Properties)</span>
              <button onClick={addProperty} className="btn btn-xs btn-outline btn-primary flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> 속성 추가
              </button>
            </div>

            {/* Properties Rows */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px]">
              {properties.map((prop) => (
                <div
                  key={prop.id}
                  className="grid grid-cols-12 gap-2 p-3 bg-base-200/40 rounded-2xl border border-base-300 items-center relative"
                >
                  {/* Name (4 cols) */}
                  <div className="col-span-4">
                    <input
                      type="text"
                      className="input input-bordered input-xs w-full text-xs focus:outline-none font-mono font-semibold"
                      placeholder="속성명 (e.g. title)"
                      value={prop.name}
                      onChange={(e) => updateProperty(prop.id, "name", e.target.value)}
                    />
                  </div>

                  {/* Type (3 cols) */}
                  <div className="col-span-3">
                    <select
                      className="select select-bordered select-xs w-full text-xs font-semibold focus:outline-none"
                      value={prop.type}
                      onChange={(e) => updateProperty(prop.id, "type", e.target.value)}
                    >
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="integer">integer</option>
                      <option value="boolean">boolean</option>
                      <option value="object">object</option>
                      <option value="array">array</option>
                    </select>
                  </div>

                  {/* Required (1.5 cols) */}
                  <div className="col-span-1.5 flex items-center justify-center">
                    <label className="label cursor-pointer flex items-center gap-1.5 p-0">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary checkbox-xs rounded"
                        checked={prop.required}
                        onChange={(e) => updateProperty(prop.id, "required", e.target.checked)}
                      />
                      <span className="text-[10px] font-bold text-base-content/60">필수</span>
                    </label>
                  </div>

                  {/* Description (2.5 cols) */}
                  <div className="col-span-2.5">
                    <input
                      type="text"
                      className="input input-bordered input-xs w-full text-xs focus:outline-none"
                      placeholder="설명"
                      value={prop.description}
                      onChange={(e) => updateProperty(prop.id, "description", e.target.value)}
                    />
                  </div>

                  {/* Delete Button (1 col) */}
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => removeProperty(prop.id)}
                      className="btn btn-ghost btn-xs text-error/70 hover:bg-error/15 p-0 w-6 h-6 rounded-circle"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {properties.length === 0 && (
                <div className="text-center py-12 text-xs text-base-content/40 italic">
                  정의된 속성이 없습니다. '속성 추가'를 눌러 스키마 빌드를 시작해 보세요.
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: JSON Schema Preview (4 cols) */}
          <div className="lg:col-span-4 p-6 bg-base-200/30 flex flex-col overflow-hidden">
            <label className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider mb-2 shrink-0">
              출력 결과 (JSON Schema)
            </label>
            <div className="flex-1 bg-neutral rounded-2xl p-4 overflow-auto border border-neutral-content/10">
              <pre className="text-[10px] font-mono text-neutral-content leading-relaxed whitespace-pre-wrap">
                {generatedSchemaText}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-base-200 bg-base-200/40 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="btn btn-sm btn-ghost hover:bg-base-300">
            취소
          </button>
          <button
            onClick={handleSave}
            className={`btn btn-sm btn-primary flex items-center gap-1 font-bold ${justSaved ? "btn-success text-white" : ""}`}
          >
            {justSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {justSaved ? "저장 완료" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
