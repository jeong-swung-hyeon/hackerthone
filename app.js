// ===================================================
// 우리 반 담벼락 - Firestore 연동 버전
//
// 메모를 쓰면 Firestore에 저장되고,
// 실시간으로 담벼락에 반영됩니다.
// ===================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp  // 서버 시각을 Firestore Timestamp로 저장하기 위해 필요합니다
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";


// --- Firebase 초기화 ---
const firebaseConfig = {
  apiKey: "AIzaSyAbGi6v-Vf84T8O8pt5S68N459HbslBrIk",
  authDomain: "hackerthone-9549d.firebaseapp.com",
  projectId: "hackerthone-9549d",
  storageBucket: "hackerthone-9549d.firebasestorage.app",
  messagingSenderId: "767570501888",
  appId: "1:767570501888:web:87344ad99d7036c52093e5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// onSnapshot이 채워 주는 현재 메모 목록
let currentMemos = [];

// 로그인한 사용자 (로그인 전에는 null)
let currentUser = null;

// 로그인한 사용자의 역할: "teacher" | "student" | null(로그인 전)
let currentUserRole = null;


// ===================================================
// 데이터를 다루는 함수 세 개
// ===================================================

// 메모를 읽어 옵니다.
// Firestore에서 createdAt 순으로 실시간 구독합니다.
// 데이터가 바뀔 때마다 자동으로 render()를 호출합니다.
function loadMemos() {
  const q = query(collection(db, "memos"), orderBy("createdAt"));

  onSnapshot(q, function (snapshot) {
    currentMemos = snapshot.docs.map(function (d) {
      return { id: d.id, ...d.data() };
    });
    render();
  });
}

// 메모를 새로 씁니다.
// 백엔드 2: "누가 썼는지"(uid)를 함께 저장합니다.
async function addMemo(text) {
  // 5글자 미만, 50글자 이상이면 Firestore에 저장하지 않습니다.
  if (text.length < 5 || text.length >= 50) return;

  // 로그인하지 않았으면 저장하지 않습니다.
  if (!currentUser) return;

  await addDoc(collection(db, "memos"), {
    text: text,
    uid: currentUser.uid,
    // serverTimestamp()를 써야 Firestore 보안 규칙의 timestamp 타입 검사를 통과합니다.
    // Date.now()는 숫자(number)라서 규칙에서 막힙니다.
    createdAt: serverTimestamp()
  });
}

// 메모를 지웁니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
}


// ===================================================
// 로그인 (구글 로그인)
// ===================================================

// 구글 로그인 팝업을 띄웁니다.
function login() {
  signInWithPopup(auth, googleProvider).catch(function (err) {
    console.error("로그인 실패:", err);
  });
}

// 로그아웃합니다.
function logout() {
  signOut(auth);
}

// #userArea에 로그인 버튼 또는 사용자 이름 + 로그아웃 버튼을 그립니다.
function renderUserArea() {
  const userArea = document.getElementById("userArea");
  userArea.innerHTML = "";

  if (currentUser) {
    const name = document.createElement("span");
    name.textContent = currentUser.displayName + "님 ";
    userArea.appendChild(name);

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "로그아웃";
    logoutBtn.addEventListener("click", logout);
    userArea.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "구글로 로그인";
    loginBtn.addEventListener("click", login);
    userArea.appendChild(loginBtn);
  }
}

// 처음 로그인하는 사용자면 역할(role) 문서를 만들어 둡니다.
// 기본은 항상 "student"입니다. "teacher"는 콘솔에서 관리자가 직접 바꿔줘야 합니다.
// (클라이언트가 스스로 teacher를 자처하지 못하도록 보안 규칙에서 막습니다.)
async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { role: "student" });
    return "student";
  }
  return snap.data().role;
}

// 로그인 상태가 바뀔 때마다(로그인/로그아웃) 실행됩니다.
onAuthStateChanged(auth, function (user) {
  currentUser = user;
  renderUserArea();

  if (user) {
    // 교사 권한을 주려면 이 uid로 Firestore users 문서를 만들고 role을 "teacher"로 바꿔주세요.
    console.log("내 uid:", user.uid);
    ensureUserDoc(user).then(function (role) {
      currentUserRole = role;
      render();  // 삭제 버튼이 보일지 여부가 역할에 따라 바뀝니다.
    });
  } else {
    currentUserRole = null;
    render();
  }
});


// ===================================================
// 화면 그리기
// ===================================================

function render() {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  currentMemos.forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  // 삭제 버튼은 교사에게만 보여줍니다. (학생은 규칙상 삭제할 수 없습니다)
  if (currentUserRole === "teacher") {
    const del = document.createElement("button");
    del.textContent = "×";
    del.addEventListener("click", function () {
      deleteMemo(memo.id);
    });
    div.appendChild(del);
  }

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  return div;
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");

// 안내 메시지를 보여주는 요소
const hint = document.getElementById("hint");

input.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const text = input.value.trim();
    if (text === "") return;

    // 로그인하지 않았으면 안내 메시지를 보여주고 저장하지 않습니다.
    if (!currentUser) {
      hint.textContent = "✏️ 메모를 쓰려면 먼저 구글로 로그인해 주세요.";
      return;
    }

    // 5글자 미만이면 안내 메시지를 보여주고 저장하지 않습니다.
    if (text.length < 5) {
      hint.textContent = "✏️ 메모는 5글자 이상 써 주세요. (현재 " + text.length + "글자)";
      return;
    }

    // 50글자 이상이면 안내 메시지를 보여주고 저장하지 않습니다.
    if (text.length >= 50) {
      hint.textContent = "✏️ 메모는 50글자 미만으로 써 주세요. (현재 " + text.length + "글자)";
      return;
    }

    // 5글자 이상이면 안내 메시지를 지우고 저장합니다.
    hint.textContent = "";
    addMemo(text);
    input.value = "";
  }
});


// 앱 시작: 실시간 리스너를 시작합니다
loadMemos();
input.focus();
