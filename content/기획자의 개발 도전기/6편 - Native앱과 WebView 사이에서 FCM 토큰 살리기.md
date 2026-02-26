---
title: "[기획자의 개발 도전기] 6편 - Native앱과 WebView 사이에서 FCM 토큰 살리기"
date: 2026-02-26
tags:
  - 바이브코딩
  - FCM
  - ReactNative
  - WebView
  - 브릿지
---

# Native앱과 WebView 사이에서 FCM 토큰 살리기

## 우리 앱의 특이한 구조

[[5편 - 푸시 알림 시스템, 뜯어보니 구멍투성이였다|이전 편]]에서 백엔드의 푸시 알림 시스템을 고쳤다. 그런데 백엔드만 고쳐서는 절반밖에 안 된다. **FCM 토큰을 서버에 등록하는 건 클라이언트의 일**이기 때문이다.

여기서 우리 앱의 구조를 설명해야 한다. 우리 서비스는 **React Native 앱 안에 WebView를 띄우는 하이브리드 구조**다.

```
┌─────────────────────────────────┐
│  React Native (Expo)            │  ← 네이티브 레이어
│  ├── 푸시 알림 권한 요청          │
│  ├── FCM 토큰 획득/갱신           │
│  ├── 포그라운드 알림 수신          │
│  └── 알림 탭 → 딥링크 처리        │
│                                 │
│  ┌───────────────────────────┐  │
│  │  WebView                  │  │  ← 웹 레이어
│  │  ├── web-protector (보호자)│  │
│  │  └── web-provider (매니저) │  │
│  │       ↕ Bridge 통신        │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

FCM 토큰은 **네이티브**에서만 받을 수 있다. 하지만 서버에 토큰을 등록하는 API 호출은 **웹**(WebView)에서 하고 싶다. 왜냐면 웹에 로그인 상태(JWT)가 있으니까. 네이티브에서 직접 API를 호출하려면 인증 토큰을 네이티브까지 전달해야 하는데, 이건 관리 포인트가 늘어난다.

결국 **네이티브에서 토큰을 받아서 웹에 전달하고, 웹이 서버에 등록하는** 구조가 필요하다. 이게 Bridge다.

## FCM 토큰 라이프사이클 설계

네이티브 레이어(`apps/mobile/app/_layout.tsx`)에서 처리해야 할 일을 정리했다.

### 1. 앱 시작 시 — 토큰 획득

```
앱 시작
  → requestPushPermission() — 사용자에게 알림 권한 요청
  → getFcmToken() — FCM 서버에서 토큰 획득
  → SecureStore에 토큰 저장 — 나중에 웹에서 요청할 때 꺼내 쓸 용도
```

다행히 `utils/pushNotification.ts`에 이 함수들이 이미 구현되어 있었다. `_layout.tsx`의 `useEffect`에서 호출만 추가하면 됐다.

### 2. 토큰 리프레시 — 자동 갱신

FCM 토큰은 영구적이지 않다. Google이 주기적으로 토큰을 만료시키고 새 토큰을 발급하는데, 이걸 리스너로 잡아야 한다.

```
addTokenRefreshListener((newToken) => {
  saveFcmToken(newToken);  // SecureStore 갱신
  // 웹에도 새 토큰 전달 (Bridge)
})
```

토큰이 바뀌면 SecureStore를 갱신하고, 현재 웹뷰가 열려있으면 Bridge를 통해 웹에도 알려준다. 웹이 다시 서버에 등록하는 흐름이다.

### 3. 포그라운드 알림 — 앱이 켜져있을 때

앱을 사용 중일 때(포그라운드) 푸시가 오면 어떻게 할지도 정해야 한다.

```
addNotificationReceivedListener((notification) => {
  // 배지 숫자 갱신
  // 인앱 알림 표시 (토스트, 배너 등)
})
```

### 4. 알림 탭 — 딥링크

사용자가 알림을 탭했을 때 해당 화면으로 이동하는 처리다.

```
addNotificationResponseListener((response) => {
  const data = response.notification.request.content.data;
  // data.type, data.matchingId 등을 활용하여 WebView 라우팅
})
```

## Bridge 통신 — 핵심 흐름

가장 까다로운 부분이 **로그인 성공 후 FCM 토큰을 서버에 등록**하는 흐름이다.

```
[1] 사용자가 웹에서 로그인 성공
     ↓
[2] 웹 → Native: "FCM 토큰 줘"
     window.ReactNativeWebView.postMessage({
       type: 'notification',
       action: 'request_token'
     })
     ↓
[3] Native: SecureStore에서 토큰 조회 → 웹에 응답
     sendToWeb({
       type: 'notification',
       action: 'register_token',
       payload: { token: 'xxx', deviceId: 'yyy' }
     })
     ↓
[4] 웹: 토큰 수신 → 서버 API 호출
     PATCH /v1/fcm/{deviceId}/token
     body: { fcmToken: 'xxx' }
     headers: { Authorization: Bearer {JWT} }
     ↓
[5] 서버: JWT에서 memberId + memberType 자동 추출하여 저장
```

여기서 중요한 건 **프론트에서 별도로 memberType을 보낼 필요가 없다**는 점이다. `web-protector`(보호자 앱)에서 로그인하면 JWT에 `GUARDIAN`이 들어있고, `web-provider`(매니저 앱)에서 로그인하면 `STAFF`가 들어있다. 서버가 JWT를 파싱해서 알아서 판별한다.

이전 편에서 설계한 "1 device = 1 token" 원칙이 여기서 빛을 발한다. 같은 폰에서 보호자로 로그인했다가 매니저로 전환하면, 토큰 레코드의 `memberId`와 `memberType`이 최신 로그인으로 덮어써진다.

## deviceId 전달 문제

Bridge 흐름에서 하나 걸린 게 있었다. `PATCH /v1/fcm/{deviceId}/token` API는 URL에 `deviceId`가 필요한데, 이 deviceId를 웹이 어떻게 아나?

세 가지 방법이 있었다:

1. Native에서 `expo-application` 또는 `expo-device`로 deviceId 획득 → Bridge로 웹에 전달
2. FCM 토큰 응답 시 deviceId도 함께 전달
3. `POST /v1/fcm/check_update` 호출 시 사용했던 deviceId를 SecureStore에서 공유

2번을 선택했다. 토큰 요청 응답에 deviceId를 같이 실어 보내는 게 가장 간단하고, 추가 API 호출이 필요 없다.

## 알림 다이얼로그에 카테고리 탭 추가

백엔드에서 `notificationType` 분류와 필터를 넣었으니, 프론트에서도 이걸 보여줘야 한다.

기존에는 알림 목록이 단일 리스트로만 표시됐다. 여기에 **[전체] [서비스] [마케팅]** 탭을 추가했다.

```
탭 UI:  [전체]  [서비스]  [마케팅]
          ↓
API 호출 시 파라미터만 바꿈:
  - 전체:   pushNotificationType=ALL
  - 서비스: pushNotificationType=SERVICE
  - 마케팅: pushNotificationType=MARKETING
```

5편에서 말했듯이, 백엔드 알림 목록 API가 이미 `pushNotificationType` 파라미터를 지원하고 있었다. 프론트에서 탭 클릭 시 해당 값만 바꿔서 재호출하면 끝이었다. 작업 파일은 보호자 앱(`alarmDialog.tsx`)과 매니저 앱 각각.

응답 데이터 구조는 변경 없이 기존 그대로:

```typescript
{
  appNotificationId: number;
  title: string;
  body: string;
  notificationType: string;  // "SERVICE" | "MARKETING"
  isRead: boolean;
  createdAt: string;
}
```

## 이미 되어 있는 것과 안 되어 있는 것

작업하면서 재미있었던 건, **의외로 준비가 되어 있는 부분이 많았다**는 것이다.

**이미 되어 있던 것:**
- Bridge 메시지 타입 정의 (`packages/bridge/src/types/index.ts`)
- `NotificationMessage` 인터페이스 (`request_permission`, `register_token`, `received` 액션)
- 알림 수신 설정 페이지 (보호자 앱 — 서비스/마케팅 분리 완료)
- 알림 목록 API의 `pushNotificationType` 필터

**안 되어 있던 것:**
- `request_token` 액션 (Bridge에서 토큰을 요청하는 흐름)
- 로그인 성공 후 실제 FCM 토큰 등록 흐름
- 매니저 앱의 알림 수신 설정 페이지
- 포그라운드 알림/토큰 리프레시 리스너 등록

개발의 아이러니다. 타입 정의와 API는 만들어놨는데 정작 연결하는 코드가 빠져있었다. 부품은 다 있는데 조립이 안 된 상태라고 할까. 이런 상황에서 기획자 출신이 강점을 발휘한다. 전체 흐름을 머릿속에 그릴 수 있으니까, 어느 부품이 빠졌는지 금방 보인다.

## 이번 편을 마치며

이번 작업에서 가장 어려웠던 건 코드 자체가 아니라 **흐름을 이해하는 것**이었다. 네이티브에서 토큰을 받고, Bridge로 웹에 전달하고, 웹이 서버에 등록하는 이 3단 흐름을 머릿속에 그리는 데 시간이 꽤 걸렸다.

기획서에서는 "로그인하면 푸시 토큰 등록" 한 줄이다. 근데 실제로는 네이티브 권한 요청 → FCM 토큰 획득 → SecureStore 저장 → Bridge 메시지 → 웹에서 API 호출 → 서버에서 JWT 파싱 → DB 저장이라는 7단계 여정이다. 한 줄짜리 기획이 7단계 구현이 되는 경험은 아무리 해도 익숙해지지 않는다.

다음 편에서는 이 시리즈의 마지막으로, 카카오 알림톡 26개 템플릿을 비즈뿌리오를 통해 서비스에 심은 이야기를 해보겠다.

---

> **이전 편**: [[5편 - 푸시 알림 시스템, 뜯어보니 구멍투성이였다]]
> **다음 편**: [[7편 - 카카오 알림톡 26개 템플릿을 14개 API에 심다]]
