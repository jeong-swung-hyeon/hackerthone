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
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


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

// onSnapshot이 채워 주는 현재 메모 목록
let currentMemos = [];


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
// 백엔드 2: 여기에 "누가 썼는지"(uid)를 함께 저장하게 됩니다.
async function addMemo(text) {
  // 5글자 미만이면 Firestore에 저장하지 않습니다.
  if (text.length < 5) return;

  await addDoc(collection(db, "memos"), {
    text: text,
    createdAt: Date.now()
  });
}

// 메모를 지웁니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
}


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

  const del = document.createElement("button");
  del.textContent = "×";
  del.addEventListener("click", function () {
    deleteMemo(memo.id);
  });
  div.appendChild(del);

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

    // 5글자 미만이면 안내 메시지를 보여주고 저장하지 않습니다.
    if (text.length < 5) {
      hint.textContent = "✏️ 메모는 5글자 이상 써 주세요. (현재 " + text.length + "글자)";
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
