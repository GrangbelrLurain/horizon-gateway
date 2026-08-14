export interface DomainFeatureState {
  monitorEnabled: boolean | undefined;
  proxyEnabled: boolean | undefined;
  proxyRouteId: number | undefined;
  apiLoggingEnabled: boolean | undefined;
  scriptInjectionEnabled?: boolean;
  httpsDecryptEnabled?: boolean;
}

export interface ProxyRouteModalT {
  proxyRouteModalTitle: string;
  proxyRouteModalDesc: (domain: string) => string;
  proxyRouteTargetHost: string;
  proxyRouteTargetPort: string;
  proxyRouteAdd: string;
  proxyRouteCancel: string;
  proxyRouteAdding: string;
}
