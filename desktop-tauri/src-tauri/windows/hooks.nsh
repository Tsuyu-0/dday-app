; 지우기 프로그램(uninstall.exe)도 앱 아이콘으로 (기본 NSIS 아이콘이 바이러스처럼 보여서)
!ifndef MUI_UNICON
  !define MUI_UNICON "${__FILEDIR__}\..\icons\icon.ico"
!endif

; 설치 전에: 예전 Electron 버전(무거운 것)을 끄고 조용히 지워요. 데이터 폴더는 그대로 둬요.
!macro NSIS_HOOK_PREINSTALL
  nsExec::Exec 'taskkill /F /IM AnniversaryDday.exe'
  Sleep 800
  IfFileExists "$LOCALAPPDATA\Programs\AnniversaryDday\Uninstall AnniversaryDday.exe" 0 +3
    ExecWait '"$LOCALAPPDATA\Programs\AnniversaryDday\Uninstall AnniversaryDday.exe" /S _?=$LOCALAPPDATA\Programs\AnniversaryDday'
    RMDir /r "$LOCALAPPDATA\Programs\AnniversaryDday"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "oc.atelier.dday"
!macroend
