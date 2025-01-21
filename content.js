console.log("ChatGPT 콘텐츠 스크립트 실행 중...");

const getChatMessage = () => {
  const messages = [];
  const chatElements = document.querySelectorAll(".markdown"); // ChatGPT 응답 요소

  chatElements.forEach((element) => {
    const text = element.innerText.trim();
    messages.push(text);
  });

  return messages;
};

// ChatGPT 대화 내용 가져오기
const messages = getChatMessage();
chrome.runtime.sendMessage({ type: "CHAT_MESSAGES", data: messages }, () => {
  console.log("메시지 전송 완료");
});
