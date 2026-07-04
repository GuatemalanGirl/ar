# Web AR Wall MVP - Fullscreen Static Version

앱 설치 없이 GitHub Pages에서 바로 테스트하는 정적 웹 MVP입니다.

## 파일 구성

```text
index.html
style.css
main.js
.nojekyll
README.md
```

설치, npm, build가 필요 없습니다.

## GitHub Pages 배포

1. 이 폴더 안의 파일들을 GitHub repository 루트에 업로드합니다.
2. GitHub repository에서 `Settings > Pages`로 이동합니다.
3. `Deploy from a branch`를 선택합니다.
4. Branch는 `main`, Folder는 `/root`로 설정합니다.
5. 배포 주소로 접속합니다.

일반 repository 주소 형식:

```text
https://깃허브아이디.github.io/레포명/
```

## 사용법

1. `카메라` 버튼을 누릅니다.
2. `이미지` 버튼으로 벽에 올릴 이미지를 선택합니다.
3. 필요하면 `크기` 버튼으로 실제 가로/세로 cm를 입력합니다. 기본값은 60 × 90cm입니다.
4. 정확한 크기 보정이 필요하면 `보정` 버튼을 누르고, A4 같은 기준물 너비를 입력합니다.
5. 파란 박스를 기준물 너비에 맞춘 뒤 `완료`를 누릅니다.
6. `배치` 버튼을 누르고 벽의 원하는 위치를 터치합니다.
7. 이미지를 드래그하거나 두 손가락 핀치로 크기를 조정합니다.
8. `↺`, `↻` 버튼으로 회전합니다.
9. `캡처` 버튼으로 결과 이미지를 저장합니다.

## 현재 MVP의 한계

이 버전은 iOS/Android 브라우저에서 바로 동작하는 보정형 MVP입니다. 네이티브 ARKit/WebXR처럼 실제 벽 plane anchor에 고정하는 방식은 아닙니다. 앱 없이 웹만으로 iOS까지 지원하기 위한 초기 검증용 버전입니다.
