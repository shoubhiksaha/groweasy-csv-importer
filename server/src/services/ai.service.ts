import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';
import { getSystemPrompt } from '../prompts/extraction.prompt';

const getGenAI = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables.');
  }
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
};

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
    
    if (k.match(/^(email|e-mail|mail|user_email|primary_mail)$/) || k.includes('email') || k.includes('mail')) {
      hints.email = value;
    } else if (k.match(/^(phone|mobile|contact|ph|phone_number|mobile_number)$/) || k.includes('phone') || k.includes('contact') || k.includes('mobile')) {
      hints.mobile_without_country_code = value;
    } else if (k.match(/^(name|full_name|client_name|person|user_name)$/) || k.includes('name')) {
      hints.name = value;
    }
  }
  return hints;
};

export const extractCrmDataWithAI = async (headers: string[], batch: any[]) => {
  const genAI = getGenAI();

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
    const rawJson = JSON.parse(responseText);
    // Validate with Zod (strips unknown fields, enforces types)
    // Here we just use safeParse or parse. We'll return raw if it fails for now to avoid breaking the pipeline,
    // or just let Zod throw and the batch will retry. We'll let it throw.
    // Actually wait, some emails might be dirty in rawJson before post-processing.
    // Let's just return rawJson for now. We use Zod in batch service.
    return rawJson;
  } catch (error) {
    throw new Error('AI response was not valid JSON');
  }
};
