# GitHub 새 프로젝트 업로드 방법

현재 이 프로젝트는 `origin`이 `https://github.com/sogwon/CloudBase-nodejs.git`로 설정되어 있습니다.  
**새로운** GitHub 저장소로 업로드하려면 아래 순서대로 진행하세요.

---

## 1단계: GitHub에서 새 저장소 만들기

1. **https://github.com/new** 접속
2. **Repository name**: 원하는 이름 입력 (예: `nodejs-login`)
3. **Public** 선택
4. **"Add a README file"** 체크 해제 (이미 로컬에 코드가 있음)
5. **Create repository** 클릭

---

## 2단계: 새 저장소 URL 확인

생성 후 나오는 저장소 URL을 복사합니다.

- 예: `https://github.com/사용자명/nodejs-login.git`

---

## 3단계: 터미널에서 푸시

아래 명령어에서 **`NEW_REPO_URL`**를 2단계에서 복사한 URL로 바꾼 뒤 실행하세요.

```bash
cd /Users/pumila-1/Cursor/nodejs-login

# 새 원격 추가 (기존 origin은 그대로 두고)
git remote add new-origin NEW_REPO_URL

# 새 저장소로 푸시
git push -u new-origin main
```

**예시** (저장소 이름이 `nodejs-login`이고 사용자명이 `sogwon`인 경우):

```bash
git remote add new-origin https://github.com/sogwon/nodejs-login.git
git push -u new-origin main
```

---

## (선택) 기존 origin을 새 저장소로 바꾸고 싶다면

```bash
git remote remove origin
git remote add origin NEW_REPO_URL
git push -u origin main
```

이렇게 하면 앞으로 `git push`만 해도 새 저장소로 올라갑니다.
