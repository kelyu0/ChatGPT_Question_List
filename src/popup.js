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
                      const answer = assistantAnswers[index];
                      if (answer) {
                        answer.id = `answer-${index}`;
                      }
                      pairs.push({
                        question: question.innerText,
                        answer: answer ? answer.innerText.split("\n")[0] : "",
                        questionId: `question-${index}`,
                        answerId: answer ? `answer-${index}` : null,
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
                  questionElement.innerText = `Q: ${pair.question.replace(/[\n\r]/g, " ")}`;
                  // questionElement.innerText = `Q: ${pair.question}`;
                  questionElement.title = pair.question;
                  questionElement.addEventListener("click", () => {
                    chrome.tabs.sendMessage(tabId, {
                      msg: "scrollToElement",
                      id: pair.questionId,
                    });
                  });
                  container.appendChild(questionElement);

                  const answerElement = document.createElement("div");
                  answerElement.className = "answer";
                  answerElement.innerText = `A: ${pair.answer}`;
                  if (pair.answerId) {
                    answerElement.addEventListener("click", () => {
                      chrome.tabs.sendMessage(tabId, {
                        msg: "scrollToElement",
                        id: pair.answerId,
                      });
                    });
                  }
                  container.appendChild(answerElement);
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
