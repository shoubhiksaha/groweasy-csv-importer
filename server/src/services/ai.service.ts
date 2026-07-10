import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';

const getGenAI = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables.');
  }
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
};

const mappingSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    created_at: { type: SchemaType.STRING, nullable: true },
    name: { type: SchemaType.STRING, nullable: true },
    email: { type: SchemaType.STRING, nullable: true },
    country_code: { type: SchemaType.STRING, nullable: true },
    mobile_without_country_code: { type: SchemaType.STRING, nullable: true },
    company: { type: SchemaType.STRING, nullable: true },
    city: { type: SchemaType.STRING, nullable: true },
    state: { type: SchemaType.STRING, nullable: true },
    country: { type: SchemaType.STRING, nullable: true },
    lead_owner: { type: SchemaType.STRING, nullable: true },
    crm_status: { type: SchemaType.STRING, nullable: true },
    crm_note: { type: SchemaType.STRING, nullable: true },
    data_source: { type: SchemaType.STRING, nullable: true },
    possession_time: { type: SchemaType.STRING, nullable: true },
    description: { type: SchemaType.STRING, nullable: true },
  },
};

export const inferColumnMappingWithAI = async (headers: string[], sampleRows: any[], maxRetries = 3): Promise<Record<string, string | null>> => {
  const genAI = getGenAI();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: `You are a CRM data mapping expert. Your job is to analyze CSV headers and a few sample rows, and map them to the GrowEasy CRM fields. Return a JSON object where keys are the CRM fields and values are the exact CSV column headers. If a field does not exist, return null.`,
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: mappingSchema,
    },
  });

  const prompt = `
  CSV Headers: ${JSON.stringify(headers)}
  Sample Rows:
  ${JSON.stringify(sampleRows, null, 2)}
  
  Map these to: created_at, name, email, country_code, mobile_without_country_code, company, city, state, country, lead_owner, crm_status, crm_note, data_source, possession_time, description.
  Return only the JSON object mapping CRM fields to CSV headers.
  `;

  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      return JSON.parse(responseText);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        // Wait before retrying (1s, 2s, etc)
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  throw new Error(`AI mapping failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
};
