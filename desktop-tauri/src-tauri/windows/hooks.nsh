; 설치 전에: 예전 Electron 버전(무거운 것)을 끄고 조용히 지워요. 데이터 폴더는 그대로 둬요.
!macro NSIS_HOOK_PREINSTALL
  nsExec::Exec 'taskkill /F /IM AnniversaryDday.exe'
  Sleep 800
  IfFileExists "$LOCALAPPDATA\Programs\AnniversaryDday\Uninstall AnniversaryDday.exe" 0 +3
    ExecWait '"$LOCALAPPDATA\Programs\AnniversaryDday\Uninstall AnniversaryDday.exe" /S _?=$LOCALAPPDATA\Programs\AnniversaryDday'
    RMDir /r "$LOCALAPPDATA\Programs\AnniversaryDday"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "oc.atelier.dday"
!macroend
