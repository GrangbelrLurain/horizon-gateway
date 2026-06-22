import { Link } from "@tanstack/react-router";
import { Camera, ExternalLink, Globe, Pencil, Trash2 } from "lucide-react";
import type { Domain } from "@/entities/domain";
import { Badge } from "@/shared/ui/badge/badge";
import { Button } from "@/shared/ui/button/Button";
import type { DomainFeatureState } from "./DomainFeatureBadges";
import { DomainFeatureBadges } from "./DomainFeatureBadges";

export interface DomainRowProps {
  domain: Domain;
  groupName: string;
  isUpdating: boolean;
  featureState: DomainFeatureState;
  proxyActive: boolean;
  featureT: {
    featureMonitor: string;
    featureProxy: string;
    featureApiLogging: string;
    featureOn: string;
    featureOff: string;
    featureTogglingOn: string;
    featureTogglingOff: string;
    featureProxyGlobalOff: string;
    featureProxyGlobalOffLink: string;
    proxyRouteModalTitle: string;
    proxyRouteModalDesc: (domain: string) => string;
    proxyRouteTargetHost: string;
    proxyRouteTargetPort: string;
    proxyRouteAdd: string;
    proxyRouteCancel: string;
    proxyRouteAdding: string;
  };
  onSelectGroup: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRefreshFeatures: () => void;
}

export function DomainRow({
  domain,
  groupName,
  isUpdating,
  featureState,
  proxyActive,
  featureT,
  onSelectGroup,
  onEdit,
  onDelete,
  onRefreshFeatures,
}: DomainRowProps) {
  return (
    <div className="group flex flex-col p-5 bg-base-100 border border-base-300 rounded-2xl hover:border-primary/40 hover:shadow-xl transition-all duration-300">
      {/* Top row: icon + URL + actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-base-200 flex items-center justify-center text-base-content/40 group-hover:bg-primary/10 group-hover:text-primary transition-all shrink-0 shadow-inner group-hover:scale-110">
            <Globe className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-base-content flex items-center gap-2 text-base tracking-tight">
              <span className="truncate max-w-[320px]">{domain.url}</span>
              <a
                href={domain.url}
                target="_blank"
                rel="noreferrer"
                className="text-base-content/30 hover:text-primary transition-colors shrink-0"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </h3>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              <p className="text-[9px] text-base-content/30 font-black uppercase tracking-widest">
                ID: {domain.id.toString().padStart(3, "0")}
              </p>
              <button
                type="button"
                onClick={onSelectGroup}
                disabled={isUpdating}
                className="focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 rounded-full active:scale-95 transition-transform"
              >
                <Badge
                  variant={{ color: "slate" }}
                  className="text-[9px] font-black py-0.5 px-2.5 cursor-pointer bg-base-200 text-base-content/40 hover:bg-primary/10 hover:text-primary transition-all border-none uppercase tracking-tighter"
                >
                  {groupName}
                </Badge>
              </button>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
          <Link
            to="/ux/live-capture"
            search={{ url: domain.url }}
            className="btn btn-secondary btn-sm btn-square rounded-xl w-9 h-9 bg-base-100 border-base-300"
            title="Open in Live Capture"
          >
            <Camera className="w-4 h-4 text-primary" />
          </Link>
          <Button
            variant="secondary"
            size="icon"
            title="Edit domain"
            onClick={onEdit}
            className="rounded-xl w-9 h-9 bg-base-100"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="danger" size="icon" onClick={onDelete} className="rounded-xl w-9 h-9">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Feature badges row */}
      <DomainFeatureBadges
        domainId={domain.id}
        domainUrl={domain.url}
        state={featureState}
        proxyActive={proxyActive}
        t={featureT}
        onRefresh={onRefreshFeatures}
      />
    </div>
  );
}
