import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';
import { getSystemPrompt } from '../prompts/extraction.prompt';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('GEMINI_API_KEY is missing from environment variables');
}

const genAI = new GoogleGenerativeAI(apiKey || '');

const crmRecordSchema: Schema = {
  type: SchemaType.ARRAY,
  items: {
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
  },
};

const preMapRecord = (record: Record<string, any>) => {
  const hints: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    const k = key.toLowerCase().trim();
    if (!value) continue;
    
    if (k.match(/^(email|e-mail|mail)$/)) {
      hints.email = value;
    } else if (k.match(/^(phone|mobile|contact|ph|phone_number|mobile_number)$/)) {
      hints.mobile_without_country_code = value;
    } else if (k.match(/^(name|full_name|client_name|person)$/)) {
      hints.name = value;
    }
  }
  return hints;
};

export const extractCrmDataWithAI = async (headers: string[], batch: any[]) => {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: getSystemPrompt(),
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: crmRecordSchema,
    },
  });

  const recordsWithHints = batch.map(record => ({
    original: record,
    obvious_hints: preMapRecord(record)
  }));

  const prompt = `
  Here are the CSV column headers: ${JSON.stringify(headers)}
  Here are the records to process (with some obvious fields pre-mapped as hints):
  ${JSON.stringify(recordsWithHints, null, 2)}
  
  Map each record's "original" data to GrowEasy CRM format. Use the "obvious_hints" to save effort. Return a JSON array.
  `;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  try {
    return JSON.parse(responseText);
  } catch (error) {
    throw new Error('AI response was not valid JSON');
  }
};
