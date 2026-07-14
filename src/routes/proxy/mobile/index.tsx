import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import {
  AlertCircle,
  CheckCircle2,
  Loader2Icon,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Usb,
  Wifi,
  WifiOff,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { languageAtom, proxyRunningAtom } from "@/entities/app";
import { ProxyServerWarning } from "@/entities/proxy";
import type { AdbStatus, ProxyStatusPayload } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { useEmbedMode } from "@/shared/lib/tauri/useEmbedMode";
import { Badge } from "@/shared/ui/badge/badge";
import { Card } from "@/shared/ui/card/card";
import { StatusToggle } from "@/shared/ui/status-toggle/StatusToggle";
import { H1, H2, P } from "@/shared/ui/typography/typography";

export const Route = createFileRoute("/proxy/mobile/")({
  component: ProxyMobileRoutePage,
});

function ProxyMobileRoutePage() {
  const embedMode = useEmbedMode();
  return <MobileConnectionContent embedded={embedMode !== "standalone"} />;
}

export function MobileConnectionContent({ embedded = false }: { embedded?: boolean }) {
  const lang = useAtomValue(languageAtom);
  const isProxyRunning = useAtomValue(proxyRunningAtom);

  const [activeTab, setActiveTab] = useState<"wireless" | "usb">("wireless");

  const [proxyStatus, setProxyStatus] = useState<ProxyStatusPayload>({
    running: false,
    port: 0,
    reverse_http_port: null,
    reverse_https_port: null,
    local_routing_enabled: true,
  });

  // Wireless connection states
  const [tailscaleIp, setTailscaleIp] = useState<string | null>(null);
  const [ipLoading, setIpLoading] = useState(true);
  const [tunnelActive, setTunnelActive] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [tunnelError, setTunnelError] = useState<string | null>(null);

  // USB connection states
  const [adbStatus, setAdbStatus] = useState<AdbStatus | null>(null);
  const [adbLoading, setAdbLoading] = useState(true);
  const [usbTunnelActive, setUsbTunnelActive] = useState(false);
  const [usbTunnelLoading, setUsbTunnelLoading] = useState(false);
  const [usbError, setUsbError] = useState<string | null>(null);

  const proxyPortRef = useRef(proxyStatus.port);
  useEffect(() => {
    proxyPortRef.current = proxyStatus.port;
  }, [proxyStatus.port]);

  const fetchProxyStatus = useCallback(async () => {
    try {
      const res = await commands.getProxyStatus().then(unwrap);
      if (res.success && res.data) {
        setProxyStatus(res.data);
      }
    } catch (e) {
      console.error("fetchProxyStatus error:", e);
    }
  }, []);

  const fetchTailscaleIp = useCallback(async () => {
    setIpLoading(true);
    try {
      const res = await commands.getTailscaleIp().then(unwrap);
      if (res.success && res.data) {
        setTailscaleIp(res.data);
      } else {
        setTailscaleIp(null);
      }
    } catch (e) {
      console.error("fetchTailscaleIp error:", e);
      setTailscaleIp(null);
    } finally {
      setIpLoading(false);
    }
  }, []);

  const fetchAdbStatus = useCallback(async () => {
    setAdbLoading(true);
    setUsbError(null);
    try {
      const res = await commands.checkAdbStatus().then(unwrap);
      if (res.success && res.data) {
        setAdbStatus(res.data);
      } else {
        setAdbStatus(null);
      }
    } catch (e: unknown) {
      console.error("checkAdbStatus error:", e);
      setUsbError(e instanceof Error ? e.message : String(e));
      setAdbStatus(null);
    } finally {
      setAdbLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProxyStatus();
    void fetchTailscaleIp();
    void fetchAdbStatus();

    return () => {
      // Synchronously stop the cloudflared tunnel when leaving the page to prevent leaks
      void commands.stopCloudflareTunnel().then(unwrap).catch(console.error);

      // Clean up USB reverse port forwarding if it was active
      if (proxyPortRef.current) {
        void commands.stopUsbReverse(proxyPortRef.current).then(unwrap).catch(console.error);
      }
    };
  }, [fetchProxyStatus, fetchTailscaleIp, fetchAdbStatus]);

  const handleToggleTunnel = async () => {
    setTunnelLoading(true);
    setTunnelError(null);
    if (tunnelActive) {
      try {
        await commands.stopCloudflareTunnel().then(unwrap);
        setTunnelActive(false);
        setTunnelUrl(null);
      } catch (e: unknown) {
        console.error("stopCloudflareTunnel error:", e);
        setTunnelError(e instanceof Error ? e.message : String(e));
      } finally {
        setTunnelLoading(false);
      }
    } else {
      try {
        const res = await commands.startCloudflareTunnel().then(unwrap);
        if (res.success && res.data) {
          setTunnelUrl(res.data);
          setTunnelActive(true);
        } else {
          setTunnelError(res.message || "Failed to start tunnel");
        }
      } catch (e: unknown) {
        console.error("startCloudflareTunnel error:", e);
        setTunnelError(e instanceof Error ? e.message : String(e));
      } finally {
        setTunnelLoading(false);
      }
    }
  };

  const handleToggleUsbTunnel = async () => {
    if (!proxyStatus.port) {
      return;
    }
    setUsbTunnelLoading(true);
    setUsbError(null);
    if (usbTunnelActive) {
      try {
        await commands.stopUsbReverse(proxyStatus.port).then(unwrap);
        setUsbTunnelActive(false);
      } catch (e: unknown) {
        console.error("stopUsbReverse error:", e);
        setUsbError(e instanceof Error ? e.message : String(e));
      } finally {
        setUsbTunnelLoading(false);
      }
    } else {
      try {
        await commands.startUsbReverse(proxyStatus.port).then(unwrap);
        setUsbTunnelActive(true);
      } catch (e: unknown) {
        console.error("startUsbReverse error:", e);
        setUsbError(e instanceof Error ? e.message : String(e));
      } finally {
        setUsbTunnelLoading(false);
      }
    }
  };

  const connectUrl = tunnelUrl ? `${tunnelUrl}/connect` : null;

  return (
    <div className={`flex flex-col gap-4 ${embedded ? "" : "gap-8 pb-20"}`}>
      {!embedded && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-primary">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Smartphone className="w-5 h-5" />
            </div>
            <H1 className="text-2xl tablet:text-3xl font-black text-base-content tracking-tight">
              {lang === "ko" ? "모바일 연결" : "Mobile Connection"}
            </H1>
          </div>
        </div>
      )}

      <ProxyServerWarning />

      {/* Tabs */}
      <div className="flex border-b border-base-300">
        <button
          type="button"
          onClick={() => setActiveTab("wireless")}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "wireless"
              ? "border-primary text-primary"
              : "border-transparent text-base-content/50 hover:text-base-content"
          }`}
        >
          <Wifi className="w-4 h-4" />
          {lang === "ko" ? "무선 연결 (Wi-Fi / VPN)" : "Wireless Connect (Wi-Fi / VPN)"}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("usb")}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "usb"
              ? "border-primary text-primary"
              : "border-transparent text-base-content/50 hover:text-base-content"
          }`}
        >
          <Usb className="w-4 h-4" />
          {lang === "ko" ? "USB 연결 (안드로이드 전용)" : "USB Connect (Android Only)"}
        </button>
      </div>

      {activeTab === "wireless" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Status and Controls */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card className="p-6">
              <H2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                {lang === "ko" ? "기기 및 네트워크 상태" : "Device & Network Status"}
              </H2>

              <div className="space-y-4">
                {/* Proxy Running State */}
                <div className="flex items-center justify-between p-4 bg-base-200/50 rounded-xl border border-base-300/30">
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">
                      {lang === "ko" ? "로컬 프록시 서버" : "Local Proxy Server"}
                    </span>
                    <span className="text-xs text-base-content/50 mt-1">
                      {lang === "ko"
                        ? "모바일 기기 연결 수신을 위해 프록시가 작동 중이어야 합니다."
                        : "Proxy must be active to receive mobile device connections."}
                    </span>
                  </div>
                  <Badge variant={{ color: isProxyRunning ? "green" : "gray" }}>
                    {isProxyRunning
                      ? lang === "ko"
                        ? `작동 중 (포트 ${proxyStatus.port})`
                        : `Running (Port ${proxyStatus.port})`
                      : lang === "ko"
                        ? "중지됨"
                        : "Stopped"}
                  </Badge>
                </div>

                {/* Tailscale IP Detection */}
                <div className="flex items-center justify-between p-4 bg-base-200/50 rounded-xl border border-base-300/30">
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">
                      {lang === "ko" ? "Tailscale VPN 주소" : "Tailscale VPN IP"}
                    </span>
                    <span className="text-xs text-base-content/50 mt-1">
                      {lang === "ko"
                        ? "사용자 시스템의 안전한 가상 IP 대역(100.x.x.x)입니다."
                        : "Secure private IP range (100.x.x.x) of your workstation."}
                    </span>
                  </div>
                  {ipLoading ? (
                    <Loader2Icon className="w-5 h-5 text-primary animate-spin" />
                  ) : tailscaleIp ? (
                    <span className="font-mono text-sm font-bold text-success bg-success/10 px-3 py-1 rounded-lg border border-success/20">
                      {tailscaleIp}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 text-warning bg-warning/10 px-3 py-1 rounded-lg border border-warning/20">
                      <WifiOff className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-bold">{lang === "ko" ? "IP 미감지" : "IP Not Found"}</span>
                    </div>
                  )}
                </div>
              </div>

              {!tailscaleIp && !ipLoading && (
                <div className="mt-4 p-4 bg-warning/5 border border-warning/20 rounded-xl flex flex-col gap-3 text-warning">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="text-sm leading-relaxed">
                      <p className="font-bold mb-1">
                        {lang === "ko" ? "Tailscale VPN 활성화 필요" : "Tailscale VPN Required"}
                      </p>
                      <p className="opacity-80">
                        {lang === "ko"
                          ? "시스템에서 Tailscale VPN이 비활성화되어 있거나 로그인되어 있지 않습니다. 모바일 연결 기능을 사용하려면 PC에서 Tailscale을 실행해 주세요."
                          : "Tailscale is either disabled or not signed in. Please turn on Tailscale on this PC to enable mobile handoff."}
                      </p>
                    </div>
                  </div>
                  <div className="flex pl-8">
                    <a
                      href="https://tailscale.com/download"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-warning-content bg-warning/15 hover:bg-warning/25 px-3 py-1.5 rounded-lg border border-warning/30 transition-colors"
                    >
                      {lang === "ko" ? "Tailscale PC용 다운로드" : "Download Tailscale for PC"}
                    </a>
                  </div>
                </div>
              )}
            </Card>

            {/* Cloudflare Tunnel Controller */}
            <Card className="p-6">
              <H2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Wifi className="w-5 h-5 text-primary" />
                {lang === "ko" ? "임시 Cloudflare 외부 연결 터널" : "Temporary Cloudflare Tunnel"}
              </H2>
              <P className="text-base-content/60 text-sm mb-6 leading-relaxed">
                {lang === "ko"
                  ? "모바일 브라우저의 최초 접속을 받기 위해 임시 cloudflared 터널을 백그라운드에서 구동합니다. 연결 진단 및 가이드 설정이 완료된 후 터널을 비활성화하면 통신이 자동으로 차단됩니다."
                  : "Spawns a temporary cloudflared tunnel in the background to receive initial mobile connections. Once the configuration guide is set up, disabling the tunnel instantly blocks internet access."}
              </P>

              <div className="flex items-center justify-between p-4 bg-base-200/50 rounded-xl border border-base-300/30 mb-6">
                <div className="flex flex-col">
                  <span className="font-bold text-sm">{lang === "ko" ? "터널 상태" : "Tunnel Status"}</span>
                  <span className="text-xs text-base-content/60 font-mono break-all mt-1">
                    {tunnelActive && tunnelUrl ? tunnelUrl : lang === "ko" ? "대기 중..." : "Standby..."}
                  </span>
                </div>
                <StatusToggle
                  label=""
                  checked={tunnelActive}
                  onChange={handleToggleTunnel}
                  loading={tunnelLoading}
                  disabled={!isProxyRunning || !tailscaleIp}
                />
              </div>

              {tunnelError && (
                <div className="flex flex-col gap-4 text-left">
                  <div className="p-4 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-mono break-all">
                    {tunnelError}
                  </div>

                  {tunnelError.toLowerCase().includes("cloudflared") && (
                    <div className="p-5 bg-base-200/80 border border-base-300/50 rounded-xl space-y-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-base-content">
                          {lang === "ko" ? "cloudflared 설치 안내" : "Cloudflared Guide"}
                        </span>
                        <span className="text-xs text-base-content/50 mt-1 leading-relaxed">
                          {lang === "ko"
                            ? "임시 외부 터널(trycloudflare)을 생성하기 위해 호스트 PC에 cloudflared 패키지 설치가 필요합니다."
                            : "To generate a temporary external tunnel, you must install the cloudflared package on your host PC."}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 bg-base-300/50 rounded-lg border border-base-300/80 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] font-bold opacity-40 uppercase">Windows</span>
                            <p className="text-xs font-mono mt-1 text-primary font-bold break-all">
                              winget install Cloudflare.cloudflared
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText("winget install Cloudflare.cloudflared");
                              alert(lang === "ko" ? "명령어가 복사되었습니다." : "Command copied to clipboard.");
                            }}
                            className="mt-3 text-[11px] bg-base-100 hover:bg-base-200 border border-base-300 py-1.5 rounded-md font-medium text-base-content transition-all text-center"
                          >
                            {lang === "ko" ? "명령어 복사" : "Copy Command"}
                          </button>
                        </div>

                        <div className="p-3 bg-base-300/50 rounded-lg border border-base-300/80 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] font-bold opacity-40 uppercase">macOS</span>
                            <p className="text-xs font-mono mt-1 text-primary font-bold break-all">
                              brew install cloudflared
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText("brew install cloudflared");
                              alert(lang === "ko" ? "명령어가 복사되었습니다." : "Command copied to clipboard.");
                            }}
                            className="mt-3 text-[11px] bg-base-100 hover:bg-base-200 border border-base-300 py-1.5 rounded-md font-medium text-base-content transition-all text-center"
                          >
                            {lang === "ko" ? "명령어 복사" : "Copy Command"}
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-center pt-2">
                        <a
                          href="https://github.com/cloudflare/cloudflared/releases"
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline font-bold bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 transition-colors"
                        >
                          {lang === "ko" ? "수동 다운로드 (GitHub Releases)" : "Manual Download (GitHub Releases)"}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* QR Code and Mobile Connection Steps */}
          <div className="flex flex-col gap-6">
            <Card className="p-6 flex flex-col items-center text-center">
              <H2 className="text-lg font-bold mb-4 self-start flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                {lang === "ko" ? "모바일 스캔용 QR 코드" : "Connection QR Code"}
              </H2>

              {tunnelActive && connectUrl ? (
                <div className="flex flex-col items-center gap-5 w-full">
                  <div className="p-4 bg-white rounded-2xl shadow-lg border border-base-300/20">
                    <QRCodeSVG value={connectUrl} size={220} />
                  </div>
                  <div className="bg-base-200/50 p-3 rounded-lg border border-base-300/30 font-mono text-[10px] break-all w-full select-all">
                    {connectUrl}
                  </div>
                  <P className="text-xs text-base-content/60 leading-relaxed">
                    {lang === "ko"
                      ? "모바일 기기에서 위 QR 코드를 스캔하여 연결 및 가이드 진단 페이지를 여세요."
                      : "Scan this QR code with your mobile device to open the handoff setup page."}
                  </P>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-base-content/30 w-full border-2 border-dashed border-base-300 rounded-2xl">
                  <QrCode className="w-16 h-16 opacity-40" />
                  <span className="text-sm font-medium">
                    {lang === "ko" ? "터널 활성화 시 QR이 나타납니다" : "Enable tunnel to generate QR"}
                  </span>
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="font-bold text-sm mb-3">{lang === "ko" ? "접속 및 구성 가이드" : "Handoff Process"}</h3>
              <ul className="space-y-3 text-xs leading-relaxed text-base-content/70">
                <li className="flex gap-2">
                  <span className="font-bold text-primary shrink-0">1.</span>
                  <span>
                    {lang === "ko"
                      ? "모바일 기기에서 Tailscale VPN 스위치를 활성화해 주세요."
                      : "Activate Tailscale VPN switch on your mobile device."}
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary shrink-0">2.</span>
                  <span>
                    {lang === "ko"
                      ? "QR 코드를 찍어 Horizon Gateway 가이드 페이지에 접속합니다."
                      : "Scan the QR code to open the Horizon Gateway diagnostics page."}
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary shrink-0">3.</span>
                  <span>
                    {lang === "ko"
                      ? "가이드에 안내된 수동 혹은 자동 프록시(PAC) 주소를 기기의 Wi-Fi 설정에 대입해 주면 연결이 완료됩니다."
                      : "Configure PAC or manual proxy on your Wi-Fi settings as guided on your phone to complete setup."}
                  </span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      ) : (
        /* USB Tab */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <H2 className="text-lg font-bold flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  {lang === "ko" ? "ADB 및 USB 디바이스 감지" : "ADB & USB Device Detection"}
                </H2>
                <button
                  type="button"
                  onClick={fetchAdbStatus}
                  disabled={adbLoading}
                  className="p-1.5 bg-base-200 hover:bg-base-300 border border-base-300 rounded-lg text-base-content/70 hover:text-base-content transition-all disabled:opacity-50"
                  title={lang === "ko" ? "상태 갱신" : "Refresh Status"}
                >
                  <RefreshCw className={`w-4 h-4 ${adbLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {adbLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2Icon className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : adbStatus ? (
                <div className="space-y-4">
                  {/* ADB Installation State */}
                  <div className="flex items-center justify-between p-4 bg-base-200/50 rounded-xl border border-base-300/30">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">{lang === "ko" ? "ADB 설치 상태" : "ADB Installation"}</span>
                      <span className="text-xs text-base-content/50 mt-1 font-mono break-all pr-4">
                        {adbStatus.found
                          ? `${lang === "ko" ? "감지됨" : "Detected"}: ${adbStatus.path || ""}`
                          : lang === "ko"
                            ? "설치되지 않음"
                            : "Not Detected"}
                      </span>
                    </div>
                    <Badge variant={{ color: adbStatus.found ? "green" : "red" }}>
                      {adbStatus.found ? (lang === "ko" ? "정상" : "Ready") : lang === "ko" ? "미설치" : "Missing"}
                    </Badge>
                  </div>

                  {/* Connected Devices */}
                  <div className="p-4 bg-base-200/50 rounded-xl border border-base-300/30">
                    <span className="font-bold text-sm block mb-2">
                      {lang === "ko" ? "연결된 안드로이드 디바이스" : "Connected Android Devices"}
                    </span>
                    {adbStatus.devices.length > 0 ? (
                      <div className="space-y-2 mt-2">
                        {adbStatus.devices.map((device, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 p-2 bg-success/5 border border-success/15 rounded-lg text-success text-xs font-mono"
                          >
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
                            <span>{device} (device)</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-warning/5 border border-warning/15 rounded-lg text-warning text-xs mt-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-warning" />
                        <span>
                          {lang === "ko"
                            ? "연결된 기기가 없습니다. 폰을 연결하고 'USB 디버깅'이 활성화되어 있는지 확인하세요."
                            : "No devices connected. Ensure your phone is connected and 'USB Debugging' is enabled."}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-mono">
                  {lang === "ko" ? "ADB 상태 정보를 로드할 수 없습니다." : "Failed to load ADB status."}
                </div>
              )}

              {!adbLoading && adbStatus && !adbStatus.found && (
                <div className="mt-4 p-5 bg-warning/5 border border-warning/20 rounded-xl space-y-4 text-warning">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="text-sm leading-relaxed">
                      <p className="font-bold mb-1">
                        {lang === "ko" ? "ADB(Android Debug Bridge) 설치 필요" : "ADB Required"}
                      </p>
                      <p className="opacity-80">
                        {lang === "ko"
                          ? "USB 연결을 통한 역방향 포트 포워딩을 사용하려면 PC에 Android SDK 플랫폼 도구(ADB) 설치가 필요합니다."
                          : "To tunnel connections over USB, you must install the Android SDK Platform Tools (ADB) on your PC."}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-8">
                    <div className="p-3 bg-base-300/40 rounded-lg border border-base-300/60 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold opacity-50 uppercase">Windows (Chocolatey)</span>
                        <p className="text-xs font-mono mt-1 text-primary font-bold break-all">choco install adb</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText("choco install adb");
                          alert(lang === "ko" ? "명령어가 복사되었습니다." : "Command copied.");
                        }}
                        className="mt-3 text-[11px] bg-base-100 hover:bg-base-200 border border-base-300 py-1 rounded font-medium transition-all text-center"
                      >
                        {lang === "ko" ? "명령어 복사" : "Copy Command"}
                      </button>
                    </div>

                    <div className="p-3 bg-base-300/40 rounded-lg border border-base-300/60 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold opacity-50 uppercase">macOS (Homebrew)</span>
                        <p className="text-xs font-mono mt-1 text-primary font-bold break-all">
                          brew install --cask android-platform-tools
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText("brew install --cask android-platform-tools");
                          alert(lang === "ko" ? "명령어가 복사되었습니다." : "Command copied.");
                        }}
                        className="mt-3 text-[11px] bg-base-100 hover:bg-base-200 border border-base-300 py-1 rounded font-medium transition-all text-center"
                      >
                        {lang === "ko" ? "명령어 복사" : "Copy Command"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* USB Reverse Controller */}
            <Card className="p-6">
              <H2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Usb className="w-5 h-5 text-primary" />
                {lang === "ko" ? "USB 포트 터널링 스위치" : "USB Port Tunneling Switch"}
              </H2>
              <P className="text-base-content/60 text-sm mb-6 leading-relaxed">
                {lang === "ko"
                  ? `안드로이드 폰의 로컬 ${proxyStatus.port || 8888} 포트를 PC의 Horizon Gateway 프록시 서버로 다이렉트 바인딩해주는 USB 터널을 켭니다. 무선 공유기 상태에 구애받지 않고 오프라인 상태에서도 온전히 감시와 모킹이 가능합니다.`
                  : `Forward your Android device's local port ${proxyStatus.port || 8888} back to the Horizon Gateway proxy server on your host PC via USB. This operates offline and bypasses Wi-Fi router / corporate intranet restrictions.`}
              </P>

              <div className="flex items-center justify-between p-4 bg-base-200/50 rounded-xl border border-base-300/30">
                <div className="flex flex-col">
                  <span className="font-bold text-sm">{lang === "ko" ? "USB 터널 상태" : "USB Tunnel Status"}</span>
                  <span className="text-xs text-base-content/60 font-mono mt-1">
                    {usbTunnelActive
                      ? lang === "ko"
                        ? `터널 활성화됨 (port ${proxyStatus.port || 8888} -> ${proxyStatus.port || 8888})`
                        : `Tunnel Active (port ${proxyStatus.port || 8888} -> ${proxyStatus.port || 8888})`
                      : lang === "ko"
                        ? "터널 중지됨"
                        : "Tunnel Inactive"}
                  </span>
                </div>
                <StatusToggle
                  label=""
                  checked={usbTunnelActive}
                  onChange={handleToggleUsbTunnel}
                  loading={usbTunnelLoading}
                  disabled={!isProxyRunning || !adbStatus?.found || adbStatus.devices.length === 0}
                />
              </div>

              {usbError && (
                <div className="mt-4 p-4 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-mono break-all">
                  {usbError}
                </div>
              )}
            </Card>
          </div>

          {/* USB Connect Guidelines */}
          <div className="flex flex-col gap-6">
            <Card className="p-6">
              <h3 className="font-bold text-sm mb-3">
                {lang === "ko" ? "USB 프록시 구성 가이드" : "USB Setup Process"}
              </h3>
              <ul className="space-y-4 text-xs leading-relaxed text-base-content/70">
                <li className="flex gap-2">
                  <span className="font-bold text-primary shrink-0">1.</span>
                  <div>
                    <span className="font-bold block text-base-content">
                      {lang === "ko" ? "안드로이드 개발자 모드 및 USB 디버깅 켜기" : "Enable USB Debugging"}
                    </span>
                    <span>
                      {lang === "ko"
                        ? "설정 -> 휴대전화 정보 -> 소프트웨어 정보 -> '빌드 번호'를 7번 연타하여 개발자 옵션을 연 뒤, 'USB 디버깅'을 활성화합니다."
                        : "Go to Settings -> About Phone -> Software Info -> tap 'Build Number' 7 times to enable Developer Options, then enable 'USB Debugging'."}
                    </span>
                  </div>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary shrink-0">2.</span>
                  <div>
                    <span className="font-bold block text-base-content">
                      {lang === "ko" ? "USB 케이블 연결 및 터널 스위치 On" : "Connect USB & Toggle Switch"}
                    </span>
                    <span>
                      {lang === "ko"
                        ? "폰을 PC에 연결하고, 위의 'USB 포트 터널링 스위치'를 활성화하여 연결 상태를 등록합니다."
                        : "Connect your phone to your PC via USB, then toggle the 'USB Port Tunneling Switch' above to establish the tunnel."}
                    </span>
                  </div>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary shrink-0">3.</span>
                  <div>
                    <span className="font-bold block text-base-content">
                      {lang === "ko"
                        ? "자동 시스템 프록시 주입 (수동 설정 불필요)"
                        : "Automated System Proxy Injection"}
                    </span>
                    <span>
                      {lang === "ko"
                        ? "위의 스위치를 켜는 즉시 Horizon Gateway가 폰의 전체 시스템 프록시를 127.0.0.1:8888로 자동 주입합니다. 혹시 이전에 와이파이 설정에서 수동으로 프록시를 설정하셨다면 충돌 방지를 위해 반드시 '없음(안함)' 상태로 원복해 주세요."
                        : "Upon toggling the switch, Horizon Gateway will automatically configure your device's global HTTP proxy to 127.0.0.1:8888. If you have previously set a manual Wi-Fi proxy on your device, please revert it back to 'None'."}
                    </span>
                  </div>
                </li>
              </ul>
            </Card>

            {/* iOS Unsupported warning card */}
            <Card className="p-6 border border-warning/20 bg-warning/5 text-warning">
              <H2 className="text-sm font-bold mb-2 flex items-center gap-2 text-warning">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {lang === "ko" ? "iOS (아이폰/아이패드) 미지원 안내" : "iOS Unsupported"}
              </H2>
              <P className="text-xs leading-relaxed opacity-85">
                {lang === "ko"
                  ? "Apple의 샌드박스 정책 및 iOS 시스템 제약으로 인해 USB 포트를 통한 웹 데이터 역방향 포워딩(Reverse tunneling)은 지원되지 않습니다. 아이폰 사용자의 경우 상단의 [무선 연결] 탭을 눌러 Tailscale VPN 또는 일반 Wi-Fi 프록시 구성을 이용해 주시기 바랍니다."
                  : "Due to Apple's sandbox security policies and iOS system limitations, USB reverse port forwarding is not supported. For iOS devices, please click the [Wireless Connect] tab above to set up a Tailscale VPN or Wi-Fi proxy connection."}
              </P>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
