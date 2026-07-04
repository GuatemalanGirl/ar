# Auto Wall AR — GitHub Pages 업로드용

이 버전은 GitHub 웹 업로드에서 문제가 되는 숨김 파일/빈 폴더를 제거한 버전입니다.

## 업로드할 파일

레포 루트에 아래 파일과 폴더만 올리세요.

```text
index.html
style.css
main.js
products.js
README.md
assets/poster-60x90.svg
assets/frame-50x70.svg
```

`engines/` 폴더는 빈 placeholder였기 때문에 업로드하지 않아도 됩니다. `.nojekyll`도 현재 구조에서는 필요 없습니다.

## GitHub Pages 설정

Settings → Pages → Deploy from a branch → main / root

## 주의

이 코드는 Android Chrome 등 WebXR immersive-ar + hit-test 지원 환경에서는 자동 배치를 시도합니다.
iOS Safari는 WebXR을 지원하지 않으므로, 실제 자동 벽면 인식에는 Zappar/Onirix 등 WebAR SDK 연결이 필요합니다.
