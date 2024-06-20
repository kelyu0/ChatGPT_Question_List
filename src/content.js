if (window == top) {
  chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
    switch (req.msg) {
      case "getQuestionList":
        const questions = document.querySelectorAll('div[data-message-author-role="user"]');
        let questionList = [];
        questions.forEach((question, index) => {
          // 给每个问题元素添加ID，方便后续跳转
          question.id = `question-${index}`;
          questionList.push(question.innerText);
        });
        sendResponse(questionList);
        break;

      case "highlightQuestion":
        const id = `question-${req.id}`;
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          highlight(id);
        }
        break;
    }
  });

  const highlight = function (id) {
    const el = document.getElementById(id);
    if (el) {
      const currentOpacity = window.getComputedStyle(el).opacity;
      const currentTransition = window.getComputedStyle(el).webkitTransition;
      const duration = 200;
      let itr = 0;
      el.style.webkitTransitionProperty = "opacity";
      el.style.webkitTransitionDuration = duration + "ms";
      el.style.webkitTransitionTimingFunction = "ease";
      const blink = function () {
        el.style.opacity = (itr % 2 == 0 ? 0 : currentOpacity);
        if (itr < 3) {
          itr++;
          setTimeout(blink, duration);
        } else {
          el.style.webkitTransition = currentTransition;
        }
      };
      blink();
    }
  };
}
