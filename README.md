# 미니 방치형 정원 게임

Vite + React + TypeScript + React Three Fiber로 재구축한 3D 미니 방치형 정원입니다. 기존 바닐라 구현은 `legacy/` 폴더에 보존되어 있고, 현재 실행 대상은 `v2/`입니다.

## 실행

```powershell
cd v2
npm install
npm run dev
```

기본 밸런스는 데모용입니다. 실서비스 리듬을 확인하려면 URL에 `?balance=live`를 붙이거나 localStorage의 `mini-idle-garden-balance` 값을 `live`로 설정합니다.

## 빌드

```powershell
cd v2
npm run build
```

정적 산출물은 `v2/dist/`에 생성됩니다.

## 구현된 기능

- 3D 정원: 3x3 밭, 심기, 물주기, 황금 물뿌리개, 비료 사용, 수확 연출
- 3D 숲 입구: 6개 채집 포인트, 예비 리필, 밤 전용 채집물 안내
- 경제 패널: 씨앗 상점, 인벤토리 판매, 모두 판매, 오늘의 손님 납품
- 도감: 26개 항목, 달성 보상, 티어4 작물 씨앗 획득
- 저장: v1 localStorage 키 호환, 버전 마이그레이션, 오프라인 성장/출석/채집 리필
- 접속 보상감: 30분 이상 오프라인 후 웰컴백 요약 모달
- 밸런스 프리셋: `demo`와 `live`
- 기본 접근성: 토스트 `aria-live`, 캔버스 조작을 보완하는 숨김 밭 상태 목록

## 파일 구조

- `v2/src/game/data.ts` — 작물, 채집물, 보상, 밸런스 프리셋
- `v2/src/game/logic.ts` — 성장, 품질, 출석, 손님, 도감, 채집 규칙
- `v2/src/game/save.ts` — 저장 마이그레이션
- `v2/src/game/store.ts` — Zustand 상태와 게임 액션
- `v2/src/scene/` — 3D 정원/숲 씬과 절차적 작물 모델
- `v2/src/App.tsx` — React UI 패널
- `legacy/` — v1 바닐라 구현 보존본
