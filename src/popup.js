document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("question-container");

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const tabId = tab.id;
    const url = tab.url;

    if (url.startsWith("https://chatgpt.com/")) {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabId },
          func: () => {
            if (window === top) {
              chrome.runtime.onMessage.addListener(function (
                req,
                render,
                sendResponse
              ) {
                switch (req.msg) {
                  case "getQuestionList":
                    const userQuestions = document.querySelectorAll(
                      'div[data-message-author-role="user"]'
                    );
                    const assistantAnswers = document.querySelectorAll(
                      'div[data-message-author-role="assistant"]'
                    );

                    let pairs = [];
                    for (let i = 0; i < userQuestions.length; i++) {
                      const question = userQuestions[i]?.innerText || "";

                      const answerElement = assistantAnswers[i];
                      const answerFirstLine = answerElement
                        ? answerElement.innerText.split("\n")[0].slice(0, 50) + (answerElement.innerText.length > 50 ? "..." : "")
                        : "";

                      const headers = Array.from(
                        answerElement?.querySelectorAll("h1, h2, h3, h4, h5, h6") || []
                      ).map((header) => ({
                        text: header.innerText,
                        level: parseInt(header.tagName[1]), // Extract header level (e.g., 1 for h1)
                      }));

                      pairs.push({ question, answerFirstLine, headers, questionElementId: `user-${i}`, answerElementId: `answer-${i}` });
                    }

                    sendResponse(pairs);
                    break;

                  case "scrollToElement":
                    const id = req.id;
                    const el = document.getElementById(id);
                    if (el) {
                      el.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                    }
                    break;
                }
              });
            }
          },
        },
        () => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
            return;
          }

          // 内容脚本注入成功后，再发送消息
          chrome.tabs.sendMessage(
            tabId,
            { msg: "getQuestionList" },
            (response) => {
              if (response && response.length > 0) {
                response.forEach((pair, index) => {
                  // Display user question
                  const questionElement = document.createElement("div");
                  questionElement.className = "question";
                  questionElement.innerText = `Q: ${pair.question.replace(/\n/g, " ")}`;
                  questionElement.title = pair.question;
                  questionElement.id = pair.questionElementId;
                  questionElement.addEventListener("click", () => {
                    chrome.tabs.sendMessage(tabId, {
                      msg: "scrollToElement",
                      id: pair.questionElementId,
                    });
                  });
                  container.appendChild(questionElement);

                  // Display assistant answers
                  const answerContainer = document.createElement("div");
                  answerContainer.className = "answer";
                  answerContainer.id = pair.answerElementId;

                  // First line of the answer
                  const firstLineElement = document.createElement("div");
                  firstLineElement.innerText = `A: ${pair.answerFirstLine}`;
                  firstLineElement.addEventListener("click", () => {
                    chrome.tabs.sendMessage(tabId, {
                      msg: "scrollToElement",
                      id: pair.answerElementId,
                    });
                  });
                  answerContainer.appendChild(firstLineElement);

                  // Headers
                  pair.headers.forEach((header) => {
                    const headerElement = document.createElement("div");
                    headerElement.style.marginLeft = `${header.level * 20}px`;
                    headerElement.innerText = `H${header.level}: ${header.text}`;
                    headerElement.addEventListener("click", () => {
                      chrome.tabs.sendMessage(tabId, {
                        msg: "scrollToElement",
                        id: pair.answerElementId,
                      });
                    });
                    answerContainer.appendChild(headerElement);
                  });

                  container.appendChild(answerContainer);
                });
              } else {
                container.innerText = "No questions or answers found";
              }
            }
          );
        }
      );
    } else {
      container.innerText = "This extension only works on chatgpt.com";
    }
  });
});
