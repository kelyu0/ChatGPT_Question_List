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
          // files: ['content.js']
          func: () => {
            if (window == top) {
              chrome.runtime.onMessage.addListener(function (
                req,
                render,
                sendResponse
              ) {
                switch (req.msg) {
                  case "getQuestionList":
                    const questions = document.querySelectorAll(
                      'div[data-message-author-role="user"]'
                    );
                    let questionList = [];
                    questions.forEach((question, index) => {
                      // 给每个问题元素添加ID，方便后续跳转
                      question.id = `question-${index}`;
                      questionList.push(question.innerText);
                    });
                    sendResponse(questionList);
                    break;

                  case "scrollToQuestion":
                    const id = `question-${req.id}`;
                    const el = document.getElementById(id);
                    if (el) {
                      el.scrollIntoView({
                        behavior: "smooth", //instant
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
                response.forEach((question, index) => {
                  const questionElement = document.createElement("div");
                  questionElement.className = "question";
                  // console.log("question", question);
                  questionElement.innerText =
                    "- " + question.replace(/[\n\r]/g, " "); // 替换换行符为空格
                  questionElement.title = question; // 设置title属性以显示完整内容
                  questionElement.addEventListener("click", () => {
                    chrome.tabs.sendMessage(tabId, {
                      msg: "scrollToQuestion",
                      id: index,
                    });
                  });
                  container.appendChild(questionElement);
                });
              } else {
                container.innerText = "No questions found";
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
