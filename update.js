console.log("ChatGPT 업데이트 스크립트 실행 중...");

const udpateLastMsg = () => {
  const messages = [];
  const chatElements = document.querySelectorAll(".markdown");
  if (chatElements.length === 0) {
    console.warn("ChatGPT 메시지가 없습니다.");
    return;
  }

  // 마지막 메시지 추출
  const lastNode = chatElements[chatElements.length - 1];
  const lastMsg = lastNode.innerText.trim();
  messages.push(lastMsg);
  return {
    messages,
    lastIndex: chatElements.length - 1,
  };
};

const msg = udpateLastMsg();
chrome.runtime.sendMessage(
  {
    type: "LAST_MESSAGES",
    data: {
      messages: msg.messages,
      lastIndex: msg.lastIndex,
    },
  },
  () => {
    console.log("메시지 전송 완료");
  }
);
