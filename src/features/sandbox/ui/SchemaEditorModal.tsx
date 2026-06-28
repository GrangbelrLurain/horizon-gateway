import { useAtom, useAtomValue } from "jotai";
import { Check, CornerDownRight, Globe, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiClientLastResponseAtom, type SavedJsonSchema, savedJsonSchemasAtom } from "@/entities/sandbox";
import { commands, unwrap } from "@/shared/api";

interface SchemaProperty {
  id: string;
  name: string;
  type: "string" | "number" | "integer" | "boolean" | "object" | "array" | "ref";
  description: string;
  required: boolean;
  parentId?: string; // Links to parent property's ID for nesting
}

interface SchemaEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  schemaId?: string; // If provided, we edit this schema; if undefined, we create a new one
  onSave?: (savedSchemaId: string) => void;
}

export function SchemaEditorModal({ isOpen, onClose, schemaId, onSave }: SchemaEditorModalProps) {
  const [savedSchemas, setSavedSchemas] = useAtom(savedJsonSchemasAtom);
  const apiClientLastResponse = useAtomValue(apiClientLastResponseAtom);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [properties, setProperties] = useState<SchemaProperty[]>([]);
  const [justSaved, setJustSaved] = useState(false);

  // Import JSON Parser states
  const [isRawJsonInputOpen, setIsRawJsonInputOpen] = useState(false);
  const [rawJsonInput, setRawJsonInput] = useState("");

  // OpenAPI Import states
  const [domains, setDomains] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<number | "">("");
  const [openApiSpecJson, setOpenApiSpecJson] = useState<any>(null);
  const [availableOpenApiSchemas, setAvailableOpenApiSchemas] = useState<string[]>([]);
  const [selectedOpenApiSchema, setSelectedOpenApiSchema] = useState<string>("");
  const [openApiActiveTab, setOpenApiActiveTab] = useState<"project" | "paste">("project");
  const [rawOpenApiInput, setRawOpenApiInput] = useState<string>("");
  const [isOpenApiImportOpen, setIsOpenApiImportOpen] = useState(false);

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

  // Generate JSON Schema Draft-07 recursively
  const generatedSchemaText = useMemo(() => {
    const buildSchemaForNode = (props: SchemaProperty[], nodeId: string | undefined): any => {
      const children = props.filter((p) => p.parentId === nodeId);
      if (children.length === 0) {
        return null;
      }

      const propertiesObj: Record<string, any> = {};
      const requiredList: string[] = [];

      for (const child of children) {
        if (!child.name.trim()) {
          continue;
        }

        let childSchema: any = {};

        if (child.type === "ref") {
          childSchema = {
            $ref: child.description.trim() || "#",
          };
        } else {
          childSchema = {
            type: child.type,
            description: child.description.trim() || undefined,
          };

          if (child.type === "object") {
            const subProperties = buildSchemaForNode(props, child.id);
            if (subProperties) {
              childSchema = {
                ...childSchema,
                properties: subProperties.properties,
                required: subProperties.required,
              };
            } else {
              childSchema.properties = {};
            }
          } else if (child.type === "array") {
            const subProperties = buildSchemaForNode(props, child.id);
            const subChildren = props.filter((p) => p.parentId === child.id);

            if (subChildren.length === 1 && subChildren[0].type === "ref") {
              childSchema.items = {
                $ref: subChildren[0].description.trim() || "#",
              };
            } else if (subProperties && Object.keys(subProperties.properties || {}).length > 0) {
              childSchema.items = {
                type: "object",
                properties: subProperties.properties,
                required: subProperties.required,
              };
            } else {
              childSchema.items = { type: "string" };
            }
          }
        }

        propertiesObj[child.name.trim()] = childSchema;
        if (child.required) {
          requiredList.push(child.name.trim());
        }
      }

      const res: any = {
        type: "object",
        properties: propertiesObj,
      };

      if (requiredList.length > 0) {
        res.required = requiredList;
      }

      return res;
    };

    const rootSchema = buildSchemaForNode(properties, undefined);

    let definitionsObj: any;
    let defsObj: any;

    if (rootSchema?.properties) {
      if (rootSchema.properties.definitions) {
        definitionsObj = rootSchema.properties.definitions.properties;
        delete rootSchema.properties.definitions;
      }
      if (rootSchema.properties.$defs) {
        defsObj = rootSchema.properties.$defs.properties;
        delete rootSchema.properties.$defs;
      }
    }

    const schemaObj: Record<string, any> = {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      type: "object",
      properties: rootSchema?.properties || {},
    };

    if (definitionsObj) {
      schemaObj.definitions = definitionsObj;
    }
    if (defsObj) {
      schemaObj.$defs = defsObj;
    }

    if (rootSchema?.required && rootSchema.required.length > 0) {
      schemaObj.required = rootSchema.required;
    }

    return JSON.stringify(schemaObj, null, 2);
  }, [title, description, properties]);

  // Load project domains for OpenAPI import
  useEffect(() => {
    if (isOpenApiImportOpen && openApiActiveTab === "project") {
      (async () => {
        try {
          const [dRes, lRes] = await Promise.all([
            commands.getDomains().then(unwrap),
            commands.getDomainApiLoggingLinks().then(unwrap),
          ]);
          if (dRes.success) {
            setDomains(dRes.data ?? []);
          }
          if (lRes.success) {
            setLinks(lRes.data ?? []);
          }
        } catch (e) {
          console.error("Failed to load domains for OpenAPI import:", e);
        }
      })();
    }
  }, [isOpenApiImportOpen, openApiActiveTab]);

  // Filter domains that have schema links
  const schemaLinks = useMemo(() => links.filter((l) => l.schemaUrl), [links]);

  const domainMap = useMemo(() => {
    const m = new Map<number, any>();
    for (const d of domains) {
      m.set(d.id, d);
    }
    return m;
  }, [domains]);

  // Load schema when domain is selected
  useEffect(() => {
    if (!selectedDomainId) {
      setOpenApiSpecJson(null);
      setAvailableOpenApiSchemas([]);
      setSelectedOpenApiSchema("");
      return;
    }

    (async () => {
      try {
        const res = await commands.getApiSchemaContent({ domainId: Number(selectedDomainId) }).then(unwrap);
        if (res.success && res.data) {
          const spec = JSON.parse(res.data);
          setOpenApiSpecJson(spec);
          if (spec.components?.schemas) {
            const schemaNames = Object.keys(spec.components.schemas).sort();
            setAvailableOpenApiSchemas(schemaNames);
            if (schemaNames.length > 0) {
              setSelectedOpenApiSchema(schemaNames[0]);
            }
          } else {
            setAvailableOpenApiSchemas([]);
            setSelectedOpenApiSchema("");
            alert("선택한 OpenAPI 스펙에 components.schemas가 존재하지 않습니다.");
          }
        } else {
          alert("OpenAPI 스키마 콘텐츠를 가져오는데 실패했습니다.");
        }
      } catch (e) {
        alert(`OpenAPI 스펙 파싱 실패: ${e}`);
      }
    })();
  }, [selectedDomainId]);

  // Parse pasted OpenAPI input
  useEffect(() => {
    if (openApiActiveTab === "paste" && rawOpenApiInput.trim()) {
      try {
        const spec = JSON.parse(rawOpenApiInput);
        setOpenApiSpecJson(spec);
        if (spec.components?.schemas) {
          const schemaNames = Object.keys(spec.components.schemas).sort();
          setAvailableOpenApiSchemas(schemaNames);
          if (schemaNames.length > 0) {
            setSelectedOpenApiSchema(schemaNames[0]);
          }
        } else {
          setAvailableOpenApiSchemas([]);
          setSelectedOpenApiSchema("");
        }
      } catch (_e) {
        setOpenApiSpecJson(null);
        setAvailableOpenApiSchemas([]);
        setSelectedOpenApiSchema("");
      }
    }
  }, [rawOpenApiInput, openApiActiveTab]);

  // Recursive OpenAPI Schema to SchemaProperty list parser
  const importFromOpenApiSpec = (spec: any, selectedSchemaName: string) => {
    if (!spec || !spec.components || !spec.components.schemas) {
      alert("올바른 OpenAPI 스키마 구조가 아닙니다 (components.schemas가 없음).");
      return null;
    }

    const parsedProps: SchemaProperty[] = [];
    const processedDefs = new Set<string>();
    const defsToProcess: string[] = [];
    const genId = () => Math.random().toString(36).substring(2, 9);

    const rootSchema = spec.components.schemas[selectedSchemaName];
    if (!rootSchema) {
      alert(`선택한 스키마 ${selectedSchemaName}를 찾을 수 없습니다.`);
      return null;
    }

    const parseNode = (schema: any, name: string, parentId: string | undefined, isRequired: boolean) => {
      const propId = genId();

      if (schema?.$ref) {
        const refPath = schema.$ref;
        let targetRef = refPath;
        if (refPath.startsWith("#/components/schemas/")) {
          const modelName = refPath.replace("#/components/schemas/", "");
          targetRef = `#/definitions/${modelName}`;
          if (!processedDefs.has(modelName)) {
            defsToProcess.push(modelName);
          }
        }
        parsedProps.push({
          id: propId,
          name,
          type: "ref",
          description: targetRef,
          required: isRequired,
          parentId,
        });
        return;
      }

      const type = schema?.type || "string";
      const desc = schema?.description || "";

      parsedProps.push({
        id: propId,
        name,
        type: type === "integer" ? "integer" : (type as any),
        description: desc,
        required: isRequired,
        parentId,
      });

      if (type === "object" && schema.properties) {
        const requiredFields = schema.required || [];
        Object.entries(schema.properties).forEach(([childName, childSchema]) => {
          parseNode(childSchema, childName, propId, requiredFields.includes(childName));
        });
      } else if (type === "array" && schema.items) {
        parseNode(schema.items, "", propId, false);
      }
    };

    if (rootSchema.type === "object" && rootSchema.properties) {
      const requiredFields = rootSchema.required || [];
      Object.entries(rootSchema.properties).forEach(([name, schema]) => {
        parseNode(schema, name, undefined, requiredFields.includes(name));
      });
    } else {
      parseNode(rootSchema, selectedSchemaName, undefined, false);
    }

    let definitionsId: string | undefined;

    while (defsToProcess.length > 0) {
      const defName = defsToProcess.shift()!;
      if (processedDefs.has(defName)) {
        continue;
      }
      processedDefs.add(defName);

      const defSchema = spec.components.schemas[defName];
      if (!defSchema) {
        continue;
      }

      if (!definitionsId) {
        definitionsId = genId();
        parsedProps.push({
          id: definitionsId,
          name: "definitions",
          type: "object",
          description: "Schema definitions block",
          required: false,
          parentId: undefined,
        });
      }

      const modelNodeId = genId();
      parsedProps.push({
        id: modelNodeId,
        name: defName,
        type: "object",
        description: defSchema.description || `Definition for ${defName}`,
        required: false,
        parentId: definitionsId,
      });

      if (defSchema.properties) {
        const requiredFields = defSchema.required || [];
        Object.entries(defSchema.properties).forEach(([name, schema]) => {
          parseNode(schema, name, modelNodeId, requiredFields.includes(name));
        });
      }
    }

    return parsedProps;
  };

  const handleImportFromOpenApi = () => {
    if (!openApiSpecJson || !selectedOpenApiSchema) {
      alert("가져올 OpenAPI 스펙 또는 스키마가 로드되지 않았습니다.");
      return;
    }

    const imported = importFromOpenApiSpec(openApiSpecJson, selectedOpenApiSchema);
    if (imported) {
      setProperties(imported);
      setIsOpenApiImportOpen(false);
      setRawOpenApiInput("");
      setSelectedDomainId("");
      setOpenApiSpecJson(null);
      setAvailableOpenApiSchemas([]);
      setSelectedOpenApiSchema("");
    }
  };

  // JSON property recursive extractor helper
  const importFromJson = (json: any, parentId?: string) => {
    if (!json || typeof json !== "object") {
      alert("추출할 수 있는 올바른 JSON 객체가 아닙니다.");
      return;
    }

    const parsedProps: SchemaProperty[] = [];

    const parseJsonToSchemaProperties = (jsonVal: any, currentParentId: string | undefined) => {
      if (!jsonVal || typeof jsonVal !== "object") {
        return;
      }

      let targetObj = jsonVal;

      if (Array.isArray(jsonVal)) {
        if (jsonVal.length > 0 && typeof jsonVal[0] === "object") {
          targetObj = jsonVal[0];
        } else {
          return;
        }
      }

      Object.entries(targetObj).forEach(([key, val]) => {
        const propId = Math.random().toString(36).substring(2, 9);
        let type: SchemaProperty["type"] = "string";

        if (typeof val === "number") {
          type = Number.isInteger(val) ? "integer" : "number";
        } else if (typeof val === "boolean") {
          type = "boolean";
        } else if (Array.isArray(val)) {
          type = "array";
        } else if (val === null) {
          type = "string";
        } else if (typeof val === "object") {
          type = "object";
        }

        parsedProps.push({
          id: propId,
          name: key,
          type,
          description: `Imported field: ${key}`,
          required: false,
          parentId: currentParentId,
        });

        // Recursively extract child properties
        if (type === "object") {
          parseJsonToSchemaProperties(val, propId);
        } else if (type === "array" && Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
          parseJsonToSchemaProperties(val[0], propId);
        }
      });
    };

    parseJsonToSchemaProperties(json, parentId);

    if (parentId) {
      // Append mode: filter out duplicate sibling names under the parent
      const siblingNames = properties.filter((p) => p.parentId === parentId).map((p) => p.name);
      const uniqueNewProps = parsedProps.filter((np) => !siblingNames.includes(np.name));

      setProperties([...properties, ...uniqueNewProps]);
    } else {
      // Overwrite mode
      setProperties(parsedProps);
    }
  };

  // Order properties in tree hierarchy
  const orderedProperties = useMemo(() => {
    const orderTree = (props: SchemaProperty[], parentId: string | undefined): SchemaProperty[] => {
      const children = props.filter((p) => p.parentId === parentId);
      const result: SchemaProperty[] = [];
      for (const child of children) {
        result.push(child);
        const descendants = orderTree(props, child.id);
        result.push(...descendants);
      }
      return result;
    };
    return orderTree(properties, undefined);
  }, [properties]);

  // Compute indentation depth
  const getPropertyDepth = (prop: SchemaProperty): number => {
    let depth = 0;
    let current = prop;
    while (current.parentId) {
      const parent = properties.find((p) => p.id === current.parentId);
      if (!parent) {
        break;
      }
      depth += 1;
      current = parent;
    }
    return depth;
  };

  // Add a new property row at root
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

  // Add a nested sub-property row
  const addSubProperty = (parentId: string) => {
    const newProp: SchemaProperty = {
      id: Math.random().toString(36).substring(2, 9),
      name: "",
      type: "string",
      description: "",
      required: false,
      parentId,
    };
    setProperties([...properties, newProp]);
  };

  // Delete row recursively (deletes child nodes under it)
  const removeProperty = (id: string) => {
    const getDescendantIds = (parentId: string): string[] => {
      const children = properties.filter((p) => p.parentId === parentId);
      const ids = children.map((c) => c.id);
      for (const child of children) {
        ids.push(...getDescendantIds(child.id));
      }
      return ids;
    };

    const idsToRemove = [id, ...getDescendantIds(id)];
    setProperties(properties.filter((p) => !idsToRemove.includes(p.id)));
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

            {/* Import tools section */}
            <div className="bg-base-200/50 p-3 rounded-2xl border border-base-300 flex flex-col gap-2 shrink-0">
              <span className="text-[9px] font-bold text-base-content/65 uppercase tracking-wider">
                외부 데이터에서 가져오기 (Import schema)
              </span>
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  className="btn btn-xs btn-outline flex items-center gap-1 font-semibold hover:bg-base-200"
                  disabled={!apiClientLastResponse}
                  onClick={() => apiClientLastResponse && importFromJson(apiClientLastResponse)}
                  title={
                    apiClientLastResponse
                      ? "최근 API 클라이언트 응답 값에서 속성 자동 파싱"
                      : "최근 응답 값이 존재하지 않습니다."
                  }
                >
                  🌐 최근 API 응답에서 추출
                </button>

                <button
                  type="button"
                  className="btn btn-xs btn-outline flex items-center gap-1 font-semibold hover:bg-base-200"
                  onClick={() => {
                    setIsRawJsonInputOpen(!isRawJsonInputOpen);
                    setIsOpenApiImportOpen(false);
                  }}
                >
                  📋 JSON 직접 붙여넣기
                </button>

                <button
                  type="button"
                  className="btn btn-xs btn-outline flex items-center gap-1 font-semibold hover:bg-base-200"
                  onClick={() => {
                    setIsOpenApiImportOpen(!isOpenApiImportOpen);
                    setIsRawJsonInputOpen(false);
                  }}
                >
                  📁 OpenAPI에서 가져오기
                </button>
              </div>

              {isOpenApiImportOpen && (
                <div className="flex flex-col gap-2 mt-2 border-t border-base-300/60 pt-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-base-content/50 uppercase">OpenAPI 스키마 가져오기</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${
                          openApiActiveTab === "project"
                            ? "bg-primary text-white"
                            : "bg-base-200 hover:bg-base-300 text-base-content/70"
                        }`}
                        onClick={() => {
                          setOpenApiActiveTab("project");
                          setOpenApiSpecJson(null);
                          setAvailableOpenApiSchemas([]);
                          setSelectedOpenApiSchema("");
                        }}
                      >
                        프로젝트 OpenAPI
                      </button>
                      <button
                        type="button"
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${
                          openApiActiveTab === "paste"
                            ? "bg-primary text-white"
                            : "bg-base-200 hover:bg-base-300 text-base-content/70"
                        }`}
                        onClick={() => {
                          setOpenApiActiveTab("paste");
                          setOpenApiSpecJson(null);
                          setAvailableOpenApiSchemas([]);
                          setSelectedOpenApiSchema("");
                        }}
                      >
                        직접 붙여넣기
                      </button>
                    </div>
                  </div>

                  {openApiActiveTab === "project" ? (
                    <div className="flex flex-col gap-1.5">
                      <select
                        className="select select-bordered select-xs w-full text-xs"
                        value={selectedDomainId}
                        onChange={(e) => setSelectedDomainId(e.target.value ? Number(e.target.value) : "")}
                      >
                        <option value="">도메인 선택...</option>
                        {schemaLinks.map((link) => {
                          const d = domainMap.get(link.domainId);
                          return (
                            <option key={link.domainId} value={link.domainId}>
                              {d?.url ?? `Domain #${link.domainId}`}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ) : (
                    <textarea
                      rows={4}
                      className="textarea textarea-bordered textarea-xs font-mono w-full focus:outline-none leading-relaxed"
                      placeholder="OpenAPI JSON 스펙을 여기에 붙여넣으세요..."
                      value={rawOpenApiInput}
                      onChange={(e) => setRawOpenApiInput(e.target.value)}
                    />
                  )}

                  {availableOpenApiSchemas.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-bold text-base-content/40 uppercase">대상 스키마 선택</label>
                      <select
                        className="select select-bordered select-xs w-full text-xs font-mono font-semibold"
                        value={selectedOpenApiSchema}
                        onChange={(e) => setSelectedOpenApiSchema(e.target.value)}
                      >
                        {availableOpenApiSchemas.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex justify-end gap-1.5 mt-1">
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost hover:bg-base-300"
                      onClick={() => {
                        setIsOpenApiImportOpen(false);
                        setRawOpenApiInput("");
                        setSelectedDomainId("");
                        setOpenApiSpecJson(null);
                        setAvailableOpenApiSchemas([]);
                        setSelectedOpenApiSchema("");
                      }}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-primary font-bold"
                      disabled={!selectedOpenApiSchema}
                      onClick={handleImportFromOpenApi}
                    >
                      스키마 가져오기
                    </button>
                  </div>
                </div>
              )}

              {isRawJsonInputOpen && (
                <div className="flex flex-col gap-1.5 mt-2 border-t border-base-300/60 pt-2.5 animate-fadeIn">
                  <span className="text-[9px] font-bold text-base-content/50 uppercase">JSON 문자열 입력</span>
                  <textarea
                    rows={4}
                    className="textarea textarea-bordered textarea-xs font-mono w-full focus:outline-none leading-relaxed"
                    placeholder='{ "id": 1, "name": "Alice", "meta": { "active": true } }'
                    value={rawJsonInput}
                    onChange={(e) => setRawJsonInput(e.target.value)}
                  />
                  <div className="flex justify-end gap-1.5 mt-1">
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost hover:bg-base-300"
                      onClick={() => {
                        setIsRawJsonInputOpen(false);
                        setRawJsonInput("");
                      }}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-primary font-bold"
                      onClick={() => {
                        try {
                          const parsed = JSON.parse(rawJsonInput || "{}");
                          importFromJson(parsed);
                          setIsRawJsonInputOpen(false);
                          setRawJsonInput("");
                        } catch (err: any) {
                          alert(`JSON 문법 에러: ${err.message}`);
                        }
                      }}
                    >
                      추출 완료
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Properties Builder Title */}
            <div className="flex items-center justify-between border-b border-base-200 pb-2 shrink-0">
              <span className="font-semibold text-xs text-base-content/70">속성 정의 (Properties Tree)</span>
              <button onClick={addProperty} className="btn btn-xs btn-outline btn-primary flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> 최상위 속성 추가
              </button>
            </div>

            {/* Properties Rows */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
              {orderedProperties.map((prop) => {
                const depth = getPropertyDepth(prop);
                const isObjectOrArray = prop.type === "object" || prop.type === "array";

                return (
                  <div
                    key={prop.id}
                    className="grid grid-cols-12 gap-2 p-3 bg-base-200/40 rounded-2xl border border-base-300 items-center relative animate-fadeIn"
                    style={{ marginLeft: `${depth * 1.5}rem` }}
                  >
                    {/* Visual Connection Guide for Nested Children */}
                    {depth > 0 && (
                      <div className="absolute left-0 top-0 bottom-0 flex items-center justify-center -ml-5 text-base-content/30 select-none pointer-events-none">
                        <CornerDownRight className="w-3.5 h-3.5" />
                      </div>
                    )}

                    {/* Name (4.5 cols) */}
                    <div className="col-span-4.5 flex items-center gap-1">
                      <input
                        type="text"
                        className="input input-bordered input-xs w-full text-xs focus:outline-none font-mono font-semibold"
                        placeholder="속성명 (e.g. user)"
                        value={prop.name}
                        onChange={(e) => updateProperty(prop.id, "name", e.target.value)}
                      />
                    </div>

                    {/* Type & Sub-adder (3 cols) */}
                    <div className="col-span-3 flex items-center gap-1">
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
                        <option value="ref">ref (참조)</option>
                      </select>

                      {isObjectOrArray && (
                        <div className="flex gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => addSubProperty(prop.id)}
                            className="btn btn-primary btn-xs btn-square text-white"
                            title="하위 속성 추가"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs btn-square hover:bg-base-200"
                            disabled={!apiClientLastResponse}
                            onClick={() => apiClientLastResponse && importFromJson(apiClientLastResponse, prop.id)}
                            title="API 응답에서 하위 속성 추출하여 추가"
                          >
                            <Globe className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
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

                    {/* Description (2 cols) */}
                    <div className="col-span-2">
                      <input
                        type="text"
                        className="input input-bordered input-xs w-full text-xs focus:outline-none"
                        placeholder={prop.type === "ref" ? "#/definitions/Category" : "설명"}
                        value={prop.description}
                        onChange={(e) => updateProperty(prop.id, "description", e.target.value)}
                      />
                    </div>

                    {/* Delete Button (1 col) */}
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => removeProperty(prop.id)}
                        className="btn btn-ghost btn-xs text-error/70 hover:bg-error/15 p-0 w-6 h-6 rounded-circle"
                        title="속성 삭제 (하위 속성도 포함하여 함께 삭제됩니다)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
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
            className={`btn btn-sm btn-primary flex items-center gap-1 font-bold ${
              justSaved ? "btn-success text-white" : ""
            }`}
          >
            {justSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {justSaved ? "저장 완료" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
