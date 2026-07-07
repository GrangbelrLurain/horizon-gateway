!macro NSIS_HOOK_POSTINSTALL
  IfSilent skip_path
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to add Watchtower to your environment variables (PATH)?$\r$\nThis allows you to run 'watchtower' from any terminal." IDNO skip_path
  nsExec::Exec `powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "$path = [System.Environment]::GetEnvironmentVariable('Path', 'User'); if ($path -split ';' -notcontains '$INSTDIR') { [System.Environment]::SetEnvironmentVariable('Path', ($path + ';$INSTDIR').Trim(';'), 'User') }"`
  skip_path:
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::Exec `powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "$path = [System.Environment]::GetEnvironmentVariable('Path', 'User'); $newPath = ($path -split ';' | Where-Object { $_ -ne '$INSTDIR' }) -join ';'; [System.Environment]::SetEnvironmentVariable('Path', $newPath, 'User')"`
!macroend
