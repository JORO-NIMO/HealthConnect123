const SupportChatService = require('../services/supportChat.service');
const { sendSuccess, sendError } = require('../utils/response.util');

exports.chat = async (req, res, next) => {
  try {
    const { message, history, pageContext } = req.body || {};

    if (typeof message !== 'string' || !message.trim()) {
      return sendError(res, 400, 'Message is required.');
    }

    if (message.trim().length > 1500) {
      return sendError(res, 400, 'Message is too long. Maximum length is 1500 characters.');
    }

    if (history !== undefined && !Array.isArray(history)) {
      return sendError(res, 400, 'History must be an array when provided.');
    }

    const result = await SupportChatService.answerPlatformQuestion({
      message: message.trim(),
      history: Array.isArray(history) ? history : [],
      userContext: req.user || null,
      pageContext: pageContext && typeof pageContext === 'object' ? pageContext : {},
    });

    return sendSuccess(res, 200, 'Support assistant response generated.', {
      reply: result.answer,
      suggestedActions: result.suggestedActions || [],
      needsHumanSupport: !!result.needsHumanSupport,
      category: result.category || 'general',
      role: result.role || (req.user?.role || 'anonymous'),
      source: result.source || 'fallback',
    });
  } catch (err) {
    next(err);
  }
};
