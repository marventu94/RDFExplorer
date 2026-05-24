export interface SurveyData {
  startUrl: 'https://explorer.csrg.cl' | 'https://query.wikidata.org';
  user: { gender: string; age: number | null; degree: string | null };
  tasks: ReadonlyArray<{ on: string | null; sparql: string | null; time: number | null }>;
  tlx: ReadonlyArray<{ on: string | null; score: number[] }>;
  likert: ReadonlyArray<{ on: string | null; score: number[] }>;
}

export interface TlxDimension {
  category: string;
  text: string;
  lmin: string;
  lmax: string;
}

export interface LikertPrompt {
  text: string;
  lmin: string;
  lmax: string;
}
