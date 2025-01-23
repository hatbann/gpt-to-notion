console.log("ChatGPT 요약 스크립트 실행 중...");

(() => {
  const getChatMessage = () => {
    const storedKeywords =
      (localStorage.getItem("lastKeyword") || "").split(",.") || [];
    const lastIndex =
      parseInt(localStorage.getItem("lastProcessedIndex"), 10) || -1;

    const chatElements = Array.from(document.querySelectorAll(".markdown")); // ChatGPT 응답 요소

    let startIndex = lastIndex;
    for (let i = chatElements.length - 1; i > lastIndex; i--) {
      const text = chatElements[i].innerText.trim();
      if (storedKeywords.some((keyword) => text.includes(keyword))) {
        startIndex = i;
        break;
      }
    }

    const targetMessages =
      startIndex === -1
        ? chatElements.map((el) => el.innerText.trim())
        : chatElements.slice(startIndex + 1).map((el) => el.innerText.trim());

    if (targetMessages.length === 0) {
      console.warn("새로운 메시지가 없습니다.");
    }

    return {
      messages: targetMessages,
      lastindex: chatElements.length - 1,
    };
  };

  // ChatGPT 대화 내용 가져오기
  const messages = getChatMessage();

  chrome.runtime.sendMessage(
    {
      type: "CHAT_MESSAGES",
      data: {
        messages: messages.messages,
        lastindex: messages.lastindex,
      },
    },
    () => {
      console.log("메시지 전송 완료");
    }
  );
})();
