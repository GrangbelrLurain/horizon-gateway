import { createFileRoute } from "@tanstack/react-router";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  Check,
  Copy,
  CornerDownRight,
  Download,
  FileCode,
  Globe,
  Layers,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { languageAtom } from "@/entities/app";
import {
  apiClientLastResponseAtom,
  type SavedJsonSchema,
  savedJsonSchemasAtom,
  schemaBuilderCurrentSchemaAtom,
} from "@/entities/sandbox";
import { commands, unwrap } from "@/shared/api";

export const Route = createFileRoute("/apis/json-schema/")({
  component: JsonSchemaPage,
});

interface SchemaProperty {
  id: string;
  name: string;
  type: "string" | "number" | "integer" | "boolean" | "object" | "array" | "ref";
  description: string;
  required: boolean;
  parentId?: string;
}

const en = {
  title: "JSON Schema Registry",
  subtitle:
    "Define, build, and save JSON Schemas (Draft-07) to validate API payloads and use in visual pipeline nodes.",
  addSchema: "Add New Schema",
  schemaList: "Saved Schemas",
  searchSchemas: "Search schemas...",
  noSchemas: "No saved schemas found. Click Add New Schema to start.",
  schemaTitle: "Schema Title",
  schemaDesc: "Schema Description",
  properties: "Properties",
  addProperty: "Add Property",
  importApiResponse: "Import from API Response",
  propertyName: "Property Name",
  type: "Type",
  required: "Required",
  description: "Description",
  save: "Save Schema",
  saved: "Saved!",
  copy: "Copy Schema",
  copied: "Copied!",
  download: "Download JSON",
  deleteConfirm: "Are you sure you want to delete this schema?",
  validationResult: "Output Result (JSON Schema)",
  emptyProps: "No properties defined. Click Add Property to start building your schema.",
};

const ko = {
  title: "JSON 스키마 저장소",
  subtitle:
    "JSON 스키마(Draft-07)를 작성, 저장하고 API 검증 및 데이터 파이프라인 노드 등 여러 기능에서 불러와 사용합니다.",
  addSchema: "새 스키마 추가",
  schemaList: "저장된 스키마",
  searchSchemas: "스키마 검색...",
  noSchemas: "저장된 스키마가 없습니다. 새 스키마 추가를 클릭하세요.",
  schemaTitle: "스키마 제목",
  schemaDesc: "스키마 설명",
  properties: "속성 정의 (Properties)",
  addProperty: "속성 추가",
  importApiResponse: "API 응답에서 가져오기",
  propertyName: "속성명",
  type: "타입",
  required: "필수",
  description: "설명",
  save: "스키마 저장",
  saved: "저장됨",
  copy: "스키마 복사",
  copied: "복사됨",
  download: "다운로드",
  deleteConfirm: "이 스키마를 삭제하시겠습니까?",
  validationResult: "출력 결과 (JSON Schema)",
  emptyProps: "정의된 속성이 없습니다. 속성 추가 버튼을 눌러 스키마를 구성하세요.",
};

function JsonSchemaPage() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;

  const [savedSchemas, setSavedSchemas] = useAtom(savedJsonSchemasAtom);
  const apiClientLastResponse = useAtomValue(apiClientLastResponseAtom);
  const setSharedSchema = useSetAtom(schemaBuilderCurrentSchemaAtom);

  const [selectedId, setSelectedId] = useState<string>(() => {
    return savedSchemas.length > 0 ? savedSchemas[0].id : "";
  });

  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [properties, setProperties] = useState<SchemaProperty[]>([]);
  const [copied, setCopied] = useState(false);
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

  // Load selected schema
  useEffect(() => {
    const found = savedSchemas.find((s) => s.id === selectedId);
    if (found) {
      setTitle(found.name);
      setDescription(found.description);
      setProperties(found.properties as SchemaProperty[]);
    } else if (savedSchemas.length > 0) {
      setSelectedId(savedSchemas[0].id);
    } else {
      setTitle("");
      setDescription("");
      setProperties([]);
    }
  }, [selectedId, savedSchemas]);

  // Search filter
  const filteredSchemas = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) {
      return savedSchemas;
    }
    return savedSchemas.filter(
      (s) => s.name.toLowerCase().includes(query) || s.description.toLowerCase().includes(query),
    );
  }, [savedSchemas, search]);

  // Generate Draft-07 Schema recursively
  const generatedSchema = useMemo(() => {
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

  // Sync to shared schema for pipeline nodes
  useEffect(() => {
    setSharedSchema(generatedSchema);
  }, [generatedSchema, setSharedSchema]);

  // Has unsaved changes check
  const hasUnsavedChanges = useMemo(() => {
    const found = savedSchemas.find((s) => s.id === selectedId);
    if (!found) {
      return false;
    }

    return (
      found.name !== title ||
      found.description !== description ||
      JSON.stringify(found.properties) !== JSON.stringify(properties)
    );
  }, [selectedId, savedSchemas, title, description, properties]);

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

  // Visual Properties operations
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

  // Delete row recursively
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

  // Import JSON Parser
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

  // CRUD Operations
  const handleAddSchema = () => {
    const newId = Math.random().toString(36).substring(2, 9);
    const newSchema: SavedJsonSchema = {
      id: newId,
      name: "NewSchema",
      description: "A newly created JSON Schema",
      properties: [{ id: "1", name: "id", type: "integer", description: "The identifier", required: true }],
      schemaText: `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "NewSchema",
  "description": "A newly created JSON Schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "integer",
      "description": "The identifier"
    }
  },
  "required": [
    "id"
  ]
}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSavedSchemas([...savedSchemas, newSchema]);
    setSelectedId(newId);
  };

  const handleSave = () => {
    const updated = savedSchemas.map((s) => {
      if (s.id === selectedId) {
        return {
          ...s,
          name: title,
          description,
          properties,
          schemaText: generatedSchema,
          updatedAt: Date.now(),
        };
      }
      return s;
    });
    setSavedSchemas(updated);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleDeleteSchema = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t.deleteConfirm)) {
      const remaining = savedSchemas.filter((s) => s.id !== id);
      setSavedSchemas(remaining);
      if (selectedId === id) {
        if (remaining.length > 0) {
          setSelectedId(remaining[0].id);
        } else {
          setSelectedId("");
        }
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedSchema], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase() || "schema"}.schema.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col space-y-6 w-full h-[calc(100vh-10rem)]">
      {/* Title Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileCode className="text-primary w-6 h-6" /> {t.title}
          </h1>
          <p className="text-sm text-base-content/70 mt-1">{t.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-stretch flex-1 min-h-0 overflow-hidden">
        {/* Left Column: Schema List */}
        <div className="xl:col-span-1 card bg-base-100 border border-base-300 p-4 shadow-sm flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between border-b border-base-200 pb-3 mb-3 shrink-0">
            <span className="font-semibold flex items-center gap-1.5 text-base-content/85">
              <Layers className="w-4 h-4 text-primary" /> {t.schemaList} ({savedSchemas.length})
            </span>
            <button onClick={handleAddSchema} className="btn btn-xs btn-primary flex items-center gap-1">
              <Plus className="w-3 h-3" /> {t.addSchema}
            </button>
          </div>

          <div className="relative group/sch shrink-0 mb-3">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
            <input
              type="text"
              className="input input-bordered input-xs pl-8 w-full text-xs font-semibold focus:outline-none"
              placeholder={t.searchSchemas}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredSchemas.length === 0 ? (
              <div className="text-center py-10 text-xs text-base-content/40 italic">{t.noSchemas}</div>
            ) : (
              filteredSchemas.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`p-3 border rounded-xl cursor-pointer transition-all duration-200 flex items-center justify-between group ${
                    selectedId === s.id
                      ? "bg-primary/10 border-primary/45 shadow-sm"
                      : "border-base-200 hover:border-primary/40 hover:bg-base-200/50"
                  }`}
                >
                  <div className="flex flex-col space-y-1 min-w-0 pr-2">
                    <span className="font-bold text-xs truncate text-base-content/85">{s.name}</span>
                    <span className="text-[10px] text-base-content/50 truncate">
                      {s.description || "No description"}
                    </span>
                  </div>
                  <button
                    className="btn btn-xs btn-ghost text-error opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDeleteSchema(s.id, e)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Main Visual Editor */}
        <div className="xl:col-span-3 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch h-full overflow-hidden">
          {selectedId ? (
            <>
              {/* Visual Grid Form */}
              <div className="lg:col-span-7 card bg-base-100 border border-base-300 p-5 shadow-sm flex flex-col h-full overflow-hidden">
                {/* Save Status & Action Header */}
                <div className="flex justify-between items-center pb-3 border-b border-base-200 mb-4 shrink-0">
                  <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
                    ⚙️ {title || "Schema Details"}
                  </h3>
                  <div className="flex items-center gap-3">
                    {hasUnsavedChanges && (
                      <span className="badge badge-warning badge-xs font-bold text-[10px] py-1.5 px-2">변경됨</span>
                    )}
                    <button
                      onClick={handleSave}
                      className={`btn btn-xs ${justSaved ? "btn-success" : "btn-primary"} flex items-center gap-1 font-bold`}
                    >
                      <Save className="w-3.5 h-3.5" /> {justSaved ? t.saved : t.save}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-5 pr-1 no-scrollbar">
                  {/* Schema Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="label-text text-xs font-semibold text-base-content/70">{t.schemaTitle}</label>
                      <input
                        type="text"
                        className="input input-bordered input-sm font-semibold focus:outline-none"
                        placeholder="Schema Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="label-text text-xs font-semibold text-base-content/70">{t.schemaDesc}</label>
                      <input
                        type="text"
                        className="input input-bordered input-sm focus:outline-none"
                        placeholder="Schema Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Properties Headers */}
                  <div className="border-b border-base-200 pb-2 flex items-center justify-between">
                    <span className="font-bold text-xs text-base-content/65 uppercase">{t.properties}</span>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-xs btn-outline flex items-center gap-1 hover:bg-base-200"
                        onClick={() => {
                          setIsOpenApiImportOpen(!isOpenApiImportOpen);
                          setIsRawJsonInputOpen(false);
                        }}
                      >
                        📁 {lang === "ko" ? "OpenAPI 가져오기" : "Import OpenAPI"}
                      </button>
                      <button
                        className="btn btn-xs btn-outline flex items-center gap-1 hover:bg-base-200"
                        onClick={() => {
                          setIsRawJsonInputOpen(!isRawJsonInputOpen);
                          setIsOpenApiImportOpen(false);
                        }}
                      >
                        📋 {lang === "ko" ? "JSON 붙여넣기" : "Paste JSON"}
                      </button>
                      <button
                        className="btn btn-xs btn-outline btn-primary flex items-center gap-1"
                        onClick={() => importFromJson(apiClientLastResponse)}
                        disabled={!apiClientLastResponse}
                      >
                        📥 {t.importApiResponse}
                      </button>
                      <button className="btn btn-xs btn-primary flex items-center gap-1" onClick={addProperty}>
                        <Plus className="w-3.5 h-3.5" /> {t.addProperty}
                      </button>
                    </div>
                  </div>

                  {/* Collapsible Panels */}
                  {isOpenApiImportOpen && (
                    <div className="flex flex-col gap-2 border border-base-300 bg-base-200/20 rounded-xl p-3.5 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-base-content/50 uppercase">
                          OpenAPI 스키마 가져오기
                        </span>
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
                          onChange={(e) => setOpenApiSpecJson(e.target.value)}
                        />
                      )}

                      {availableOpenApiSchemas.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-bold text-base-content/40 uppercase">
                            대상 스키마 선택
                          </label>
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
                    <div className="flex flex-col gap-2 border border-base-300 bg-base-200/20 rounded-xl p-3.5 animate-fadeIn">
                      <span className="text-[10px] font-bold text-base-content/50 uppercase">JSON 직접 붙여넣기</span>
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

                  {/* Properties Grid Rows */}
                  <div className="space-y-4">
                    {orderedProperties.length === 0 ? (
                      <div className="text-center py-10 text-xs text-base-content/40 italic">{t.emptyProps}</div>
                    ) : (
                      orderedProperties.map((prop) => {
                        const depth = getPropertyDepth(prop);
                        const isObjectOrArray = prop.type === "object" || prop.type === "array";

                        return (
                          <div
                            key={prop.id}
                            className="p-3 border border-base-200 rounded-xl hover:border-primary/30 bg-base-200/20 transition-all duration-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-center relative group animate-fadeIn"
                            style={{ marginLeft: `${depth * 1.5}rem` }}
                          >
                            {/* Visual Connection Guide for Nested Children */}
                            {depth > 0 && (
                              <div className="absolute left-0 top-0 bottom-0 flex items-center justify-center -ml-5 text-base-content/30 select-none pointer-events-none">
                                <CornerDownRight className="w-3.5 h-3.5" />
                              </div>
                            )}

                            {/* Name */}
                            <div className="md:col-span-4 flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-base-content/50 uppercase">
                                {t.propertyName}
                              </label>
                              <input
                                type="text"
                                className="input input-bordered input-xs font-mono text-xs w-full focus:outline-none"
                                placeholder="propertyName"
                                value={prop.name}
                                onChange={(e) => updateProperty(prop.id, "name", e.target.value)}
                              />
                            </div>

                            {/* Type */}
                            <div className="md:col-span-3 flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-base-content/50 uppercase">{t.type}</label>
                              <div className="flex items-center gap-1.5 w-full">
                                <select
                                  className="select select-bordered select-xs w-full text-xs"
                                  value={prop.type}
                                  onChange={(e) => updateProperty(prop.id, "type", e.target.value)}
                                >
                                  <option value="string">string</option>
                                  <option value="number">number</option>
                                  <option value="integer">integer</option>
                                  <option value="boolean">boolean</option>
                                  <option value="object">object (JSON)</option>
                                  <option value="array">array (배열)</option>
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
                                      onClick={() =>
                                        apiClientLastResponse && importFromJson(apiClientLastResponse, prop.id)
                                      }
                                      title="API 응답에서 하위 속성 추출하여 추가"
                                    >
                                      <Globe className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Required */}
                            <div className="md:col-span-1.5 flex flex-col gap-1 items-center justify-center pt-2 md:pt-0">
                              <label className="text-[10px] font-bold text-base-content/50 uppercase mb-1">
                                {t.required}
                              </label>
                              <input
                                type="checkbox"
                                className="checkbox checkbox-primary checkbox-xs"
                                checked={prop.required}
                                onChange={(e) => updateProperty(prop.id, "required", e.target.checked)}
                              />
                            </div>

                            {/* Description */}
                            <div className="md:col-span-3.5 flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-base-content/50 uppercase">
                                {t.description}
                              </label>
                              <div className="flex gap-2 items-center">
                                <input
                                  type="text"
                                  className="input input-bordered input-xs flex-1 text-xs focus:outline-none"
                                  placeholder={prop.type === "ref" ? "#/definitions/Category" : "..."}
                                  value={prop.description}
                                  onChange={(e) => updateProperty(prop.id, "description", e.target.value)}
                                />
                                <button
                                  onClick={() => removeProperty(prop.id)}
                                  className="btn btn-ghost btn-xs text-error/70 hover:bg-error/15 p-0 w-6 h-6 rounded-circle shrink-0"
                                  title="속성 삭제 (하위 속성도 포함하여 함께 삭제됩니다)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* JSON Spec View */}
              <div className="lg:col-span-5 card bg-base-100 border border-base-300 p-5 shadow-sm flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between border-b border-base-200 pb-3 mb-4 shrink-0">
                  <span className="font-semibold text-sm text-base-content/85">{t.validationResult}</span>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-xs btn-outline btn-ghost flex items-center gap-1"
                      onClick={handleDownload}
                    >
                      <Download className="w-3 h-3" /> {t.download}
                    </button>
                    <button
                      className={`btn btn-xs ${copied ? "btn-success" : "btn-outline btn-ghost"} flex items-center gap-1`}
                      onClick={handleCopy}
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? t.copied : t.copy}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto bg-base-200 border border-base-300 rounded-lg p-4 font-mono text-[11px] leading-relaxed no-scrollbar flex flex-col min-h-0">
                  <textarea
                    className="flex-1 w-full bg-transparent resize-none border-none outline-none focus:outline-none focus:ring-0 text-success p-0 font-mono text-[11px] leading-relaxed"
                    value={generatedSchema}
                    readOnly
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="col-span-12 flex items-center justify-center bg-base-100 border border-base-300 rounded-xl p-12 text-sm text-base-content/40 italic">
              {t.noSchemas}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
