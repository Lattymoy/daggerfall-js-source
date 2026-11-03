!macro customCheckAppRunning
  ${if} ${isUpdated}
    !insertmacro FIND_PROCESS "DFO Online.exe" $R0
    ${if} $R0 == 0
      Sleep 1000
      !insertmacro FIND_PROCESS "DFO Online.exe" $R0
      ${if} $R0 == 0
        nsExec::Exec `"$SYSDIR\cmd.exe" /c taskkill /f /im "DFO Online.exe" /fi "USERNAME eq %USERNAME%"`
      ${endIf}
    ${endIf}
    !insertmacro FIND_PROCESS "Daggerfall Online.exe" $R0
    ${if} $R0 == 0
      Sleep 1000
      !insertmacro FIND_PROCESS "Daggerfall Online.exe" $R0
      ${if} $R0 == 0
        nsExec::Exec `"$SYSDIR\cmd.exe" /c taskkill /f /im "Daggerfall Online.exe" /fi "USERNAME eq %USERNAME%"`
      ${endIf}
    ${endIf}
    !insertmacro FIND_PROCESS "Daggerfall Forever.exe" $R0
    ${if} $R0 == 0
      Sleep 1000
      !insertmacro FIND_PROCESS "Daggerfall Forever.exe" $R0
      ${if} $R0 == 0
        nsExec::Exec `"$SYSDIR\cmd.exe" /c taskkill /f /im "Daggerfall Forever.exe" /fi "USERNAME eq %USERNAME%"`
      ${endIf}
    ${endIf}
  ${endIf}
  !insertmacro _CHECK_APP_RUNNING
!macroend

