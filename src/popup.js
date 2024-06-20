document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('question-container');

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const tabId = tab.id;
    const url = tab.url;

    if (url.startsWith("https://chatgpt.com/")) {
      // 向当前选项卡注入内容脚本（如果尚未注入）
      chrome.scripting.executeScript(
        {
          target: { tabId: tabId },
          files: ['content.js']
        },
        () => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
            return;
          }

          // 内容脚本注入成功后，再发送消息
          chrome.tabs.sendMessage(tabId, { msg: "getQuestionList" }, (response) => {
            if (response && response.length > 0) {
              response.forEach((question, index) => {
                const questionElement = document.createElement('div');
                questionElement.className = 'question';
                questionElement.innerText = '- '+question.replace(/\n/g, ' '); // 替换换行符为空格
                questionElement.title = question; // 设置title属性以显示完整内容
                questionElement.addEventListener('click', () => {
                  chrome.tabs.sendMessage(tabId, { msg: "highlightQuestion", id: index });
                });
                container.appendChild(questionElement);
              });
            } else {
              container.innerText = 'No questions found';
            }
          });
        }
      );
    } else {
      container.innerText = 'This extension only works on chatgpt.com';
    }
  });
});
