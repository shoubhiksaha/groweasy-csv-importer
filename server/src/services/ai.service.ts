import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';
import { getSystemPrompt } from '../prompts/extraction.prompt';

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

export const inferColumnMappingWithAI = async (headers: string[], sampleRows: any[]): Promise<Record<string, string | null>> => {
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

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  try {
    return JSON.parse(responseText);
  } catch (error) {
    throw new Error('AI response was not valid JSON');
  }
};
