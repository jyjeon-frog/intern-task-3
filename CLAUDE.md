# CLAUDE.md — VeraNova 판매 데이터 관리 웹앱

이 파일은 이 저장소에서 작업할 때 **반드시 지켜야 하는 규칙**을 적어둔 문서다.
새 작업을 시작하기 전에 항상 이 파일을 먼저 읽는다.

---

## 1. 프로젝트 개요

가상의 화장품 브랜드 **VeraNova**의 판매 데이터를 입력·관리·시각화하는 사내용 웹앱.
사용자 20명 내외 규모. **단순하고 읽기 쉬운 코드를 최우선**으로 하고 과한 설계를 하지 않는다.

- 모든 데이터는 **가상 데이터**다. 실제 회사·실존 인물 정보를 절대 쓰지 않는다.
- UI 언어: 한국어 / 시간대: Asia/Seoul / 날짜 표기: `YYYY-MM-DD`

---

## 2. 기술 스택 (변경 금지)

| 항목 | 선택 | 버전 |
| --- | --- | --- |
| 프레임워크 | Next.js (App Router) | 15.5.23 |
| 언어 | TypeScript | 5.x |
| 스타일 | Tailwind CSS v4 + shadcn/ui | - |
| DB | Supabase(PostgreSQL) | - |
| ORM | Prisma | 6.19.3 |
| 인증 | Auth.js (NextAuth) Credentials Provider, JWT 세션 | 5.0.0-beta |
| 비밀번호 | bcryptjs, cost 12 | 3.x |
| 엑셀 | SheetJS (`xlsx`, CDN 배포판) | 0.20.3 |
| 차트 | Recharts | 3.x |
| 검증 | Zod | 4.x |
| 배포 | Vercel | - |
| 검증 테스트 | Playwright | 1.49.1 (고정) |
| 로컬 Node | `~/.local/node/bin` (v22.23.2) | - |

**로컬에서 명령을 실행할 때는 PATH를 먼저 잡는다:**

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

### 버전 관련 메모

- Prisma는 **6.x로 고정**한다. 7.x는 드라이버 어댑터가 기본이라 Supabase+Vercel 설정이
  달라지고 검증 부담이 커진다.
- `npm audit`에 남는 high 항목(postcss, sharp, deepmerge-ts)은 Next 15 / Prisma 6 CLI의
  **빌드·CLI 전용 하위 의존성**이다. 앱 요청 경로에서 쓰이지 않으며, 해소하려면 Next 16으로
  올려야 해서 스택 고정 원칙상 두고 간다.
- `xlsx`는 npm 레지스트리판(0.18.5)에 취약점이 있어 **SheetJS 공식 CDN 배포판**을 쓴다.
- Playwright는 **1.49.1로 정확히 고정**한다(`--save-exact`). 이 맥은 macOS 13이라
  1.50 이상은 크로미움 브라우저를 내려받지 못한다.
- 서버 액션 파일(`"use server"`)에는 `export const runtime = "nodejs"` 를 쓸 수 없다.
  서버 액션은 페이지와 같은 런타임에서 돌고, 이 프로젝트는 Edge를 어디에도 지정하지
  않으므로 항상 Node.js 런타임이다.
- `shadcn` 패키지는 CLI 도구처럼 보이지만 `globals.css`가 `shadcn/tailwind.css`를 import 하므로
  **런타임 의존성으로 남겨둬야 한다.** 지우면 빌드가 깨진다.

---

## 3. 폴더 구조

```
prisma/
  schema.prisma        DB 스키마
  seed.ts              초기 계정 생성 (admin / user01)
  migrations/          마이그레이션 기록
sample-data/
  sample_sales_data.xlsx          2026-05~07, 331건
  sample_sales_data_202608.xlsx   2026-08, 57건
scripts/
  generate-sample-data.js         샘플 엑셀 생성기(재현용)
e2e/                   Playwright 검증 테스트
src/
  app/
    (auth)/login/      로그인 화면
    (app)/             로그인 후 공통 레이아웃(상단바·메뉴)
      dashboard/       대시보드 (모든 계정)
      data/            데이터 관리 (어드민 전용)
      accounts/        계정 관리 (어드민 전용)
    api/               API 라우트
  components/
    ui/                shadcn/ui 컴포넌트 (직접 수정 최소화)
    ...                프로젝트 전용 컴포넌트
  lib/
    prisma.ts          Prisma Client 싱글턴
    auth.config.ts     middleware(Edge)에서도 안전한 최소 설정
    auth.ts            Auth.js 설정 + Credentials Provider (Node 전용)
    session.ts         requireUser / requireAdmin / requireAdminApi
    login-attempts.ts  로그인 시도 제한 (DB 기반)
    validation.ts      Zod 스키마
  middleware.ts        비로그인 전역 차단
  types/
    next-auth.d.ts     세션에 role, loginId 추가
```

---

## 4. 권한 규칙

| 페이지 | 비로그인 | USER | ADMIN |
| --- | --- | --- | --- |
| `/login` | ○ | ○ | ○ |
| `/dashboard` | → `/login` | ○ | ○ |
| `/data` | → `/login` | **403** | ○ |
| `/accounts` | → `/login` | **403** | ○ |

**핵심 원칙: 권한 검사는 반드시 서버에서 한다.**
메뉴를 숨기거나 버튼을 감추는 것은 UI 편의일 뿐이며 권한 검사가 아니다.
주소를 직접 입력하거나 API를 직접 호출해도 막혀야 한다.

3중으로 검사한다.

1. `middleware.ts` — 세션 쿠키가 없으면 모든 경로를 `/login`으로 보낸다.
2. 페이지 서버 컴포넌트 — 세션의 `role`을 확인하고 권한이 없으면 403 화면을 렌더한다.
3. **모든 API 라우트 / Server Action** — 진입 직후 세션과 `role`을 다시 확인한다.
   이 검사가 빠진 엔드포인트는 만들지 않는다.

### 반드시 막아야 하는 예외 상황

- 어드민이 **자기 계정을 삭제**하거나 **자기 권한을 USER로 내리는** 것 → 차단
- 어드민이 **자기 계정을 비활성화**하는 것 → 차단
- 결과적으로 **활성 어드민이 0명**이 되는 모든 조작(삭제·강등·비활성화) → 차단
- `isActive=false` 계정으로 로그인 → 차단
- 같은 아이디로 5회 연속 로그인 실패 → 1분 잠금 (`LoginAttempt` 테이블 기준)

---

## 5. Supabase / Vercel 필수 준수사항

### DB 연결

- `DATABASE_URL` = Connection Pooling 주소(**6543**) + `?pgbouncer=true&connection_limit=1`
- `DIRECT_URL` = 직접 연결 주소(**5432**), 마이그레이션 전용
- `schema.prisma`의 datasource에 `url`, `directUrl` 둘 다 지정 (완료)
- Prisma Client는 `src/lib/prisma.ts`의 **globalThis 싱글턴**만 import 해서 쓴다.
  `new PrismaClient()`를 다른 곳에서 절대 새로 만들지 않는다.
- `package.json`에 `"postinstall": "prisma generate"` 유지 (Vercel 빌드 실패 방지)
- `build` 스크립트는 `prisma migrate deploy && next build` — 배포 시 DB 스키마를 자동 동기화한다.

### Supabase는 데이터 저장소로만 쓴다

- **Supabase Auth 사용 금지.** 로그인은 Auth.js + 우리 `User` 테이블로만 처리한다.
- Supabase Storage / Realtime / RLS 기반 권한 처리 **금지**. 권한은 서버 코드에서 검사한다.
- Supabase SDK를 쓰지 않는다. DB 접근은 **Prisma만** 사용한다.
- Supabase 키를 `NEXT_PUBLIC_` 환경변수에 넣지 않는다.

### Vercel 서버리스 대응

- **메모리에 상태를 저장하지 않는다.** 로그인 시도 횟수는 `LoginAttempt` 테이블에 기록·조회한다.
  전역 캐시, 모듈 스코프 Map/변수에 상태 저장 금지.
- `setInterval`, 백그라운드 타이머, 파일 쓰기 등 "서버가 계속 켜져 있다는 가정"의 코드 금지.
- 인증·엑셀 처리 라우트는 **Node.js 런타임**을 쓴다. Edge 런타임 금지
  (bcrypt·Prisma가 동작하지 않는다).
- 업로드한 엑셀 파일을 **디스크에 저장하지 않는다.** 요청 body를 `ArrayBuffer`로 받아
  메모리에서 파싱하고 DB에 넣는다.
- Vercel 요청 본문 크기 제한(약 4.5MB) 초과 시
  **"파일을 나눠 올려주세요"** 안내 메시지를 보여준다.

---

## 6. 환경변수

| 이름 | 용도 | 로컬(.env) | Vercel |
| --- | --- | --- | --- |
| `DATABASE_URL` | 앱 DB 연결(6543, pgbouncer) | ○ | ○ |
| `DIRECT_URL` | 마이그레이션용(5432) | ○ | ○ |
| `AUTH_SECRET` | 세션 암호화 키 | ○ | ○ |
| `NEXTAUTH_URL` | 사이트 주소 | ○ | ○ |
| `INITIAL_ADMIN_ID` | 시드 어드민 아이디 | ○ | ○ |
| `INITIAL_ADMIN_PASSWORD` | 시드 어드민 비밀번호 | ○ | ○ |

- `.env`는 **절대 커밋하지 않는다**(.gitignore 처리 완료). `.env.example`만 커밋한다.
- 실제 비밀번호·키를 코드나 문서에 하드코딩하지 않는다.

---

## 7. 코딩 규칙

- 모든 폼은 **Zod로 서버에서 검증**한다. 클라이언트 검증만 믿지 않는다.
- 폼 제출 중에는 버튼을 비활성화한다. 모든 목록에는 로딩·빈 상태·오류 상태를 만든다.
- 오류 화면에 **에러 스택·SQL·내부 경로를 노출하지 않는다.** 사용자에게는 짧은 한국어 안내만.
- 로그인 실패 메시지는 항상 **"아이디 또는 비밀번호가 올바르지 않습니다"** 로 통일한다
  (계정 존재 여부를 알려주지 않기 위해서다).
- 집계는 DB에서(Prisma `groupBy`/`aggregate`) 처리한다. 전체 행을 브라우저로 내려보내지 않는다.
- 금액은 원 단위 정수(`Int`)로 다룬다. `매출액`은 비어 있어도 **서버에서 `수량 × 단가`로 재계산**한다.
- 반응형: 375px(휴대폰)부터 데스크톱까지 레이아웃이 깨지지 않게 만든다.
- 요구사항에 없는 기능은 추가하지 않는다. 새 라이브러리를 도입할 때는 이유를 남긴다.

---

## 8. 금지사항

- 회원가입, 소셜 로그인, 이메일 발송, 댓글, 파일 첨부, 알림, 다국어, **다크모드** 금지
- Supabase Auth / Storage / Realtime / RLS 권한 처리 금지
- 메모리 변수에 상태(로그인 시도 횟수, 캐시 등) 저장 금지
- Edge 런타임 금지 / 업로드 파일 디스크 쓰기 금지
- `.env`, 실제 비밀번호, API 키를 GitHub에 올리기 금지
- 검증 테스트를 돌리지 않은 상태로 "완료" 선언 금지
- 여러 작업 단계를 한 번에 몰아서 진행 금지 — **한 단계 = 한 커밋**, 끝나면 멈추고 확인받는다

---

## 9. 커밋 규칙

- 커밋 메시지는 **한국어**로 쓴다.
- 한 작업 단계당 커밋 하나. 사용자 확인 후에 커밋한다.
- 저장소: `https://github.com/jyjeon-frog/intern-task-3`

---

## 10. 자주 쓰는 명령

```bash
export PATH="$HOME/.local/node/bin:$PATH"

npm run dev          # 개발 서버 (http://localhost:3000)
npm run build        # 마이그레이션 적용 + 프로덕션 빌드
npm run lint         # 문법 검사
npm run db:migrate   # 스키마 변경을 DB에 반영 (개발용)
npm run db:deploy    # 마이그레이션 적용 (배포용)
npm run db:seed      # 초기 계정 생성
npm run db:studio    # DB 내용 브라우저로 확인
npm test             # Playwright 검증 테스트 (로컬)

# 배포된 주소로 같은 테스트 돌리기
BASE_URL=https://내프로젝트.vercel.app npm test
```
