# Web AR Wall Plane MVP - GitHub Pages 정적 버전

앱 설치 없이 iOS Safari / Android Chrome에서 테스트할 수 있는 정적 웹 MVP입니다.

## 사용 방법

1. 이 폴더의 파일을 GitHub repo 루트에 업로드합니다.
2. GitHub Settings → Pages → Deploy from a branch → main / root 로 설정합니다.
3. Pages URL을 모바일 브라우저에서 엽니다.
4. 순서대로 진행합니다.

```text
카메라 → 이미지 → 크기 → 벽면 → 배치
```

## 벽면 보정 방식

이 버전은 자동 SLAM/WebXR plane detection이 아닙니다. iOS 웹만으로 동작해야 하므로, 사용자가 직접 벽에 붙인 기준 사각형의 네 모서리를 찍어 homography를 계산합니다.

추천 기준물:

- A4 용지: 21cm × 29.7cm
- 정사각 QR/마커: 예: 10cm × 10cm
- 실제 크기를 알고 있는 액자/포스터/타일

모서리 입력 순서:

```text
좌상 → 우상 → 우하 → 좌하
```

4점을 찍으면 앱이 다음을 계산합니다.

- 벽면 원근 보정
- 벽면 내 좌표계
- 실제 cm 기준 이미지 크기
- 화면상 기울기
- 카메라 intrinsics를 60도 FOV로 가정한 대략적인 벽면 각도

## 한계

- iOS Safari는 WebXR plane detection을 직접 제공하지 않으므로 완전 자동 벽 인식은 아닙니다.
- 카메라 내부 파라미터가 웹에서 정확히 제공되지 않아 벽면 각도는 근사값입니다.
- 기준 사각형을 크게 찍을수록 정확도가 좋아집니다.

## 파일 구조

```text
index.html
style.css
main.js
.nojekyll
README.md
```
