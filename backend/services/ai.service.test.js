const { recommendDoctorsForReport } = require('./ai.service');
const { openai } = require('../config/openai');

// Mock the openai module
jest.mock('../config/openai', () => {
  const mockCreate = jest.fn();
  return {
    openai: {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    },
    AI_CONFIG: {
      provider: 'openai',
      model: 'gpt-4-turbo-preview',
    },
    MEDICAL_SYSTEM_PROMPT: 'System prompt',
  };
});

describe('recommendDoctorsForReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should fallback when analysisResult has no possibleConditions and no symptoms', async () => {
    const analysisResult = {};
    const availableDoctors = [
      { id: 'doc1', rating: 4.5, total_reviews: 10, distance_km: 2 },
      { id: 'doc2', rating: 4.8, total_reviews: 20, distance_km: 10 },
    ];
    const patientContext = { city: 'Nairobi' };

    const result = await recommendDoctorsForReport(analysisResult, availableDoctors, patientContext);

    // It should rank doctors based on ratings/distance, etc.
    expect(result.length).toBe(2);
    expect(result[0].id).toBe('doc1'); // doc1 is closer (2km vs 10km) and rating/reviews are high, leading to a higher fallback score
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
  });

  test('should fallback when symptoms are empty after merging', async () => {
    const analysisResult = {
      symptoms: ['', null, undefined],
      possibleConditions: [{ name: '' }],
    };
    const availableDoctors = [
      { id: 'doc1', rating: 4.5, total_reviews: 10, distance_km: 2 },
    ];
    const patientContext = { city: 'Nairobi' };

    const result = await recommendDoctorsForReport(analysisResult, availableDoctors, patientContext);

    expect(result.length).toBe(1);
    expect(result[0].id).toBe('doc1');
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
  });

  test('should recommend doctors using AI when possibleConditions/symptoms are present', async () => {
    const analysisResult = {
      symptoms: ['Fever'],
      possibleConditions: [{ name: 'Malaria' }],
    };
    const availableDoctors = [
      { id: 'doc1', first_name: 'John', last_name: 'Doe', rating: 4.5 },
      { id: 'doc2', first_name: 'Jane', last_name: 'Smith', rating: 4.8 },
    ];
    const patientContext = { city: 'Nairobi' };

    // Mock AI response
    openai.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              recommendations: [
                { doctorId: 'doc1', matchScore: 95, matchReason: 'Fits perfectly' },
              ],
            }),
          },
        },
      ],
    });

    const result = await recommendDoctorsForReport(analysisResult, availableDoctors, patientContext);

    expect(openai.chat.completions.create).toHaveBeenCalledTimes(1);

    // Check that symptoms passed to AI contain both Fever and Malaria
    const callArgs = openai.chat.completions.create.mock.calls[0][0];
    expect(callArgs.messages[1].content).toContain('Fever, Malaria');

    // Result should merge AI recommendation score & reason with doctor details
    expect(result.length).toBe(1);
    expect(result[0]).toEqual(expect.objectContaining({
      id: 'doc1',
      matchScore: 95,
      matchReason: 'Fits perfectly',
    }));
  });

  test('should fallback to rankDoctorsFallback when AI doctor recommendation throws an error', async () => {
    const analysisResult = {
      symptoms: ['Fever'],
    };
    const availableDoctors = [
      { id: 'doc1', rating: 4.5, total_reviews: 10, distance_km: 2 },
    ];
    const patientContext = { city: 'Nairobi' };

    // Mock AI failure
    openai.chat.completions.create.mockRejectedValue(new Error('AI Service Down'));

    const result = await recommendDoctorsForReport(analysisResult, availableDoctors, patientContext);

    // Should return fallback ranked doctor list
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('doc1');
  });
});
