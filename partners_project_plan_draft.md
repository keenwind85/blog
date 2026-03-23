---
title: 순시미-파트너스 통합 프로젝트 계획안
date: 2026-03-16
author: Codex
status: draft
---

# 순시미-파트너스 통합 프로젝트 계획안

## 1. 문서 목적

본 문서는 현재 운영 중인 보호자용 서비스 `ssm-app`과 신규 추진 중인 `순시미 파트너스` 프로젝트를 하나의 제품/운영 체계로 결합하기 위한 계획안이다.

정리 범위는 다음과 같다.

- 현재 `ssm-app`의 기술 구조와 운영 전제
- 파트너스 웹 및 크롤러의 역할 정의
- 기존 서비스와 신규 서비스의 통합 방향
- 기술 스택 및 프레임워크 추천안
- 클라우드 PC 기반 크롤러 운영 구조
- 세부 설계안 3종
  - 센터별 Cloud PC 기반 전체 아키텍처
  - crawler-agent 상태 머신
  - `ssm-app` 연동용 DB/API 모델 초안
- 단계별 개발 로드맵 및 운영 리스크

---

## 2. 현재 순시미(`ssm-app`) 운영 구조 요약

현재 순시미 서비스는 보호자가 어르신을 등록하고, 요양보호사 또는 서비스 제공자와 연결되는 구조를 중심으로 운영되고 있다.

핵심 기능은 다음과 같다.

- 보호자 회원가입 및 로그인
- 어르신 등록 및 보호자-어르신 관계 관리
- 서비스 요청 및 매칭 관련 흐름
- 웹 보호자/제공자 서비스
- 모바일 앱 기반 사용자 접근
- 알림, 인증, 공통 API 제공

### 현재 확인된 기술 기반

`ssm-app`은 이미 다음과 같은 표준 위에서 운영되고 있다.

- Monorepo: `pnpm + turbo`
- Language: `TypeScript`
- Web/App framework:
  - `Next.js` 기반 웹 앱
  - `Expo / React Native` 기반 모바일 앱
- API: `Next.js API` 기반 서버
- ORM/DB: `Prisma + MySQL`
- Shared packages:
  - `@ssm/shared`
  - `@ssm/ui`
  - `@ssm/db`
  - 기타 bridge/chatbot/design-tokens

### 현재 구조를 파트너스에 그대로 살려야 하는 이유

신규 프로젝트를 별도 기술 스택으로 분리하면 초기에 구현은 빨라 보일 수 있으나, 중장기적으로 아래 비용이 발생한다.

- 인증/권한 체계 이원화
- 도메인 모델 중복
- 팀 내 기술 표준 분산
- 인력 교차 투입 비용 증가
- 운영 대시보드 및 로깅 체계 이원화
- 보호자 앱과 파트너스 간 연동 API 중복 구현

따라서 파트너스 프로젝트는 가능한 한 `기존 ssm-app의 표준 스택을 확장`하는 방식으로 추진하는 것이 바람직하다.

---

## 3. 신규 파트너스 프로젝트의 목표 정의

순시미 파트너스는 단순한 B2B 관리자 사이트가 아니다.

본 프로젝트는 다음과 같이 정의하는 것이 적절하다.

> 장기요양기관이 관리하는 수급자 및 계약 관련 정보를, 처리위탁 계약에 따라 순시미 플랫폼이 수집·저장·가공하고, 계약 인증된 보호자에게 본인 관련 범위 내에서 열람 및 소통 기능으로 제공하는 B2B2C형 서비스

즉, 본 프로젝트는 다음 세 층을 동시에 가진다.

- B2B: 센터 관리자용 운영 웹
- Ops: 센터별 동기화/크롤링 에이전트
- B2C: 보호자 앱에서의 계약 정보 열람 및 연결 경험

### 핵심 비즈니스 흐름

1. 센터가 파트너스로 가입한다.
2. 센터 전용 동기화 환경이 등록된다.
3. 센터가 사용하는 장기요양 시스템(롱텀)의 계약 정보를 수집한다.
4. 수집 데이터를 순시미 서버에서 정규화한다.
5. 보호자가 `ssm-app`에서 특정 센터와 계약 인증을 요청한다.
6. 센터가 승인하면, 보호자는 자기 계약 범위에 해당하는 데이터만 열람할 수 있다.

---

## 4. 프로젝트 목표와 비목표

### 목표

- 센터 입장에서 보호자 커뮤니케이션 비용을 줄인다.
- 보호자 입장에서 센터와의 계약/일정/문서/상담 흐름을 앱 안에서 확인할 수 있게 한다.
- 기존 `ssm-app` 회원과 신규 파트너스 센터 데이터를 안전하게 연결한다.
- 크롤링 기반 수집 구조를 운영 가능한 제품 수준으로 만든다.

### 비목표

- 공단 데이터를 일반 검색 서비스처럼 재판매하는 구조
- raw 크롤링 데이터를 그대로 보호자에게 노출하는 구조
- 센터별 수동 운영에 지나치게 의존하는 구조
- 각 센터 PC 환경에 맞춰 케이스별로 커스텀 대응하는 구조

---

## 5. 권장 제품 구조

본 프로젝트는 크게 4개의 구성 요소로 나누는 것이 적절하다.

### 5.1 보호자 앱/웹 (`ssm-app`)

역할:

- 기존 회원 인증
- 센터 검색/선택
- 계약 인증 요청
- 승인 후 계약/일정/태그/문서/상담 정보 열람

### 5.2 파트너 관리자 웹

역할:

- 센터 관리자 계정 로그인
- 보호자 계약 인증 요청 승인/반려
- 센터-수급자-보호자 연결 관리
- 동기화 상태, 실패 이력, 크롤러 상태 확인
- 공개 정책 설정
- 향후 문서/결제/문의 관리

### 5.3 파트너 API/운영 서버

역할:

- 센터별 동기화 제어
- 크롤러 에이전트 관리
- raw/normalized/view 데이터 저장
- 권한 검증
- 감사 로그, 동기화 로그, 에러 코드 관리

### 5.4 crawler-agent

역할:

- 장기요양 대상 사이트 로그인
- 공동인증서 기반 인증 처리
- 계약/일정/태그/상담 등 대상 데이터 수집
- 로컬 캐시 저장 및 서버 업로드
- heartbeat 및 작업 실행
- 자동 업데이트

---

## 6. 권장 기술 스택

## 6.1 파트너 관리자 웹

기존 `ssm-app` 표준을 그대로 재사용하는 것을 권장한다.

- Framework: `Next.js 14`
- Language: `TypeScript`
- UI: 기존 `@ssm/ui`, `Tailwind`, `Radix`
- Form validation: `React Hook Form + Zod`
- Data fetching: `TanStack Query`
- Auth: 기존 JWT/role 기반 체계 확장

### 권장 이유

- 기존 팀 학습 비용 최소화
- `ssm-app`과 shared package 재사용 가능
- 보호자 웹/제공자 웹과 운영 방식 통일 가능
- 추후 관리자 기능 확장이 쉬움

## 6.2 파트너 API

두 가지 방식 중 하나로 간다.

### 권장안 A

기존 `apps/api`를 확장하여 파트너 도메인 라우트를 추가

적합한 경우:

- 기존 API 표준과 인증 체계를 최대한 그대로 쓰고 싶은 경우
- 운영 인프라를 분리하지 않고 빠르게 MVP를 내고 싶은 경우

### 권장안 B

`apps/api-partner`를 별도 app으로 추가하되, `@ssm/db`, `@ssm/shared`는 공유

적합한 경우:

- 파트너 도메인이 빠르게 커질 가능성이 큰 경우
- 운영/API 릴리즈 사이클을 기존 보호자 서비스와 분리하고 싶은 경우
- 추후 외부 파트너 연동이 많아질 가능성이 있는 경우

### 현재 기준 제안

초기에는 `apps/api` 확장으로 시작하고, 파트너 도메인이 커지면 분리하는 전략이 가장 현실적이다.

## 6.3 DB

- Main relational DB: 기존 `MySQL + Prisma`
- crawler local storage: `SQLite`

### DB 전략 원칙

- 보호자 앱이 읽는 최종 데이터는 기존 MySQL 도메인으로 들어온다.
- 크롤러의 raw 수집 로그와 운영 데이터는 별도 영역으로 분리한다.
- raw data와 guardian-facing data를 동일 테이블에서 다루지 않는다.

## 6.4 crawler-agent

권장 조합:

- Language: `TypeScript`
- Runtime: `Node.js`
- Automation: `Playwright`
- Desktop shell: `Electron`
- Local DB: `SQLite`
- Logging: `pino`
- Packaging/update: `electron-builder`, `electron-updater`

### 이유

- 팀이 TypeScript 중심으로 유지보수 가능
- 브라우저 자동화 안정성 확보
- 설치형 앱 배포 및 자동 업데이트 용이
- worker/UI 분리 구조 설계 가능
- 에러 추적과 로컬 캐시 관리 용이

---

## 7. 크롤러 운영 정책: 센터 PC 직접 설치 vs 클라우드 PC

### 기존 일반적인 선택지

1. 센터 직원이 사용하는 실제 PC에 직접 설치
2. 센터 전용 물리 장비(미니PC 등)에 설치
3. 센터별 전용 Cloud PC/가상 데스크톱에 설치

### 본 프로젝트 권장안

본 프로젝트는 `센터별 전용 Cloud PC` 기반 운영을 1순위로 권장한다.

### 권장 이유

- 센터 직원 PC 전원/offline 의존성을 낮출 수 있다.
- 우리 운영팀이 직접 원격 접속 및 장애 대응이 가능하다.
- 크롤러 실행 환경을 표준화할 수 있다.
- 자동 업데이트, 버전 통제, 로그 수집이 쉬워진다.
- 장시간 상주 프로세스 운영에 유리하다.

### 전제 조건

다만 이 구조는 아래 전제가 충족되어야 한다.

- 공동인증서 및 관련 보안 모듈이 Cloud PC 환경에서 안정적으로 동작해야 한다.
- 해당 대상 사이트의 로그인/조회/수집 흐름이 원격 데스크톱 환경에서 유지되어야 한다.
- 인증서 custody 및 위탁 보관 구조를 계약/정책에서 명확히 정의해야 한다.

### 현재 판단

과거 `npbs-get-data` 구조로 공동인증서 기반 수집이 실제로 안정적으로 동작했던 경험이 있으므로, Cloud PC 전략은 실험적 옵션이 아니라 운영형 메인안으로 검토할 수 있다.

---

## 8. 권장 아키텍처 원칙

본 프로젝트는 기술보다도 설계 원칙이 중요하다.

### 8.1 수집과 서비스 모델 분리

반드시 아래 3단계를 분리한다.

- `raw_*`: 대상 사이트에서 읽어온 원본 데이터
- `normalized_*`: 내부 서비스 기준으로 정규화된 데이터
- `guardian_view_*`: 보호자에게 실제 노출할 데이터

### 8.2 센터 단위 논리 격리

- 모든 주요 테이블에 `partner_center_id` 강제
- 로그, 업로드, 문서, 권한도 센터 단위 필터링
- 향후 필요 시 센터 단위 물리 분리 가능하게 설계

### 8.3 idempotent sync

같은 데이터를 여러 번 수집해도 중복 생성되지 않아야 한다.

### 8.4 selector/version 관리

사이트 구조 변경 대응을 위해 아래 개념을 둔다.

- `crawler_version`
- `parser_version`
- `site_signature_version`

### 8.5 중앙 통제 가능 구조

- heartbeat 수집
- 원격 job 전달
- 강제 업데이트
- kill switch
- 장기 미동기화 알림

### 8.6 fallback 존재

자동화가 실패했을 때를 대비해 최소한 다음 중 하나가 있어야 한다.

- 수동 재시도
- 수동 파일 업로드
- 운영자 원격 개입

---

## 9. 제안 모노레포 구조

```text
ssm-app/
  apps/
    mobile/
    web-protector/
    web-provider/
    web-partner-admin/         # 신규
    api/                       # 기존 확장 또는
    api-partner/               # 필요 시 신규 분리
    crawler-agent/             # 신규 Electron app

  packages/
    db/
    shared/
    ui/
    partner-shared/            # 신규
```

### 권장 설명

- `web-partner-admin`: 센터 관리자 웹
- `crawler-agent`: 설치형 수집 에이전트
- `partner-shared`: 파트너 도메인 DTO, 에러코드, 상태 enum, sync payload 정의

이 구조로 가면 웹/API/에이전트가 동일 타입 체계를 공유할 수 있다.

---

## 10. 설계안 1: 센터별 Cloud PC 기반 전체 아키텍처

### 10.1 목표

- 센터별 안정적인 동기화 환경 확보
- 원격 운영 가능성 확보
- 일반 PC 전원/offline 리스크 최소화

### 10.2 구성

```text
[센터별 전용 Cloud PC]
  ├─ Windows OS
  ├─ 공동인증서/보안모듈
  ├─ crawler-agent (Electron)
  ├─ Playwright browser runtime
  └─ local SQLite / local logs

          │
          │ HTTPS + signed agent auth
          ▼
[Partner API / Sync Server]
  ├─ agent registration
  ├─ heartbeat ingestion
  ├─ job dispatch
  ├─ raw upload
  ├─ normalization pipeline
  ├─ sync history
  └─ alert / monitoring

          │
          ├─ MySQL (normalized domain / guardian-facing domain)
          ├─ raw storage (DB or object storage)
          └─ observability / alerting

          ▼
[web-partner-admin]
  ├─ 센터 관리자
  ├─ 운영 관리자
  └─ 동기화 상태/승인/로그 확인

          ▼
[ssm-app]
  ├─ 보호자 계약 인증 요청
  ├─ 승인 후 계약 정보 조회
  └─ 향후 문서/상담/결제/알림 연동
```

### 10.3 운영 흐름

1. 센터 계약 체결
2. 센터별 Cloud PC 발급/등록
3. crawler-agent 설치 및 초기 설정
4. 최초 로그인/인증서 점검
5. 정기 수집 스케줄 수행
6. 서버 업로드 및 정규화
7. 보호자 계약 인증 요청/승인
8. 보호자 앱에서 본인 데이터 열람

### 10.4 Cloud PC 운영 정책

- 센터별 전용 환경 1대 이상
- persistent desktop 사용
- 자동 로그인/자동 실행 정책
- 재부팅 후 에이전트 자동 재기동
- 운영자 원격 접속 권한 별도 관리
- 인증서 저장 위치/암호 정책 계약서 반영

### 10.5 장점

- 표준화된 환경
- 높은 운영 통제력
- 장애 대응 속도 향상
- 원격 유지보수 용이

### 10.6 리스크

- Cloud PC 비용 누적
- 인증서 custody 책임 명확화 필요
- 특정 사이트 보안모듈 업데이트 이슈
- Cloud PC 장애 시 센터별 영향 발생

### 10.7 보완책

- 센터별 last successful sync 모니터링
- watchdog 및 auto restart
- 긴급 수동 재동기화 기능
- 버전 롤백 및 kill switch

---

## 11. 설계안 2: crawler-agent 상태 머신

### 11.1 목표

크롤러를 단순 스크립트가 아니라, 운영 가능한 상태 기반 에이전트로 설계한다.

### 11.2 상태 정의

```text
UNREGISTERED
  → REGISTERING
  → IDLE
  → PRECHECK
  → AUTHENTICATING
  → CRAWLING
  → UPLOADING
  → NORMALIZING_REQUESTED
  → SUCCESS
  → IDLE

에러 분기:
  PRECHECK_FAILED
  AUTH_FAILED
  CRAWL_FAILED
  UPLOAD_FAILED
  LOCAL_DB_ERROR
  UPDATE_REQUIRED
  BLOCKED
```

### 11.3 상세 상태 설명

#### UNREGISTERED

- 최초 설치 상태
- 기기 등록 전

#### REGISTERING

- 센터와 기기 연결
- device token 발급

#### IDLE

- 대기 상태
- heartbeat 전송
- 스케줄 대기

#### PRECHECK

- 브라우저/보안모듈/네트워크/인증서 존재 확인
- 최근 업데이트 필요 여부 확인

#### AUTHENTICATING

- 대상 사이트 로그인
- 공동인증서 인증

#### CRAWLING

- 지정된 데이터셋 수집
- raw snapshot 기록

#### UPLOADING

- 서버 업로드
- 중복 방지 키 포함

#### NORMALIZING_REQUESTED

- 서버 측 정규화 파이프라인 호출

#### SUCCESS

- 마지막 성공 시각 갱신
- 상태 요약 서버 전송

### 11.4 장애 코드 분류

초기부터 에러코드를 통일해야 한다.

- `AUTH_CERT_NOT_FOUND`
- `AUTH_CERT_EXPIRED`
- `AUTH_SITE_LOGIN_FAILED`
- `SITE_LAYOUT_CHANGED`
- `SITE_POPUP_BLOCKED`
- `NETWORK_UNREACHABLE`
- `UPLOAD_TIMEOUT`
- `LOCAL_SQLITE_CORRUPTED`
- `AGENT_UPDATE_REQUIRED`
- `POLICY_BLOCKED`

### 11.5 상태 머신 운영 규칙

- 동일 job 중복 실행 금지
- 실패 시 error code와 snapshot 저장
- 재시도 횟수 제한
- 치명적 오류는 `BLOCKED`로 전환
- `UPDATE_REQUIRED` 시 강제 업데이트 후 재시도
- 장기 실패 시 운영자 알림

### 11.6 필수 로컬 저장 정보

- 마지막 성공 동기화 시각
- 마지막 실패 사유
- 최근 50~100개 job 이력
- parser/site signature 버전
- 로컬 업로드 대기 큐
- trace/screenshot 경로

### 11.7 중앙 서버와의 상호작용

- heartbeat: 1~5분 주기
- command pull 또는 command poll
- config fetch
- update manifest 확인
- job ack / fail / retry 보고

---

## 12. 설계안 3: `ssm-app` 연동용 DB/API 모델 초안

### 12.1 설계 목표

- 기존 `Member`, `Guardian`, `Ward` 구조와 충돌하지 않게 파트너 도메인 연결
- 보호자 앱에서 본인 계약 데이터만 안전하게 열람 가능하게 구성
- 센터/수급자/보호자 연결을 추적 가능하게 유지

### 12.2 권장 도메인 테이블

#### 파트너 센터

- `partner_center`
  - id
  - business_no
  - center_name
  - center_type
  - status
  - created_at

- `partner_center_user`
  - id
  - partner_center_id
  - member_id nullable 또는 별도 로그인 계정
  - role
  - status

#### 에이전트/동기화

- `partner_agent`
  - id
  - partner_center_id
  - device_code
  - cloud_pc_id
  - crawler_version
  - parser_version
  - last_heartbeat_at
  - last_success_sync_at
  - status

- `partner_sync_job`
  - id
  - partner_center_id
  - agent_id
  - job_type
  - requested_at
  - started_at
  - finished_at
  - status
  - error_code

- `partner_sync_log`
  - id
  - partner_center_id
  - agent_id
  - sync_job_id
  - level
  - message
  - metadata_json

#### raw / normalized

- `partner_raw_contract`
- `partner_raw_schedule`
- `partner_raw_tag`
- `partner_raw_consultation`

- `partner_contract`
- `partner_contract_schedule`
- `partner_contract_tag`
- `partner_contract_consultation`

각 normalized 테이블에는 반드시 다음 축이 들어간다.

- `partner_center_id`
- external source id
- source updated at
- hash/version
- normalized payload

#### 보호자 연결

- `partner_guardian_link_request`
  - id
  - partner_center_id
  - guardian_member_id
  - ward_id nullable
  - request_status
  - requested_at
  - approved_at
  - rejected_at

- `partner_guardian_contract_link`
  - id
  - partner_center_id
  - guardian_member_id
  - ward_id
  - partner_contract_id
  - scope_policy_id
  - status
  - linked_at

#### 노출 정책

- `partner_data_scope_policy`
  - id
  - partner_center_id
  - can_view_contract
  - can_view_schedule
  - can_view_tag
  - can_view_consultation
  - can_view_document

#### 감사 로그

- `partner_audit_log`
  - id
  - actor_type
  - actor_id
  - partner_center_id
  - action_type
  - target_type
  - target_id
  - metadata_json
  - created_at

### 12.3 API 초안

#### 파트너 관리자 웹

- `POST /partner/v1/auth/login`
- `GET /partner/v1/centers/me`
- `GET /partner/v1/link-requests`
- `POST /partner/v1/link-requests/:id/approve`
- `POST /partner/v1/link-requests/:id/reject`
- `GET /partner/v1/agents`
- `GET /partner/v1/sync-jobs`
- `POST /partner/v1/sync-jobs/manual-run`
- `GET /partner/v1/contracts`
- `PATCH /partner/v1/scope-policy`

#### crawler-agent

- `POST /partner/v1/agent/register`
- `POST /partner/v1/agent/heartbeat`
- `GET /partner/v1/agent/config`
- `GET /partner/v1/agent/jobs/next`
- `POST /partner/v1/agent/jobs/:id/start`
- `POST /partner/v1/agent/jobs/:id/success`
- `POST /partner/v1/agent/jobs/:id/fail`
- `POST /partner/v1/agent/upload/raw`
- `GET /partner/v1/agent/update-manifest`

#### 보호자 앱(`ssm-app`)

- `GET /v1/partner/centers/search`
- `POST /v1/partner/link-requests`
- `GET /v1/partner/link-requests/me`
- `GET /v1/partner/contracts/me`
- `GET /v1/partner/contracts/:id/schedules`
- `GET /v1/partner/contracts/:id/tags`
- `GET /v1/partner/contracts/:id/consultations`

### 12.4 권한 원칙

- 보호자는 승인된 계약 연결만 조회 가능
- 센터 관리자는 자기 센터 데이터만 접근 가능
- 운영자는 크로스 센터 관제 가능하되, 민감 데이터 접근은 최소화
- raw 데이터 접근은 운영자/시스템 권한으로 제한

---

## 13. 인증/권한 전략

### 13.1 기존 회원 체계 활용

보호자 앱은 기존 `Member/Guardian/Ward` 구조를 유지한다.

### 13.2 파트너 관리자 계정 전략

두 가지 방식 중 선택 가능하다.

#### 옵션 A

기존 `Member` 테이블을 활용하되 `memberType = PARTNER_ADMIN` 추가

장점:

- 기존 인증 체계 재사용 가능

단점:

- 기존 사용자 도메인과 파트너 운영자 도메인이 섞일 가능성

#### 옵션 B

파트너 운영자 계정을 별도 파트너 도메인 테이블로 관리

장점:

- 법인/운영 계정과 일반 사용자 계정 분리
- 권한 구조 명확

단점:

- 인증 체계가 하나 더 생김

### 현재 제안

MVP는 옵션 A로 갈 수 있지만, 중장기적으로는 옵션 B가 더 깔끔하다. 파트너 운영 계정은 일반 보호자/요양보호사와 성격이 다르기 때문이다.

---

## 14. 운영/관제 설계

운영 관점에서 필수로 갖춰야 할 화면은 다음과 같다.

### 본사 운영자 관제 화면

- 센터별 online/offline 상태
- 마지막 성공 동기화 시각
- 장기 미동기화 센터 목록
- 인증서 만료 예정
- 크롤러 버전 분포
- 최근 실패 유형 통계
- 강제 동기화 실행
- 강제 업데이트 실행

### 센터 관리자 화면

- 계약 인증 요청 목록
- 승인/반려 처리
- 공개 범위 설정
- 마지막 동기화 시간
- 장애 발생 여부

### 필수 알림

- 인증서 만료 예정
- 24시간 이상 미동기화
- 특정 에러 연속 발생
- 강제 업데이트 필요

---

## 15. 개발 단계별 로드맵

## 15.1 1단계 MVP

범위:

- 파트너 관리자 웹 기본 로그인
- 센터 등록/기기 등록
- crawler-agent 설치/등록
- 계약/기본 일정 데이터 수집
- raw → normalized 파이프라인
- 보호자 계약 인증 요청/승인
- 보호자 앱 기본 조회
- heartbeat / sync log / 상태 모니터링

목표:

- 한 개 센터와 한 명 이상의 보호자가 실제로 연결되는 end-to-end 흐름 검증

## 15.2 2단계

- 태그/상담/문서 데이터 확장
- 공개 정책 세분화
- 자동 업데이트 고도화
- 운영 관제 대시보드 강화
- 수동 fallback 도구 추가

## 15.3 3단계

- 결제 연동
- 채팅/문의
- 장애 자가복구 일부 도입
- 품질 모니터링 및 데이터 검증 자동화
- API/서비스 분리 여부 재평가

---

## 16. PoC 권장 범위

정식 개발 전 반드시 아래 PoC를 먼저 수행한다.

### PoC 목표

- Cloud PC에서 공동인증서 기반 로그인/조회 가능 여부 검증
- 장시간 상주 에이전트 안정성 검증
- 대상 사이트 구조 변화 탐지 방식 검증

### PoC 항목

1. 센터 1곳 선정
2. 센터별 전용 Cloud PC 1대 구성
3. 공동인증서 및 보안모듈 설치
4. 대상 사이트 로그인/조회/수집 자동화
5. 1일 이상 스케줄 기반 반복 수집
6. 장애 발생 시 원격 대응 검증
7. raw upload 및 normalized 저장 확인
8. 보호자 앱 연동 mock 또는 최소 화면 검증

### PoC 통과 기준

- 최소 3일 이상 안정 동작
- 인증서 로그인 반복 성공
- 강제 재실행/업데이트 가능
- 실패 시 원인 추적 가능

---

## 17. 주요 리스크와 대응

### 리스크 1. 대상 사이트 정책 변경

대응:

- selector/version 관리
- snapshot 저장
- parser 분리
- 빠른 배포 파이프라인

### 리스크 2. 인증서/보안모듈 이슈

대응:

- PoC 선행
- Cloud PC 표준 이미지 관리
- 만료 알림
- 운영 매뉴얼 문서화

### 리스크 3. 센터별 예외 운영 난립

대응:

- 표준 설치 환경 강제
- 비표준 예외는 제한
- 센터 onboarding 체크리스트 운영

### 리스크 4. raw 데이터 노출 위험

대응:

- guardian-facing view 분리
- scope policy 적용
- audit log 강제

### 리스크 5. 운영 부담 증가

대응:

- 관제 도구 조기 도입
- 자동 업데이트
- error code 체계 통일
- 수동 fallback 정의

---

## 18. 최종 제안

본 프로젝트는 아래 원칙으로 추진하는 것이 가장 적절하다.

### 기술

- 파트너 관리자 웹은 기존 `ssm-app`과 같은 `Next.js + TypeScript + Prisma` 중심으로 구축
- 파트너 도메인은 기존 모노레포 안에서 확장
- 크롤러는 `TypeScript + Playwright + Electron + SQLite`

### 운영

- 센터별 전용 Cloud PC를 메인안으로 채택
- crawler-agent를 단순 스크립트가 아니라 관리형 동기화 에이전트로 운영
- heartbeat, remote config, auto update, kill switch, snapshot을 기본 탑재

### 데이터

- raw / normalized / guardian-facing view를 분리
- 보호자 앱은 정규화된 승인 데이터만 읽게 설계
- 센터/보호자/계약 연결 관계는 독립 도메인으로 관리

### 제품 전략

- `ssm-app`과 파트너스는 별도 제품이 아니라, 하나의 순시미 플랫폼 안의 B2B2C 확장으로 본다.
- 파트너스는 센터 운영을 위한 툴이면서 동시에 보호자 앱 가치를 강화하는 데이터 공급 레이어가 된다.

---

## 19. 다음 액션 아이템

1. Cloud PC 기반 PoC 환경 선정
2. 파트너 도메인 테이블 초안 검토
3. 보호자 계약 인증 UX/정책 검토
4. crawler-agent MVP 범위 확정
5. 인증서 custody 및 위탁 계약 조항 검토
6. 모노레포 앱/패키지 구조 확정

---

이 문서는 현재 분석 기준의 1차 통합 계획안이다. 실제 착수 전에는 법무/운영/보안 검토와 함께 PoC 결과를 반영하여 v2 계획안으로 업데이트하는 것을 전제로 한다.
