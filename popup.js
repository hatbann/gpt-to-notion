document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("notionApiKey");
  const databaseIdInput = document.getElementById("notionDatabaseId");
  const openAiApiKeyInput = document.getElementById("openaiApiKey");
  const saveButton = document.getElementById("saveKeys");
  const summarizeButton = document.getElementById("summarize");
  const lastChatUpdateBtn = document.getElementById("lastChatUpdate");
  const statusText = document.getElementById("status");

  const settingsDiv = document.getElementById("settings");
  const savedInfoDiv = document.getElementById("savedInfo");
  const displayApiKey = document.getElementById("displayApiKey");
  const displayDatabaseId = document.getElementById("displayDatabaseId");

  // 저장된 API Key와 Database ID를 불러오기
  chrome.storage.local.get(["notionApiKey", "notionDatabaseId"], (result) => {
    if (result.notionApiKey && result.notionDatabaseId) {
      // 키와 ID가 저장된 경우
      displayApiKey.textContent = result.notionApiKey;
      displayDatabaseId.textContent = result.notionDatabaseId;
      savedInfoDiv.style.display = "block"; // 저장된 정보 표시
      lastChatUpdateBtn.style.display = "block"; // 마지막 내용 업데이트 버튼 활성화
    } else {
      // 키와 ID가 없는 경우
      settingsDiv.style.display = "block"; // 입력 필드와 저장 버튼 표시
    }
  });

  // API Key와 Database ID 저장
  saveButton.addEventListener("click", () => {
    const notionApiKey = apiKeyInput.value.trim();
    const notionDatabaseId = databaseIdInput.value.trim();
    const openaiApiKey = openAiApiKeyInput.value.trim();

    if (!notionApiKey || !notionDatabaseId || !openaiApiKey) {
      statusText.textContent = "API 키와 데이터베이스 ID를 모두 입력하세요.";
      return;
    }

    chrome.storage.local.set(
      { notionApiKey, notionDatabaseId, openaiApiKey },
      () => {
        statusText.textContent = "API 키와 데이터베이스 ID가 저장되었습니다!";
        location.reload(); // 저장 후 UI 갱신
      }
    );
  });

  lastChatUpdateBtn.addEventListener("click", async () => {
    chrome.storage.local.get(["openaiApiKey"], async (keys) => {
      const openaiApiKey = keys.openaiApiKey;

      if (!openaiApiKey) {
        statusText.textContent = "OPENAI API Key가 없습니다.";
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && activeTab.url.includes("chatgpt.com")) {
          // 콘텐츠 스크립트에 메시지 전송
          chrome.scripting.executeScript(
            {
              target: { tabId: activeTab.id },
              files: ["update.js"],
            },
            () => {
              console.log("로드 스크립트 실행 완료");
            }
          );
        } else {
          alert("ChatGPT 페이지에서만 작동합니다.");
        }
      });

      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "LAST_MESSAGES") {
          let keywords;
          let lastIndex;

          async function summarize() {
            const chatMessages = message.data.messages;
            lastIndex = message.data.lastIndex;
            sendResponse({ success: true });

            const keywordText = await summarizeChatMessages(
              chatMessages,
              openaiApiKey,
              "keyword"
            );

            keywords = keywordText;
          }

          summarize().then(() => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: saveToBrowserLocalStorage,
                args: ["lastKeyword", keywords], // key와 value 전달
              });

              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: saveToBrowserLocalStorage,
                args: ["lastProcessedIndex", lastIndex], // key와 value 전달
              });
            });
          });
        }
      });
    });

    summarizeButton.style.display = "block"; // 요약 버튼 활성화
    lastChatUpdateBtn.style.display = "none";
  });

  // 요약 버튼 클릭 시 동작
  summarizeButton.addEventListener("click", async () => {
    statusText.textContent = "요약 중...";

    console.log("요약버튼 눌림");

    chrome.storage.local.get(
      ["notionApiKey", "notionDatabaseId", "openaiApiKey"],
      async (keys) => {
        const notionApiKey = keys.notionApiKey;
        const notionDatabaseId = keys.notionDatabaseId;
        const openaiApiKey = keys.openaiApiKey;

        if (!notionApiKey || !notionDatabaseId || !openaiApiKey) {
          statusText.textContent = "API 키와 데이터베이스 ID가 없습니다.";
          return;
        }

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const activeTab = tabs[0];
          if (activeTab && activeTab.url.includes("chatgpt.com")) {
            // 콘텐츠 스크립트에 메시지 전송
            chrome.scripting.executeScript(
              {
                target: { tabId: activeTab.id },
                files: ["content.js"],
              },
              () => {
                console.log("콘텐츠 스크립트 실행 완료");
              }
            );
          } else {
            alert("ChatGPT 페이지에서만 작동합니다.");
          }
        });

        chrome.runtime.onMessage.addListener(
          (message, sender, sendResponse) => {
            if (message.type === "CHAT_MESSAGES") {
              async function summarize() {
                const chatMessages = message.data;
                sendResponse({ success: true });

                console.log(chatMessages);

                /*             const summarizedText = await summarizeChatMessages(
                  chatMessages,
                  openaiApiKey,
                  "summarize"
                );
                 */

                const currentDate = new Date().toISOString();

                /*                 const success = await uploadToNotion(
                  notionApiKey,
                  notionDatabaseId,
                  "ChatGPT 요약",
                  summarizedText,
                  currentDate
                );

                statusText.textContent = success
                  ? "노션 업로드 성공!"
                  : "노션 업로드 실패!"; */
              }

              summarize();
            }
          }
        );
      }
    );
  });
});

// 대화 내용 요약 함수
async function summarizeChatMessages(contents, apiKey, type) {
  const MAX_TOKENS = 4096; // gpt-3.5-turbo 컨텍스트 길이 제한
  console.log(contents);
  try {
    const totalTokens = contents.reduce(
      (sum, content) => sum + calculateTokens(content),
      0
    );
    console.log(`messages : ${contents}`);
    console.log(`token : ${totalTokens}`);
    let summarizeData;
    if (totalTokens > MAX_TOKENS) {
      console.warn("토큰 수 초과. 메시지를 더 줄이세요.");
      summarizeData = messages.slice(0, 10);
      console.log(
        summarizeData.reduce(
          (sum, message) => sum + calculateTokens(message),
          0
        )
      );
    } else {
      summarizeData = contents;
    }

    const messages = [];
    if (type === "keyword") {
      messages.push(
        {
          role: "system",
          content:
            "너는 전문적인 요약 도구이며, 키워드 중심으로 정보를 간결하게 요약합니다.",
        },
        {
          role: "user",
          content: `다음 대화 내용을 키워드 단위로 요약해 주세요:
- 주요 주제와 관련 키워드만 나열
- 각 키워드를 쉼표(,)로 구분
- 불필요한 설명은 제외

대화 내용:\n${summarizeData}`,
        }
      );
    } else {
      messages.push(
        { role: "system", content: "너는 요약 전문가입니다." },
        { role: "user", content: `요약해 주세요:\n${summarizeData}` }
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`, // OpenAI API 키 필요
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: messages,
      }),
    });

    if (!response.ok) {
      const errorDetails = await response.json();
      console.error("API 요청 실패:", errorDetails);
    }

    const data = await response.json();

    return data.choices[0]?.message?.content || "요약 실패";
  } catch (error) {
    console.error("요약 실패:", error);
    return "요약 실패";
  }
}

// 노션 업로드 함수
async function uploadToNotion(apiKey, databaseId, title, content, date) {
  try {
    const response = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          제목: {
            title: [
              {
                text: { content: title },
              },
            ],
          },
          날짜: {
            // 날짜 열 추가
            date: {
              start: date, // 시작 날짜 (현재 날짜)
            },
          },
        },
        children: [
          {
            object: "block",
            heading_2: {
              rich_text: [
                { type: "text", text: { content: `${date}의 요약` } },
              ],
            },
          },
          {
            object: "block",
            paragraph: {
              rich_text: [{ type: "text", text: { content } }],
            },
          },
        ],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("노션 업로드 실패:", error);
    return false;
  }
}

function calculateTokens(text) {
  return text.split(" ").length; // 공백 기준으로 나눔 (단순화)
}

function saveToBrowserLocalStorage(key, value) {
  localStorage.setItem(key, value);
  console.log(`브라우저 localStorage에 저장: ${key} = ${value}`);
}
