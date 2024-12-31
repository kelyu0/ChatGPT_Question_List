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
            if (window == top) {
              chrome.runtime.onMessage.addListener(function (
                req,
                render,
                sendResponse
              ) {
                switch (req.msg) {
                  case "getQuestionList":
                    const articles = document.querySelectorAll("article");

                    let pairs = [];

                    articles.forEach((article, index) => {
                      const userQuestion = article.querySelector('div[data-message-author-role="user"]');
                      const assistantAnswers = article.querySelectorAll('div[data-message-author-role="assistant"]');

                      if (userQuestion) {
                        // This article contains a user question
                        userQuestion.id = `question-${index}`;
                        const hasImage = userQuestion.querySelector("img") ? "[image] " : "";

                        pairs.push({
                          question: hasImage + userQuestion.innerText.trim().replace(/[\n\r]/g, " "),
                          answers: [],
                          questionId: `question-${index}`,
                          headers: [],
                        });
                      } else if (assistantAnswers.length > 0) {
                        // This article contains assistant answers
                        let answers = [];
                        let headers = [];

                        assistantAnswers.forEach((answer, answerIndex) => {
                          answer.id = `answer-${index}-${answerIndex}`;
                          answers.push({
                            // text: answer.innerText.trim() || "No content available",
                            text: answer.innerText.trim().replace(/[\n\r]/g, " ") || "No content available",
                            id: `answer-${index}-${answerIndex}`,
                          });

                          headers = headers.concat(
                            Array.from(
                              answer.querySelectorAll("h1, h2, h3, h4, h5, h6") || []
                            ).map((header, headerIndex) => {
                              const headerId = `answer-${index}-${answerIndex}-header-${headerIndex}`;
                              header.id = headerId;
                              return {
                                text: header.innerText,
                                level: parseInt(header.tagName[1]),
                                id: headerId,
                              };
                            })
                          );
                        });

                        const maxHeaderLevel = headers.length > 0 ? Math.min(...headers.map(h => h.level)) : null;

                        pairs.push({
                          question: null,
                          answers: answers,
                          questionId: null,
                          headers: headers,
                          maxHeaderLevel: maxHeaderLevel,
                        });
                      }
                    });

                    sendResponse(pairs);
                    break;

                  case "scrollToElement":
                    const el = document.getElementById(req.id);
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

          chrome.tabs.sendMessage(
            tabId,
            { msg: "getQuestionList" },
            (response) => {
              if (response && response.length > 0) {
                response.forEach((pair, index) => {
                  if (pair.question) {
                    const questionElement = document.createElement("div");
                    questionElement.className = "question oneline";
                    questionElement.innerText = `Q: ${pair.question}`;
                    questionElement.title = pair.question;
                    questionElement.addEventListener("click", () => {
                      chrome.tabs.sendMessage(tabId, {
                        msg: "scrollToElement",
                        id: pair.questionId,
                      });
                    });
                    container.appendChild(questionElement);
                  }

                  if (pair.answers.length > 0) {
                    const answerContainer = document.createElement("div");
                    answerContainer.className = "answer oneline";

                    pair.answers.forEach((answer) => {
                      const answerElement = document.createElement("div");
                      answerElement.innerText = `A: ${answer.text}`;
                      answerElement.addEventListener("click", () => {
                        chrome.tabs.sendMessage(tabId, {
                          msg: "scrollToElement",
                          id: answer.id,
                        });
                      });
                      answerContainer.appendChild(answerElement);
                    });

                    pair.headers.forEach((header) => {
                      const headerElement = document.createElement("div");
                      const indentLevel = pair.maxHeaderLevel ? header.level - pair.maxHeaderLevel : header.level - 1;
                      headerElement.style.marginLeft = `${Math.max(0, indentLevel) * 20}px`;
                      headerElement.innerText = `H${header.level}: ${header.text}`.replace(/[\n\r]/g, " ");
                      headerElement.className = "oneline";
                      headerElement.addEventListener("click", () => {
                        chrome.tabs.sendMessage(tabId, {
                          msg: "scrollToElement",
                          id: header.id,
                        });
                      });
                      answerContainer.appendChild(headerElement);
                    });

                    container.appendChild(answerContainer);
                  }
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
