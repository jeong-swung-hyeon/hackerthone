// ===================================================
// Gemini에게 물어보는 서버 코드
//
// 왜 서버가 필요한가요?
//   API 키를 브라우저 코드(app.js)에 적으면 누구나 볼 수 있습니다.
//   그래서 키는 서버에만 두고, 브라우저는 이 주소로 부탁만 합니다.
//
// 왜 Firebase Functions가 아니라 여기인가요?
//   Firebase Functions는 유료 요금제(Blaze)라야 씁니다.
//   이 프로젝트는 무료 요금제(Spark)로 진행하므로,
//   서버가 필요한 일은 Vercel의 무료 함수로 처리합니다.
//
// 이 파일의 규칙
//   api 폴더 안의 파일은 Vercel에서 자동으로 서버 주소가 됩니다.
//   이 파일은 /api/gemini 주소가 됩니다.
//   API 키는 코드에 적지 말고 Vercel 환경변수에 넣습니다. (process.env 로 꺼내 씁니다)
//
// 모델은 무료 API 키로 쓸 수 있는 Gemini Flash를 씁니다.
// "gemini-flash-latest"는 버전 번호 대신 쓰는 별칭이라,
// Google이 Flash 모델을 새 버전으로 바꿔도 이 코드를 고칠 필요가 없습니다.
// ===================================================

const MODEL = "gemini-flash-latest";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST 요청만 받습니다." });
    return;
  }

  // 개인정보 보호: uid·이메일 같은 식별 정보는 절대 여기로 보내지 않습니다.
  // (프론트엔드에서도 text만 보내야 합니다)
  const text = req.body && req.body.text;

  if (typeof text !== "string" || text.trim() === "") {
    res.status(400).json({ error: "text가 필요합니다." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "서버에 GEMINI_API_KEY가 설정되어 있지 않습니다." });
    return;
  }

  const prompt =
    "너는 초등학교/중학교 담임 선생님을 돕는 다정한 조수야. " +
    "아래는 학급 담벼락에 학생이 남긴 메모야. " +
    "이 메모에 대해 짧고 따뜻한 격려 댓글을 한국어로 1~2문장만 남겨줘. " +
    "이모지는 1개까지만 써도 좋아.\n\n" +
    "메모: " + text;

  try {
    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
        MODEL +
        ":generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error("Gemini API 오류:", data);
      // TODO: 원인 확인 후 detail 필드는 지울 것
      res.status(502).json({ error: "AI 코멘트를 가져오지 못했습니다.", detail: data });
      return;
    }

    const comment =
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!comment) {
      // TODO: 원인 확인 후 detail 필드는 지울 것
      res.status(502).json({ error: "AI 코멘트를 가져오지 못했습니다.", detail: data });
      return;
    }

    res.status(200).json({ comment: comment.trim() });
  } catch (err) {
    console.error("Gemini 호출 실패:", err);
    // TODO: 원인 확인 후 detail 필드는 지울 것
    res.status(500).json({ error: "AI 코멘트를 가져오는 중 오류가 발생했습니다.", detail: String(err) });
  }
}
