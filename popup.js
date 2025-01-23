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

  chrome.storage.local.get(["notionApiKey", "notionDatabaseId"], (result) => {
    if (result.notionApiKey && result.notionDatabaseId) {
      // 키와 ID가 저장된 경우
      displayApiKey.textContent = result.notionApiKey;
      displayDatabaseId.textContent = result.notionDatabaseId;
      savedInfoDiv.style.display = "block"; // 저장된 정보 표시

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            func: () => {
              const lastKeyWord = localStorage.getItem("lastKeyword");
              const lastProcessedIndex =
                localStorage.getItem("lastProcessedIndex");

              return {
                lastKeyWord,
                lastProcessedIndex,
              };
            },
          },
          (results) => {
            if (chrome.runtime.lastError) {
              console.error("스크립트 실행 오류:", chrome.runtime.lastError);
              return;
            }

            const lastKeyword = results[0]?.result.lastKeyWord;
            const lastProcessedIndex = results[0]?.result.lastProcessedIndex;
            if (lastKeyword && lastProcessedIndex) {
              lastChatUpdateBtn.style.display = "none";
              summarizeButton.style.display = "block";
            } else {
              lastChatUpdateBtn.style.display = "block";
            }
          }
        );
      });
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
                const chatMessages = message.data.messages;
                sendResponse({ success: true });

                if (chatMessages.length !== 0) {
                  const summarizedText = await summarizeChatMessages(
                    chatMessages,
                    openaiApiKey,
                    "summarize"
                  );

                  const parsedContent = JSON.parse(summarizedText);
                  const summary = parsedContent.summary; // 요약 문장
                  const keywords = parsedContent.keywords; // 키워드 배열

                  console.log("요약:", summary);
                  console.log("키워드:", keywords);
                  const currentDate = new Date().toISOString();

                  const success = await uploadToNotion(
                    notionApiKey,
                    notionDatabaseId,
                    "ChatGPT 요약",
                    summary,
                    currentDate
                  );

                  if (success) {
                    statusText.textContent = "노션 업로드 성공!";
                    chrome.tabs.query(
                      { active: true, currentWindow: true },
                      (tabs) => {
                        chrome.scripting.executeScript(
                          {
                            target: { tabId: tabs[0].id },
                            func: () => {
                              localStorage.setItem(
                                "lastProcessedIndex",
                                message.data.lastIndex
                              );
                              localStorage.setItem(
                                "lastKeyword",
                                JSON.stringify(message.data.keywords)
                              );
                            },
                          },
                          (results) => {
                            if (chrome.runtime.lastError) {
                              console.error(
                                "스크립트 실행 오류:",
                                chrome.runtime.lastError
                              );
                              return;
                            } else {
                              console.log(
                                "노션 업로드 후 로컬스토리지 업데이트 완료"
                              );
                            }
                          }
                        );
                      }
                    );
                  } else {
                    statusText.textContent = "노션 업로드 실패!";
                  }
                } else {
                  statusText.textContent = "요약할 사항이 없습니다.";
                }
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
  try {
    const totalTokens = contents.reduce(
      (sum, content) => sum + calculateTokens(content),
      0
    );
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
        {
          role: "system",
          content: "너는 요약 전문가이자 키워드 추출 전문가입니다.",
        },
        {
          role: "user",
          content: `
      다음의 두 작업을 수행하세요:
1. "텍스트" 섹션을 요약합니다.
2. "키워드텍스트" 섹션에서만 키워드를 추출합니다.

응답 형식은 순수 JSON으로 제공하세요 (Markdown 코드 블록 없이):
{
  "summary": "텍스트 요약 내용",
  "keywords": ["키워드1", "키워드2", "키워드3"]
}

텍스트:
${summarizeData}

키워드텍스트:
${contents[contents.length - 1]}

        `,
        }
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
    const formattedDate = date.split("T")[0];
    const searchForPage = async (date) => {
      try {
        const response = await fetch(
          `https://api.notion.com/v1/databases/${databaseId}/query`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "Notion-Version": "2022-06-28",
            },
            body: JSON.stringify({
              filter: {
                property: "날짜",
                date: {
                  equals: date,
                },
              },
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Notion API 오류:", errorData);
          return null;
        }

        const data = await response.json();
        return data.results[0]; // 첫 번째 결과 반환 (없으면 null)
      } catch (error) {
        console.error("Notion API 요청 중 오류 발생:", error);
        return null;
      }
    };

    const appendToPage = async (pageId, content) => {
      try {
        const response = await fetch(
          `https://api.notion.com/v1/blocks/${pageId}/children`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "Notion-Version": "2022-06-28",
            },
            body: JSON.stringify({
              children: [
                {
                  object: "block",
                  paragraph: {
                    rich_text: [{ type: "text", text: { content } }],
                  },
                },
              ],
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Notion API 오류:", errorData);
          return;
        }

        console.log("기존 페이지에 내용이 추가되었습니다.");
        return {
          state: "success",
        };
      } catch (error) {
        console.error("Notion API 요청 중 오류 발생:", error);
      }
    };

    const createPage = async (title, content) => {
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
                date: {
                  start: formattedDate,
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

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Notion API 오류:", errorData);
          return;
        }

        const data = await response.json();
        console.log("페이지 생성 성공:", data);
        return {
          state: "success",
        };
      } catch (error) {
        console.error("Notion API 요청 중 오류 발생:", error);
      }
    };

    const manageNotionPage = async (title, content) => {
      const existingPage = await searchForPage(formattedDate);

      if (existingPage) {
        console.log("기존 페이지 발견:", existingPage.id);
        const response = await appendToPage(existingPage.id, content);
        return response.state === "success" ? true : false;
      } else {
        console.log("해당 날짜의 페이지가 없으므로 새로 생성합니다.");
        const response = await createPage(title, content);
        return response.state === "success" ? true : false;
      }
    };

    const success = await manageNotionPage(title, content);
    return success;
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
