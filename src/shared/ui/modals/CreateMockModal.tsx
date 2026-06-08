import { useAtom } from "jotai";
import { Check, Database, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Scenario } from "@/entities/scenario/types/mocking";
import { commands, unwrap } from "@/shared/api";
import { createMockModalAtom } from "@/shared/store/modals";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { Input } from "@/shared/ui/input/Input";

export function CreateMockModal() {
  const [modalState, setModalState] = useAtom(createMockModalAtom);
  const { isOpen, logData, onSuccess } = modalState;

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [targetScenarioId, setTargetScenarioId] = useState<string | null>(null);
  const [newScenarioName, setNewScenarioName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      commands
        .getScenarios()
        .then(unwrap)
        .then((res) => {
          if (res.success && res.data && Array.isArray(res.data)) {
            setScenarios(res.data);
          }
        });
    }
  }, [isOpen]);

  if (!isOpen || !logData) {
    return null;
  }

  const handleClose = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
    setNewScenarioName("");
    setTargetScenarioId(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    let scenarioId = targetScenarioId;

    try {
      // 1. Create Scenario if new name provided
      if (!scenarioId && newScenarioName.trim()) {
        const res = unwrap(
          await commands.createScenario({
            name: newScenarioName,
            description: "Auto-created from Watchtower Workspace",
          }),
        );
        if (res.success && res.data) {
          scenarioId = res.data.id;
        } else {
          alert(`시나리오 생성 실패: ${res.message || "알 수 없는 오류"}`);
          setIsSaving(false);
          return;
        }
      }

      if (!scenarioId) {
        alert("시나리오를 선택하거나 새 이름을 입력하세요.");
        setIsSaving(false);
        return;
      }

      // 2. Create Mock Rule from Log
      const res = unwrap(
        await commands.createMockRuleFromLog({
          logId: logData.id,
          scenarioId: scenarioId,
          name: `${logData.method} ${logData.path}`,
          logDate: logData.timestamp.slice(0, 10),
        }),
      );

      if (res.success) {
        alert("성공적으로 스냅샷이 저장되었습니다.");
        handleClose();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        alert(`스냅샷 저장 실패: ${res.message || "알 수 없는 오류"}`);
      }
    } catch (err) {
      alert(`저장 중 에러 발생: ${err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-10 animate-in fade-in zoom-in-95 duration-200"
      onClick={handleClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        <Card className="bg-base-100 p-6 shadow-2xl flex flex-col gap-6">
          <div className="flex justify-between items-center border-b border-base-200 pb-4">
            <h3 className="text-xl font-bold flex items-center gap-2 text-primary">
              <Database className="w-5 h-5" /> 시나리오 선택
            </h3>
            <button type="button" onClick={handleClose}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase text-base-content/40 tracking-widest px-1">
                기존 시나리오
              </label>
              <select
                className="select select-bordered w-full rounded-2xl bg-base-200/50"
                value={targetScenarioId || ""}
                onChange={(e) => setTargetScenarioId(e.target.value || null)}
              >
                <option value="">새 시나리오 만들기...</option>
                {scenarios.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>

            {!targetScenarioId && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-base-content/40 tracking-widest px-1">
                  새 시나리오 명칭
                </label>
                <Input
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  placeholder="예: 로그인 실패 케이스"
                />
              </div>
            )}
          </div>

          <Button
            variant="primary"
            className="w-full h-12 gap-2 text-lg font-black"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Check className="w-5 h-5" /> {isSaving ? "저장 중..." : "스냅샷 저장"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
