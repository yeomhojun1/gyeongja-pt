# 이슈 페이지 데이터 형식 (쇼츠 → 경자피티)

쇼츠 자동 제작 과정에서 **경제 기사**를 골랐을 때, 같은 조사 자료로 이 형식의 JSON 파일을 하나 만들면 경자피티에 이슈 페이지가 생깁니다.

```
쇼츠 자동 생성 ─ 주제 분류(경제 / 정치 / 연애 / 기타)
                  └ 경제면 → frontend/src/content/issues/<id>.json 초안 생성 (status: "draft")
                       → 사람이 확인 → status 를 "approved" 로 바꿈 → 빌드·배포
```

- 파일 위치: `frontend/src/content/issues/`
- 파일 이름 = `id` + `.json` (예: `2026-11-11-fuel-tax-extension.json`)
- 페이지 주소: 실서비스 `/i/<id>`, 데모 `/#/i/<id>`
- `status` 가 `"draft"` 이면 빌드에 들어가도 화면에 안 나옵니다. **게시 = `"approved"` 로 바꾸기**
- 형식 검사: 루트에서 `npm run check:issues` (CI 의 `npm test` 에도 포함)

## 항목

| 키 | 필수 | 설명 |
| --- | --- | --- |
| `id` | ✅ | 영문 소문자·숫자·하이픈. `날짜-주제` 권장 |
| `status` | ✅ | `"draft"` 또는 `"approved"` |
| `sample` | | `true` 면 페이지 맨 위에 "시연용 샘플" 안내가 붙음 |
| `publishedAt` | ✅ | 쇼츠 올린 날 `YYYY-MM-DD` |
| `slot` | ✅ | `"아침"` · `"점심"` · `"저녁"` (홈 목록 정렬에 씀) |
| `asOf` | ✅ | 수치 기준일 `YYYY-MM-DD` |
| `shortsTitle` | ✅ | 쇼츠 제목 그대로 (시청자가 홈에서 알아보고 누르는 문장) |
| `title` | ✅ | 이슈 페이지 제목 (차분한 말투) |
| `summary` | ✅ | 30초 요약 |
| `why` | ✅ | 왜 일어났나. 용어는 처음 나올 때 괄호 풀이 |
| `impacts` | ✅ | `{ "대출자" \| "세입자" \| "예금자" \| "직장인" \| "자영업자": "영향 설명" }` 해당되는 상황만 |
| `calculator` | | 계산 틀. 아래 참고. 틀에 안 맞는 이슈는 빼면 설명만 나옴 |
| `otherViews` | | 견해가 갈릴 때만. **2개 이상**, `[{ "title", "body" }]` 같은 분량으로 |
| `terms` | | `[{ "term", "desc" }]` |
| `sources` | ✅ | `[{ "org": 기관명, "title": 자료명, "url"?: https 주소 }]` |

## 계산 틀 (`calculator.template`)

계산식은 `frontend/src/lib/templates.js` 에 고정돼 있습니다. **AI 는 틀을 고르고 숫자를 채우기만 하고, 계산은 코드가 합니다.**

| 틀 | 쓰는 이슈 | `vars` (영상에서 가져온 값) | 시청자 입력(`inputs` 기본값) |
| --- | --- | --- | --- |
| `price_change` | 유류세·전기요금·담뱃값 | `unitPrice`+`perUnitChange`(음수=싸짐)+`unitLabel`, 또는 `changePct`. 선택 `passThroughPct`(0~100) | `monthlySpend`(원) |
| `rate_change` | 기준금리·대출금리 | `deltaPctPoint`(%p). 선택 `passThroughPct` | `principal`·`ratePct`·`months`·`method`(`equalPayment`/`equalPrincipal`/`bullet`) |
| `wage` | 최저임금 등 시급 변화 | `hourlyBefore`·`hourlyAfter` | `monthlyHours` |
| `fx` | 환율 | `rateBefore`·`rateAfter`(원/달러) | `monthlyUsd` |
| `subsidy` | 지원금·세액공제 | `amount`·`conditions`(문자열 배열)·`period`(`once`/`month`/`year`) | (체크박스) |

함께 넣을 것:

- `spendKey`: `price_change` 에서만. 내 지갑의 어느 한 달 지출로 자동 계산할지 — `fuel`(유류비)·`electricity`(전기요금)·`gas`(도시가스)·`transit`(대중교통)·`tobacco`(담배). 없으면 리터(`unitLabel: "L"`) 이슈만 유류비로 보고, 나머지는 예시값으로 계산
- `scenario`: 실제로 바뀐 게 아니라 "오른다고 가정하면"처럼 가정으로 계산하면 `true`. 내 지갑 장부에서 합계에 넣지 않고 "가정 계산"으로 따로 보여 줌 (예: 기준금리 동결 이슈)
- `resultLabel`: 결과 숫자 앞 문장 (예: `"인하가 끝났을 때와 비교하면, 연장 덕분에"`)
- `varSources`: **`vars` 의 숫자마다 출처 한 줄**. 없으면 검사에서 떨어집니다. 가정값이면 `"가정: ..."` 으로 시작
- `inputNotes`: 기본 입력값이 예시값임을 알리는 문구 (선택)
- `notes`: 계산의 한계 (선택)

## 승인할 때 확인할 것

1. `vars` 숫자가 기사·공식 자료의 숫자와 같은가 (특히 단위: 원/리터, %, %p)
2. `asOf` 와 본문 수치의 기준 시점이 맞는가
3. 투자 권유로 읽히는 문장이 없는가 (종목·코인·부동산 매수/매도, 가격 전망)
4. 쇼츠 말투(자극적)가 페이지로 넘어오지 않았는가
5. 기사 문장을 그대로 옮기지 않았는가 (사실만 요약, 원문은 `sources` 링크)
6. `otherViews` 가 한쪽만 있거나 분량이 치우치지 않았는가

예시는 `frontend/src/content/issues/` 의 샘플 3개를 보세요.
