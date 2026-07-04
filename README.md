# Web AR Wall MVP - GitHub Pages Static Version

앱 설치 없이 iOS Safari / Android Chrome에서 실행 가능한 정적 웹 MVP입니다.

이 버전은 `npm install`, Vite, 빌드 과정이 필요 없습니다. 파일을 GitHub 저장소에 그대로 올리고 GitHub Pages를 켜면 바로 테스트할 수 있습니다.

## 포함 파일

```text
index.html
style.css
main.js
.nojekyll
README.md
```

## GitHub Pages 배포 방법

1. 새 GitHub repository를 만듭니다.
2. 이 폴더 안의 파일들을 repo 루트에 업로드합니다.
3. GitHub repo에서 `Settings` → `Pages`로 이동합니다.
4. `Build and deployment`에서 `Deploy from a branch`를 선택합니다.
5. Branch는 `main`, folder는 `/root`를 선택합니다.
6. 저장 후 표시되는 `https://사용자명.github.io/레포명/` 주소로 접속합니다.

## 사용 흐름

1. iPhone Safari 또는 Android Chrome에서 GitHub Pages 주소 접속
2. `카메라 시작`
3. `이미지 선택`
4. 실제 가로/세로 cm 입력
5. 벽에 A4 또는 기준물을 붙임
6. 기준물 너비 입력. A4 짧은 변은 21cm
7. `A4/기준물 보정` 클릭
8. 파란 박스 너비를 화면 속 기준물 너비와 맞춤
9. `보정 완료`
10. `벽에 배치` 클릭 후 원하는 위치 터치
11. 드래그/핀치/회전 조정
12. `캡처`

## 주의

- GitHub Pages는 HTTPS라서 모바일 카메라 테스트에 적합합니다.
- 로컬에서 `file://`로 직접 열면 카메라 권한이 막힐 수 있습니다.
- 이 MVP는 iOS 웹 호환을 위해 WebXR이 아니라 `카메라 + 화면 오버레이 + 기준물 보정` 방식입니다.
- 실제 AR anchor처럼 카메라 이동 시 벽에 완전히 고정되는 기능은 WebAR SDK 연결 단계에서 추가해야 합니다.
