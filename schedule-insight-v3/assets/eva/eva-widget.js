/* ============================================================
   Eva chatbot — widget loader (self-contained copy of the AI
   Dashboard chatbot, AI Dashboard/assets/chatbot.* + qa-*.js).
   Injects the exact widget markup (bubble, overlay, feedback modal)
   into <body>. Must load BEFORE chatbot.js.
   Set window.EVA_ASSET_BASE to this folder's path from the host page
   (default 'assets/eva/').
   ============================================================ */
(function(){
  const B = window.EVA_ASSET_BASE = window.EVA_ASSET_BASE || 'assets/eva/';
  document.body.insertAdjacentHTML('beforeend', `
<!-- AI CHATBOT WIDGET (Eva) -->
<div class="chatbot-widget" id="chatbotWidget">
  <div class="chatbot-container" id="chatbotContainer" title="Ask Eva">
    <i class="bi bi-chat-dots chatbot-bubble-icon"></i>
    <svg class="chatbot-sparkle-badge" viewBox="0 0 24 24" fill="#FFC940">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5Z"/>
    </svg>
  </div>
</div>

<div class="chatbox-overlay" id="chatboxOverlay">
  <div class="eva-sidebar collapsed" id="evaSidebar">
    <div class="eva-sidebar-rail">
      <button class="eva-rail-toggle" id="evaSidebarOpenBtn" title="Open sidebar">
        <img src="${B}finalchatbotpic.png" alt="Eva" class="eva-rail-avatar">
        <i class="bi bi-layout-sidebar eva-rail-toggle-icon"></i>
      </button>
      <button class="eva-rail-btn" id="evaRailNewChat" title="New chat"><i class="bi bi-plus-lg"></i></button>
      <button class="eva-rail-btn" id="evaRailSearch" title="Search questions"><i class="bi bi-search"></i></button>
      <button class="eva-rail-btn eva-fav-btn" id="evaRailFavourites" title="Favourite questions" style="position:relative;" onclick="showFavouritesInSidebar()"><i class="bi bi-star"></i></button>
      <button class="eva-user-chip-collapsed" id="evaUserChipCollapsed" title="Eva">E</button>
    </div>
    <div class="eva-sidebar-expanded">
      <div class="eva-sidebar-header">
        <img src="${B}finalchatbotpic.png" alt="Eva">
        <div>
          <div class="eva-sidebar-header-text">Eva</div>
          <div class="eva-sidebar-header-sub">AI Dashboard Assistant</div>
        </div>
        <button class="eva-sidebar-collapse-btn eva-fav-btn" id="evaHeaderFavourites" title="Favourite questions" style="position:relative;" onclick="showFavouritesInSidebar()"><i class="bi bi-star"></i></button>
        <button class="eva-sidebar-collapse-btn" id="evaSidebarCollapseBtn" title="Close sidebar"><i class="bi bi-layout-sidebar"></i></button>
      </div>
      <button class="eva-new-chat-btn" id="evaNewChatBtn" title="Clear the current conversation and start over">
        <i class="bi bi-plus-lg"></i> New chat
      </button>
      <div class="eva-sidebar-search">
        <i class="bi bi-search"></i>
        <input type="text" id="evaQuestionSearch" placeholder="Search questions...">
      </div>
      <div class="eva-sidebar-sections" id="evaSidebarSections"></div>
      <div class="eva-sidebar-footer" id="evaSidebarFooter">
        <div class="eva-user-menu" id="evaUserMenu">
          <button class="eva-user-menu-item eva-dark-mode-toggle" id="evaDarkModeToggle">
            <i class="bi bi-moon-stars"></i> <span class="eva-dark-mode-label" id="evaDarkModeLabel">Dark mode</span>
          </button>
        </div>
        <button class="eva-user-row" id="evaUserRow">
          <span class="eva-user-avatar">DU</span>
          <span class="eva-user-info">
            <span class="eva-user-email-main">Dashboard User</span>
            <span class="eva-user-email-sub">Signed in</span>
          </span>
          <i class="bi bi-chevron-up eva-user-chevron"></i>
        </button>
      </div>
    </div>
  </div>
  <div class="chatbox-panel" id="chatboxPanel">
    <div class="chatbox-header">
      <div class="chatbox-header-avatar">
        <img src="${B}finalchatbotpic.png" alt="Eva">
      </div>
      <div class="chatbox-header-text">
        <div class="chatbox-header-subtitle">Hey there! I'm Eva</div>
        <div class="chatbox-header-title">Ask me anything about this screen</div>
      </div>
      <div class="chatbox-header-controls">
        <button class="chatbox-ctrl-btn" id="chatboxFavourites" title="Saved Favourites" style="position:relative;" onclick="showFavouritesPanel()"><i class="bi bi-star"></i></button>
        <button class="chatbox-ctrl-btn" id="chatboxClearChat" title="Clear Chat" onclick="clearChat()"><i class="bi bi-arrow-counterclockwise"></i></button>
        <button class="chatbox-ctrl-btn" id="chatboxMaximize" title="Maximize"><i class="bi bi-arrows-angle-expand"></i></button>
        <button class="chatbox-ctrl-btn" id="chatboxClose" title="Close"><i class="bi bi-x-lg"></i></button>
      </div>
    </div>
    <div class="eva-fullscreen-header" id="evaFullscreenHeader">
      <div class="eva-fsh-actions">
        <button class="eva-fsh-btn" id="evaFshNewChat" title="Clear the current conversation and start over"><i class="bi bi-plus-lg"></i> New chat</button>
        <div class="eva-fav-wrap" id="evaFavWrap">
          <button class="eva-fsh-btn eva-fav-btn" id="evaFshFavourites" title="My Favourite" style="position:relative;"><i class="bi bi-star"></i> My Favourite</button>
          <div class="eva-fav-popup" id="evaFavPopup">
            <div class="eva-faq-popup-header">
              <span>FAVOURITE QUESTIONS</span>
              <button class="eva-faq-popup-close" id="evaFavPopupClose" title="Close"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="eva-faq-popup-list" id="evaFavPopupList"></div>
          </div>
        </div>
      </div>
      <div class="eva-fsh-actions">
        <div class="eva-faq-wrap" id="evaFaqWrap">
          <button class="eva-fsh-btn eva-faq-btn" id="evaFaqBtn" title="FAQs"><i class="bi bi-question-circle"></i><span>FAQs</span></button>
          <div class="eva-faq-popup" id="evaFaqPopup">
            <div class="eva-faq-popup-header">
              <span>FAQs</span>
              <button class="eva-faq-popup-close" id="evaFaqPopupClose" title="Close"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="eva-sidebar-search">
              <i class="bi bi-search"></i>
              <input type="text" id="evaFaqSearch" placeholder="Search questions...">
            </div>
            <div class="eva-faq-popup-list" id="evaFaqPopupList"></div>
          </div>
        </div>
        <div class="eva-fsh-user" id="evaFshUser">
          <button class="eva-fsh-avatar-btn" id="evaFshAvatarBtn" title="Account">AL</button>
          <div class="eva-fsh-user-popover" id="evaFshUserPopover">
            <div class="eva-fsh-user-popover-info">
              <span class="eva-fsh-user-popover-avatar">AL</span>
              <span class="eva-fsh-user-popover-text">
                <span class="eva-fsh-user-popover-email">Altametrics</span>
                <span class="eva-fsh-user-popover-sub">Signed in</span>
              </span>
            </div>
            <button class="eva-fsh-user-popover-item eva-dark-mode-toggle" id="evaFshDarkModeToggle">
              <i class="bi bi-moon-stars"></i> <span class="eva-dark-mode-label">Dark mode</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="chatbox-body" id="chatboxBody">
      <div class="chat-msg" id="welcome-msg">
        <div class="chat-msg-avatar">
          <img src="${B}finalchatbotpic.png" alt="Eva">
        </div>
        <div class="welcome-bubble">
          <b>Hi, how can I help you with your dashboards?</b>
        </div>
      </div>
    </div>
    <div class="chatbox-footer">
      <div class="chatbox-input-wrap">
        <input type="text" class="chatbox-input" id="chatboxInput" placeholder="Type your message here...">
        <button class="chatbox-mic-btn" id="chatboxMicBtn" title="Voice input"><i class="bi bi-mic-fill"></i></button>
        <button class="chatbox-send-btn" id="chatboxSendBtn"><i class="bi bi-send-fill"></i></button>
      </div>
      <div class="chatbox-disclaimer">Eva can make mistakes - review information carefully.</div>
    </div>
  </div>
</div>

<!-- Dislike feedback modal -->
<div class="eva-feedback-modal-overlay" id="evaFeedbackModalOverlay">
  <div class="eva-feedback-modal">
    <div class="eva-feedback-modal-header">
      <div class="eva-feedback-modal-icon" id="evaFeedbackModalIcon"><i class="bi bi-hand-thumbs-down-fill"></i></div>
      <div class="eva-feedback-modal-headtext">
        <div class="eva-feedback-modal-title" id="evaFeedbackModalTitle">What went wrong?</div>
        <div class="eva-feedback-modal-subtitle" id="evaFeedbackModalSubtitle">Help Eva give better answers</div>
      </div>
      <button class="eva-feedback-modal-close" id="evaFeedbackModalCloseBtn" title="Close"><i class="bi bi-x-lg"></i></button>
    </div>
    <div class="eva-feedback-modal-body">
      <div id="evaFeedbackStepSelect">
        <div class="eva-feedback-label">Select an issue</div>
        <div class="eva-feedback-options" id="evaFeedbackOptions">
          <button class="eva-feedback-chip" data-issue="Wrong answer">Wrong answer</button>
          <button class="eva-feedback-chip" data-issue="Missing information">Missing information</button>
          <button class="eva-feedback-chip" data-issue="Didn't understand my question">Didn't understand my question</button>
          <button class="eva-feedback-chip" data-issue="Confusing response">Confusing response</button>
          <button class="eva-feedback-chip" data-issue="Incorrect data">Incorrect data</button>
          <button class="eva-feedback-chip" data-issue="Something else">Something else</button>
        </div>
        <div class="eva-feedback-label">Additional notes <span id="evaFeedbackNotesRequired">(optional)</span></div>
        <div class="eva-feedback-textarea-wrap">
          <textarea id="evaFeedbackNotes" maxlength="255" placeholder="Describe the issue in more detail..."></textarea>
          <span class="eva-feedback-char-count" id="evaFeedbackCharCount">0 / 255</span>
        </div>
      </div>
      <div id="evaFeedbackStepSuccess" style="display:none;">
        <div class="eva-feedback-success-row">
          <div class="eva-feedback-success-icon"><i class="bi bi-check-circle"></i></div>
          <div class="eva-feedback-success-text">Your feedback has been noted. Eva will use it to improve the quality and accuracy of future responses.</div>
        </div>
      </div>
    </div>
    <div class="eva-feedback-modal-footer">
      <button class="eva-feedback-send-btn" id="evaFeedbackActionBtn">Send Feedback</button>
    </div>
  </div>
</div>
`);
})();
