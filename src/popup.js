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
                    const userQuestions = document.querySelectorAll(
                      'div[data-message-author-role="user"]'
                    );
                    const assistantAnswers = document.querySelectorAll(
                      'div[data-message-author-role="assistant"]'
                    );

                    let pairs = [];
                    userQuestions.forEach((question, index) => {
                      question.id = `question-${index}`;
                      const hasImage = question.querySelector("img") ? "[image] " : "";
                      const answer = assistantAnswers[index];
                      if (answer) {
                        answer.id = `answer-${index}`;
                      }

                      const headers = Array.from(
                        answer?.querySelectorAll("h1, h2, h3, h4, h5, h6") || []
                      ).map((header, headerIndex) => {
                        const headerId = `answer-${index}-header-${headerIndex}`;
                        header.id = headerId;
                        return {
                          text: header.innerText,
                          level: parseInt(header.tagName[1]),
                          id: headerId,
                        };
                      });

                      pairs.push({
                        question: hasImage + question.innerText.split("\n")[0],
                        answer: answer ? answer.innerText.split("\n")[0] : "No answer available",
                        questionId: `question-${index}`,
                        answerId: answer ? `answer-${index}` : null,
                        headers: headers,
                      });
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
                  const questionElement = document.createElement("div");
                  questionElement.className = "question";
                  questionElement.innerText = `Q: ${pair.question}`;
                  questionElement.title = pair.question;
                  questionElement.addEventListener("click", () => {
                    chrome.tabs.sendMessage(tabId, {
                      msg: "scrollToElement",
                      id: pair.questionId,
                    });
                  });
                  container.appendChild(questionElement);

                  const answerContainer = document.createElement("div");
                  answerContainer.className = "answer";

                  const firstLineElement = document.createElement("div");
                  firstLineElement.innerText = `A: ${pair.answer}`;
                  if (pair.answerId) {
                    firstLineElement.addEventListener("click", () => {
                      chrome.tabs.sendMessage(tabId, {
                        msg: "scrollToElement",
                        id: pair.answerId,
                      });
                    });
                  }
                  answerContainer.appendChild(firstLineElement);

                  pair.headers.forEach((header) => {
                    const headerElement = document.createElement("div");
                    headerElement.style.marginLeft = `${header.level * 20}px`;
                    headerElement.innerText = `H${header.level}: ${header.text}`;
                    headerElement.addEventListener("click", () => {
                      chrome.tabs.sendMessage(tabId, {
                        msg: "scrollToElement",
                        id: header.id,
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
