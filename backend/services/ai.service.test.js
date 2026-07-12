// Mock the logger so tests don't spam the console or try to write files
jest.mock('../utils/logger.util', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}));

describe('AI Service Fallback Tests', () => {
  let aiService;
  let mockOpenAIObject;
  let mockOpenAIModule;
  let logger;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    logger = require('../utils/logger.util');

    // Setup mock openai object
    mockOpenAIObject = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };

    // By default, mock the module config
    jest.mock('../config/openai', () => ({
      openai: mockOpenAIObject,
      AI_CONFIG: {
        provider: 'openai',
        model: 'gpt-4-turbo-preview',
        maxTokens: 2000,
        temperature: 0.3,
      },
      MEDICAL_SYSTEM_PROMPT: 'Mock system prompt',
    }));

    aiService = require('./ai.service');
    mockOpenAIModule = require('../config/openai');
  });

  describe('analyzeSymptoms fallback tests', () => {
    const context = {
      symptoms: ['headache', 'fever'],
      patientAge: 30,
      patientGender: 'Male',
      bloodType: 'O+',
      chronicConditions: 'None',
      allergies: 'None',
      duration: '2 days',
      additionalNotes: '',
      region: 'East Africa',
    };

    it('should use fallback analysis if openai is not configured (null/undefined)', async () => {
      // Re-setup the mock with null openai
      jest.resetModules();
      jest.mock('../config/openai', () => ({
        openai: null,
        AI_CONFIG: {
          provider: 'openai',
          model: 'gpt-4-turbo-preview',
          maxTokens: 2000,
          temperature: 0.3,
        },
        MEDICAL_SYSTEM_PROMPT: 'Mock system prompt',
      }));

      const freshAIService = require('./ai.service');
      const freshLogger = require('../utils/logger.util');

      const result = await freshAIService.analyzeSymptoms(context);

      expect(freshLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('AI provider not configured')
      );
      expect(result).toEqual(freshAIService.getFallbackAnalysis(context.symptoms));
    });

    it('should use fallback analysis if openai API call fails', async () => {
      mockOpenAIObject.chat.completions.create.mockRejectedValue(new Error('API Connection Refused'));

      const result = await aiService.analyzeSymptoms(context);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('AI API error')
      );
      expect(result).toEqual(aiService.getFallbackAnalysis(context.symptoms));
    });

    it('should attempt a retry on 503/429 error and then use fallback if retry also fails', async () => {
      const error503 = new Error('Service Unavailable');
      error503.status = 503;

      mockOpenAIObject.chat.completions.create.mockRejectedValue(error503);

      // Spy on setTimeout to not actually wait 3s
      jest.spyOn(global, 'setTimeout').mockImplementation(cb => cb());

      const result = await aiService.analyzeSymptoms(context);

      // Verify retry warning and retry error
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('HuggingFace model may be loading')
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('AI retry also failed')
      );
      expect(result).toEqual(aiService.getFallbackAnalysis(context.symptoms));

      jest.restoreAllMocks();
    });

    it('should enforce 20s timeout and use fallback when API takes too long', async () => {
      // Create a mock that never resolves
      mockOpenAIObject.chat.completions.create.mockReturnValue(new Promise(() => {}));

      // Speed up timer for setTimeout inside the race
      jest.useFakeTimers();

      const analysisPromise = aiService.analyzeSymptoms(context);

      // Fast forward the timers to trigger the 20s timeout
      jest.advanceTimersByTime(20000);

      const result = await analysisPromise;

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('HF_TIMEOUT')
      );
      expect(result).toEqual(aiService.getFallbackAnalysis(context.symptoms));

      jest.useRealTimers();
    });

    it('should successfully parse valid OpenAI response and handle missing disclaimer / invalid urgencyLevel', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                possibleConditions: [
                  {
                    name: 'Common Cold',
                    icd10Code: 'J00',
                    probability: 'high',
                    confidenceScore: 90,
                    description: 'A mild viral infection',
                    symptoms: ['headache', 'fever'],
                  },
                ],
                urgencyLevel: 'INVALID_URGENCY',
                urgencyReason: 'Mild symptoms',
                recommendedActions: ['Rest'],
                followUpQuestions: [],
                summary: 'Common Cold suspected',
              }),
            },
          },
        ],
      };

      mockOpenAIObject.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await aiService.analyzeSymptoms(context);

      // Check default disclaimer is added since mockResponse didn't have one
      expect(result.disclaimer).toContain('This analysis is for informational purposes only');
      // Check invalid urgency level is mapped to MEDIUM
      expect(result.urgencyLevel).toBe('MEDIUM');
    });
  });

  describe('generateFollowUpQuestions fallback tests', () => {
    it('should return default questions if openai is unconfigured', async () => {
      // Re-setup the mock with null openai
      jest.resetModules();
      jest.mock('../config/openai', () => ({
        openai: null,
        AI_CONFIG: {
          provider: 'openai',
          model: 'gpt-4-turbo-preview',
          maxTokens: 2000,
          temperature: 0.3,
        },
        MEDICAL_SYSTEM_PROMPT: 'Mock system prompt',
      }));

      const freshAIService = require('./ai.service');

      const result = await freshAIService.generateFollowUpQuestions(['headache']);

      expect(result.questions).toHaveLength(3);
      expect(result.questions[0].id).toBe('q1');
    });

    it('should return default questions if openai call fails', async () => {
      mockOpenAIObject.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await aiService.generateFollowUpQuestions(['headache']);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Follow-up generation error'),
        expect.any(String)
      );
      expect(result.questions).toHaveLength(3);
      expect(result.questions[0].id).toBe('q1');
    });
  });

  describe('recommendDoctors fallback tests', () => {
    const mockDoctors = [
      { id: 'doc1', first_name: 'John', last_name: 'Doe', rating: 4.5, total_reviews: 20, distance_km: 4, city: 'Kampala' },
      { id: 'doc2', first_name: 'Jane', last_name: 'Smith', rating: 4.8, total_reviews: 5, distance_km: 12, city: 'Nairobi' },
    ];

    it('should use fallback ranking if openai is unconfigured', async () => {
      // Re-setup the mock with null openai
      jest.resetModules();
      jest.mock('../config/openai', () => ({
        openai: null,
        AI_CONFIG: {
          provider: 'openai',
          model: 'gpt-4-turbo-preview',
          maxTokens: 2000,
          temperature: 0.3,
        },
        MEDICAL_SYSTEM_PROMPT: 'Mock system prompt',
      }));

      const freshAIService = require('./ai.service');

      const result = await freshAIService.recommendDoctors(['headache'], mockDoctors, { city: 'Kampala' });

      // Check results are sorted by matchScore
      expect(result).toBeDefined();
      expect(result.length).toBeLessThanOrEqual(5);
      expect(result[0].matchScore).toBeGreaterThanOrEqual(result[1].matchScore);
    });

    it('should use fallback ranking if doctor list is empty', async () => {
      mockOpenAIObject.chat.completions.create.mockReset();

      const result = await aiService.recommendDoctors(['headache'], [], { city: 'Kampala' });
      expect(result).toEqual([]);
      expect(mockOpenAIObject.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should use fallback ranking if openai call fails', async () => {
      mockOpenAIObject.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await aiService.recommendDoctors(['headache'], mockDoctors, { city: 'Kampala' });

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Doctor recommendation AI error'),
        expect.any(String)
      );
      expect(result).toBeDefined();
    });
  });

  describe('recommendDoctorsForReport fallback tests', () => {
    const mockDoctors = [
      { id: 'doc1', first_name: 'John', last_name: 'Doe', rating: 4.5, total_reviews: 20, distance_km: 4, city: 'Kampala' },
    ];

    it('should fallback if symptoms list is empty', async () => {
      const analysisResult = {
        possibleConditions: [],
        symptoms: [],
      };

      const result = await aiService.recommendDoctorsForReport(analysisResult, mockDoctors, { city: 'Kampala' });
      expect(result).toBeDefined();
      expect(result[0].id).toBe('doc1');
    });
  });
});
