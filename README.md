# 노션 타임블록 위젯 — Vercel 배포 가이드

노션 데이터베이스와 양방향 동기화되는 타임블록 위젯입니다.
위젯에서 추가/수정/삭제/완료 → 노션 DB에 바로 반영, 노션에서 바꾼 것도 새로고침하면 반영돼요.

순서대로 따라하면 30~40분 정도 걸려요. 터미널/코딩 환경 필요 없습니다.

---

## 1단계 — 노션 데이터베이스 만들기

1. 노션에서 새 페이지 → `/database` → "Table - Full page" 선택
2. 아래 속성(컬럼)을 **이름 그대로** 만들어주세요. (대소문자 정확히)

| 속성 이름 | 타입 | 설명 |
|----------|------|------|
| `Title` | 제목(Title) | 블록 제목 (기본 제목 컬럼 이름을 Title로 변경) |
| `Time` | 날짜(Date) | ⚠️ "Include time" 켜고, "End date"도 켜기 |
| `Category` | 선택(Select) | 옵션: work, study, meet, class, exercise, etc |
| `URL` | URL | 작업 환경 링크 |
| `Done` | 체크박스(Checkbox) | 완료 여부 |

> Category 옵션은 위젯 색상과 매칭돼요: work(업무)·study(논문/공부)·meet(미팅)·class(수업)·exercise(운동)·etc(기타)

3. **데이터베이스 ID 복사**: 데이터베이스를 풀페이지로 열고 URL을 봐요.
   `https://notion.so/[워크스페이스]/[★이부분이_DB_ID★]?v=...`
   `?v=` 앞의 32자리 문자열이 DB ID예요. 메모해두세요.

---

## 2단계 — 노션 인테그레이션(연동) 만들기

1. https://www.notion.so/my-integrations 접속
2. "New integration" 클릭 → 이름 입력(예: 타임블록) → 워크스페이스 선택 → 저장
3. "Internal Integration Secret" 의 토큰을 복사 (secret_ 로 시작). **메모해두세요.**
4. 1단계에서 만든 DB로 돌아가서 → 우측 상단 `...` → "Connections" (연결) → 방금 만든 인테그레이션 선택해서 연결
   - 이걸 안 하면 권한이 없어서 동기화가 안 돼요!

---

## 3단계 — GitHub에 코드 올리기

1. https://github.com 로그인 → "New repository" → 이름 입력(예: timeblock-vercel) → Create
2. 이 폴더의 파일들을 업로드:
   - "uploading an existing file" 클릭
   - `index.html`, `package.json`, `api/blocks.js` 를 드래그해서 올리기
   - ⚠️ `blocks.js`는 반드시 `api` 폴더 안에 있어야 해요. (업로드 시 `api/blocks.js` 경로 유지)
3. Commit

---

## 4단계 — Vercel에 배포하기

1. https://vercel.com 접속 → GitHub 계정으로 로그인
2. "Add New..." → "Project" → 방금 만든 GitHub 저장소 선택 → Import
3. 배포 설정은 기본값 그대로 두고, **"Environment Variables"** 펼쳐서 아래 3개 입력:

| 이름 | 값 |
|------|-----|
| `NOTION_TOKEN` | 2단계에서 복사한 secret_ 토큰 |
| `NOTION_DATABASE_ID` | 1단계에서 복사한 DB ID |
| `SYNC_SECRET` | (선택) 아무 비밀번호. 위젯 무단접근 방지용 |

4. "Deploy" 클릭 → 1~2분 대기
5. 배포 완료되면 `https://프로젝트이름.vercel.app` 주소가 나와요. **복사해두세요.**

---

## 5단계 — 위젯에 Vercel 주소 연결

1. `index.html` 파일을 열어서 상단의 이 부분을 수정:

```js
const API_BASE = "https://여기에-본인-vercel-주소.vercel.app/api/blocks";
const SYNC_SECRET = ""; // SYNC_SECRET 설정했다면 동일하게 입력
```

   → 본인 Vercel 주소로 변경 (끝에 `/api/blocks` 꼭 붙이기)
   → SYNC_SECRET 설정했다면 동일한 값 입력

2. 수정한 `index.html`을 GitHub에 다시 업로드(덮어쓰기) → Vercel이 자동 재배포

---

## 6단계 — 노션에 임베드

1. 위젯 주소는 본인 Vercel 메인 주소예요: `https://프로젝트이름.vercel.app`
2. 노션 페이지에서 `/embed` → 위 주소 붙여넣기 → "Embed link"
3. 끝! 이제 위젯에서 한 모든 작업이 노션 DB에 자동 저장돼요.

---

## 동작 확인

- 위젯에서 블록 추가 → 노션 DB에 새 행 생기는지 확인
- 노션 DB에서 직접 행 추가 → 위젯 "새로고침" 누르면 나타남
- 상단 상태표시: 초록불=동기화됨, 빨간불=연결 문제

## 자주 나는 문제

- **"연결 실패"**: Vercel 주소 끝에 `/api/blocks` 붙였는지, 환경변수 3개 정확한지 확인
- **"object_not_found"**: 2단계 4번(DB에 인테그레이션 연결)을 안 했을 때
- **블록이 안 보임**: Time 속성에 "Include time"과 "End date"가 켜져 있는지 확인
- **시간이 9시간 어긋남**: 코드가 한국시간(+09:00) 기준이에요. 다른 시간대면 blocks.js의 `TZ` 수정

## 보안 참고

- 노션 토큰은 Vercel 서버에만 저장돼요(환경변수). 위젯 코드엔 안 들어가요.
- 다만 Vercel API 주소를 아는 사람은 DB를 읽고 쓸 수 있어요. 신경 쓰이면 `SYNC_SECRET`을 꼭 설정하세요.
