!macro NSIS_HOOK_POSTINSTALL
  ; WinDivert user-mode DLL + driver must live next to the exe (Windows loader / WinDivertOpen).
  IfFileExists "$INSTDIR\WinDivert.dll" skip_wd_dll
  IfFileExists "$INSTDIR\resources\WinDivert.dll" 0 skip_wd_dll
    CopyFiles /SILENT "$INSTDIR\resources\WinDivert.dll" "$INSTDIR\WinDivert.dll"
  skip_wd_dll:

  IfFileExists "$INSTDIR\WinDivert64.sys" skip_wd_sys
  IfFileExists "$INSTDIR\resources\WinDivert64.sys" 0 skip_wd_sys
    CopyFiles /SILENT "$INSTDIR\resources\WinDivert64.sys" "$INSTDIR\WinDivert64.sys"
  skip_wd_sys:

  IfSilent skip_path
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to add Horizon Gateway to your environment variables (PATH)?$\r$\nThis allows you to run 'horizon-gateway' from any terminal." IDNO skip_path
  nsExec::Exec `powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "$path = [System.Environment]::GetEnvironmentVariable('Path', 'User'); if ($path -split ';' -notcontains '$INSTDIR') { [System.Environment]::SetEnvironmentVariable('Path', ($path + ';$INSTDIR').Trim(';'), 'User') }"`
  skip_path:
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::Exec `powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "$path = [System.Environment]::GetEnvironmentVariable('Path', 'User'); $newPath = ($path -split ';' | Where-Object { $_ -ne '$INSTDIR' }) -join ';'; [System.Environment]::SetEnvironmentVariable('Path', $newPath, 'User')"`
!macroend
