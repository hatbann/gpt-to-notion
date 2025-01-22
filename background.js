chrome.runtime.onInstalled.addListener(() => {
  console.log("서비스 워커 실행됨");

  if (request.action === "getStoredData") {
    // 비동기 작업 (스토리지에서 데이터 가져오기)
    chrome.storage.local.get(
      ["lastMessageSummary", "lastProcessedIndex"],
      (result) => {
        sendResponse(result); // 데이터를 content.js로 전송
      }
    );
    return true; // 비동기 응답을 기다리기 위해 true 반환
  }
});
