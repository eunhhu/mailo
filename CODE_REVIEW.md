# Code Review

Date: 2026-02-15
Branch: `main` (working tree dirty; review based on current unstaged changes)

## Scope

Reviewed changed/new files:

- Frontend
  - `frontend/src/App.tsx`
  - `frontend/src/api/client.ts`
  - `frontend/src/routes/Inbox.tsx`
  - `frontend/src/routes/Email.tsx`
  - `frontend/src/routes/Compose.tsx`
  - `frontend/src/stores/emails.ts`
  - `frontend/src/components/Sidebar.tsx` (new)
  - `frontend/src/components/Toast.tsx` (new)
  - `frontend/src/styles.css`
  - `frontend/package.json`
- Backend
  - `src/auth/google-oauth.ts`
  - `src/auth/token-manager.ts`
  - `src/auth/rate-limiter.ts` (new)
  - `src/config.ts`
  - `src/db/schema.ts`
  - `src/gmail/client.ts`
  - `src/routes/auth.ts`
  - `src/routes/messages.ts`
- Tooling
  - `package.json`
  - `.gitignore`

## What Changed (High-Level)

- Frontend: mailbox UX 크게 확장
  - 사이드바 기반 폴더 네비게이션, 토스트 피드백, 스와이프/배치 선택/키보드 단축키 등 대폭 추가.
  - 폴더/검색/캐시를 store로 통합하고 각 액션(보관/휴지통/스팸/별표/읽음 토글)을 API로 호출.
- Backend: Gmail modify 권한 + 메시지 액션 API 추가
  - OAuth scope를 `gmail.modify`로 확대.
  - 메시지 액션 엔드포인트(`archive/trash/untrash/read/unread/star/unstar/spam/unspam/move-to-inbox`) 추가.
  - DB에 저장되는 OAuth 토큰을 AES-256-GCM으로 암호화 저장.
  - 비밀번호 검증 라우트에 rate limit 도입 + OAuth `state` 검증 도입.

## Key Findings

### 1) API Contract / Functional Gaps

- `frontend/src/stores/emails.ts`에 `permanentDeleteEmail()`이 `/api/messages/:id/delete`를 호출하지만,
  `src/routes/messages.ts`에 해당 라우트가 없습니다.
  - 영향: 호출하는 UI가 생기면 즉시 404/실패.
  - 조치: (a) 백엔드에 `POST /api/messages/:id/delete` 추가(실제로는 Gmail DELETE 호출) 또는 (b) 프론트 액션 제거.

### 2) Gmail Body Decoding Robustness

- `src/gmail/client.ts`의 `decodeBase64Url()`가 base64url padding(=) 보정을 하지 않습니다.
  - Gmail API는 padding 없는 base64url을 반환하는 케이스가 흔해서, `atob()`가 간헐적으로 throw 할 수 있습니다.
  - 조치: 길이를 4의 배수로 맞추는 padding 로직 추가 권장.

### 3) Rate Limiter Runtime Compatibility

- `src/auth/rate-limiter.ts`에서 `setInterval(...).unref()` 사용.
  - Node에서는 일반적이지만 Bun 런타임에서 `unref` 지원 여부/타이핑이 환경에 따라 다를 수 있습니다.
  - 조치: (a) Bun에서 `unref` 지원 확인, (b) 없다면 조건부 호출(존재할 때만)로 변경 권장.

### 4) Security Notes

- OAuth `state` 쿠키 기반 검증(`src/routes/auth.ts`) 추가는 좋은 변화(로그인 CSRF 완화).
- 토큰 at-rest 암호화(`src/auth/token-manager.ts`)도 좋은 변화.
  - 다만 키 유도는 단순 SHA-256 해시이므로 `SESSION_SECRET`의 엔트로피 품질에 강하게 의존합니다.
  - 조치: 운영에서는 충분히 긴 랜덤 secret을 강제/문서화 권장.
- `x-forwarded-for`를 그대로 rate limit key로 사용(`src/routes/auth.ts`).
  - 리버스 프록시 신뢰 설정이 없으면 헤더 스푸핑으로 우회 가능.
  - 조치: 인프라에서 신뢰 가능한 프록시만 헤더를 주입하도록 보장하거나, 다른 식별자(세션/서버-관측 IP) 사용 권장.

### 5) Frontend UX / A11y / State

- 좋은 점
  - `frontend/src/api/client.ts`에 `credentials: "same-origin"` 적용으로 쿠키 기반 인증 흐름이 안정적.
  - `frontend/src/App.tsx`에서 Skip link + Shell 분리로 구조가 명확.
  - `frontend/src/stores/emails.ts`의 list/detail cache는 UX에 유리(폴더/검색 재진입 시 즉시 표시).

- 주의할 점
  - `frontend/src/routes/Email.tsx`에서 읽음 처리 실패를 `catch(() => {})`로 무시.
    - 영향: 실패 시 UI 상태가 서버와 불일치할 수 있음.
  - `frontend/src/routes/Inbox.tsx`는 상호작용이 매우 많음(스와이프/롱프레스/배치선택/키보드).
    - 영향: edge-case(스크롤 vs 스와이프, 포커스, 선택 모드 전환)에서 버그가 나기 쉬움.
  - `iframe sandbox="allow-same-origin"` + `srcdoc` 사용(`frontend/src/routes/Email.tsx`).
    - 현 상태에서는 `allow-scripts`가 없어 스크립트 실행은 막히지만, HTML 렌더링 특성상 레이아웃/리소스 로딩 이슈가 있을 수 있어 통합 테스트 권장.

## Verification (Commands Run)

### Typecheck

Command:

```bash
npm run typecheck
```

Result: FAIL

- `TS7016` `@motionone/solid` typings resolution issue (package.json exports + TS moduleResolution 조합)
  - Affected examples: `frontend/src/routes/Inbox.tsx`, `frontend/src/routes/Email.tsx`, `frontend/src/routes/Compose.tsx`, `frontend/src/components/Toast.tsx`
- `TS2769` `Set<unknown>` -> `Set<string>` mismatch
  - Affected: `frontend/src/routes/Inbox.tsx`

### Lint (Biome)

Command:

```bash
npm run lint
```

Result: FAIL (99 errors reported; additional diagnostics truncated)

- Formatting/organizeImports issues across JSON/TS/TSX (Biome expects tabs per `biome.json`).
- A11y lint errors in `frontend/src/components/Sidebar.tsx` (SVG title rule, click handlers without keyboard handlers, button type, semantic role suggestions 등).

### Frontend Build

Command:

```bash
npm -C frontend run build
```

Result: PASS

### Root Build

Command:

```bash
npm run build
```

Result: FAIL (environment)

- `scripts/build.sh`에서 `bun: command not found`.
  - 본 환경에 Bun이 설치되지 않아 발생. (프로젝트 자체가 Bun 의존)

## Risk Assessment

- High (merge 전에 정리 권장)
  - 타입체크 실패(현재 `npm run typecheck`가 깨짐)
  - API contract mismatch(`/api/messages/:id/delete`)
  - base64url decoding padding 미처리로 본문 파싱이 간헐적으로 깨질 가능성

## Recommended Follow-ups

1) 타입체크 복구
   - `@motionone/solid` 타입 해석 문제 해결(예: tsconfig `moduleResolution` 조정, 타입 shim 추가, 패키지 버전/exports 확인 등).
   - `Inbox.tsx`의 `Set<string>` 타입 오류 수정(생성 시 명시적 제네릭 등).
2) API contract 정리
   - `/api/messages/:id/delete` 추가하거나 `permanentDeleteEmail` 제거.
3) Gmail body decode 안정화
   - base64url padding 보정 추가.
4) Bun 런타임에서 rate limiter의 `unref()` 동작 확인.
5) Lint/A11y 정리(특히 새로 추가된 Sidebar/Toast/Inbox 인터랙션).
