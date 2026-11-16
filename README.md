# 기념일 D-day

자캐·최애의 기념일을, 그 아이가 직접 알려 주는 D-day.

- **웹앱**: `web/` — OC Atelier(`/dday/`)에 올려서 써요. 폰 크롬에서 열고 '홈 화면에 추가'.
- **안드로이드 앱**: `android/` (Capacitor) — `main`에 올리면 GitHub Actions가 APK를 만들어 [Releases](../../releases/latest)에 올려요.
  - 홈 화면 위젯: 다음 기념일 D-day + 캐릭터
  - 알림: 일정 알림, 기념일 아침 9시

- **PC(윈도우)**: `desktop/` (Electron) — 같은 Releases에 설치 파일 `AnniversaryDday-Setup.exe` 하나로 올라가요 (설치 없이 쓰는 zip도 같이).

데이터는 각자의 기기 안에만 저장돼요. 기기끼리 옮길 때는 설정의 백업 파일 · 캐릭터 파일(.ddchar) · 일정 보내기 코드를 써요.
