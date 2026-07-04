# Auto Wall AR — GitHub Pages 정적 버전

이 프로젝트는 수동 4점 보정/수동 스케일 조절을 제거하고, **실제 AR tracking 결과가 있을 때만** 벽면에 이미지를 자동 배치하는 구조입니다.

## 목표 동작

1. 카메라 AR 시작
2. 이미지 선택
3. 벽을 비춤
4. AR 엔진이 벽면 hit-test / pose / 거리 / 각도 계산
5. 이미지가 실제 m 단위 크기로 자동 배치

## 설치 없음

GitHub Pages에 아래 파일을 루트에 올리면 됩니다.

```text
index.html
style.css
main.js
products.js
assets/
.nojekyll
README.md
```

## 현재 지원

### Android Chrome / WebXR 지원 브라우저

`navigator.xr.isSessionSupported('immersive-ar')`가 true인 환경에서 WebXR hit-test를 사용합니다.

- 실제 hit-test pose 사용
- 수직 벽 후보 자동 판정
- 18프레임 안정화 후 자동 배치
- 이미지 크기: `products.js`에 있는 `widthM`, `heightM` 값 사용

### iOS Safari

iOS Safari는 WebXR Device API를 직접 제공하지 않습니다. 따라서 순수 GitHub Pages + JavaScript만으로는 자동 벽면 plane detection / 거리 / anchor 고정을 구현할 수 없습니다.

요구사항을 iOS까지 충족하려면 다음 중 하나가 필요합니다.

- Zappar / Mattercraft
- Onirix
- 기타 iOS Safari world tracking 지원 WebAR SDK
- 또는 App Clip 기반 ARKit 경로

이 레포는 iOS에서 가짜 오버레이를 보여주지 않고, SDK 연결 필요 메시지를 표시합니다.

## 제품 이미지/실제 크기 변경

`products.js`를 수정하세요.

```js
export const PRODUCTS = [
  {
    id: "poster-60x90",
    name: "Poster 60×90",
    imageUrl: "./assets/poster-60x90.svg",
    widthM: 0.60,
    heightM: 0.90
  }
];
```

사용자가 크기를 입력하지 않으려면, 모든 이미지의 실제 크기를 이 파일에 미리 넣어야 합니다.

## 중요

웹-only + iOS + 자동 벽면 계산은 브라우저 기본 API만으로는 불가능합니다. 이 버전은 Android WebXR에서 실제 자동 배치를 구현하고, iOS는 WebAR SDK를 연결해야 하는 구조로 분리해 둔 것입니다.
