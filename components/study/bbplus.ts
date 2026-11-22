import {formatSkillTitle} from '@/lib/format-skill';

export type ExplanationMethod = {
  title: string;
  badge?: string;
  steps: string[];
  desmosExpressions?: string[];
};

export type PracticeQuestion = {
  id: string;
  skill: string;
  section: string;
  domain: string;
  focus: string;
  source: string;
  questionType: 'mcq' | 'spr';
  passageTitle: string;
  passage: string;
  prompt: string;
  options: { text: string; letter: string }[];
  answer: number;
  sprAnswers?: string[];
  explanation: string;
  explanationMethods?: ExplanationMethod[];
  desmosExpressions?: string[];
  svgDiagram?: string;
  difficulty?: number;
  isChallenge?: boolean;
  peerTimeSeconds?: { p25: number; p50: number; p75: number };
  imageDataUrl?: string;
  imageAlt?: string;
  moduleId?: string;
  materialTitle?: string;
  moduleTitle?: string;
};

const text = (value: unknown, label: string, required = false) => {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > 120000 || (required && !value.trim())) {
    throw Error(`${label} must be valid text.`);
  }
  return value;
};

export function parseBbplus(input: unknown, key: string): PracticeQuestion[] {
  if (!input || typeof input !== 'object') throw Error('This is not a .bbplus practice file.');
  const pack = input as Record<string, unknown>;
  if (pack.format !== 'bbplus' || pack.version !== 1) {
    throw Error('Only .bbplus version 1 is supported.');
  }
  if (pack.type === 'flashcards') {
    throw Error('This file contains flashcards. Import it from the Vocabulary tab.');
  }
  if (pack.type !== undefined && pack.type !== 'practice') {
    throw Error('Unknown material type.');
  }
  const title = text(pack.title, 'Material title', true);
  if (!Array.isArray(pack.modules) || !pack.modules.length || pack.modules.length > 100) {
    throw Error('The file must contain 1–100 practice modules.');
  }

  const result: PracticeQuestion[] = [];
  pack.modules.forEach((raw, mi) => {
    if (!raw || typeof raw !== 'object') throw Error(`Module ${mi + 1} is invalid.`);
    const m = raw as Record<string, unknown>;
    const rawModuleTitle = text(m.title, `Module ${mi + 1} title`) || `Module ${mi + 1}`;
    const moduleTitle = formatSkillTitle(rawModuleTitle);
    if (m.section !== 'reading' && m.section !== 'math') {
      throw Error(`Module ${mi + 1}: section must be reading or math.`);
    }
    if (!Array.isArray(m.questions) || !m.questions.length) {
      throw Error(`Module ${mi + 1} has no questions.`);
    }

    m.questions.forEach((rawQ, qi) => {
      if (!rawQ || typeof rawQ !== 'object') throw Error(`Question ${qi + 1} is invalid.`);
      const q = rawQ as Record<string, unknown>;
      const label = `Module ${mi + 1}, question ${qi + 1}`;

      const sprAnswersRaw = Array.isArray(q.sprAnswers)
        ? q.sprAnswers.map((v) => String(v).trim()).filter(Boolean)
        : [];
      const questionType: 'mcq' | 'spr' =
        q.questionType === 'spr' || (sprAnswersRaw.length > 0 && (!Array.isArray(q.options) || q.options.length === 0))
          ? 'spr'
          : 'mcq';

      let options: { text: string; letter: string }[] = [];
      let answer = 0;

      if (questionType === 'mcq') {
        if (!Array.isArray(q.options) || q.options.length !== 4) {
          throw Error(`${label}: four answer choices are required for multiple-choice questions.`);
        }
        if (!Number.isInteger(q.answer) || Number(q.answer) < 0 || Number(q.answer) > 3) {
          throw Error(`${label}: answer must be an index from 0 to 3.`);
        }
        options = q.options.map((v, i) => ({
          text: text(v, `${label} choice`, true),
          letter: 'ABCD'[i],
        }));
        answer = Number(q.answer);
      } else {
        if (!sprAnswersRaw.length) {
          throw Error(`${label}: sprAnswers are required for student-produced response questions.`);
        }
      }

      let imageDataUrl: string | undefined;
      if (q.imageDataUrl) {
        if (
          typeof q.imageDataUrl === 'string' &&
          (q.imageDataUrl.startsWith('/') || q.imageDataUrl.startsWith('http'))
        ) {
          imageDataUrl = q.imageDataUrl;
        } else {
          if (
            typeof q.imageDataUrl !== 'string' ||
            q.imageDataUrl.length > 1400000 ||
            !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(q.imageDataUrl)
          ) {
            throw Error(`${label}: image must be an embedded PNG or JPEG.`);
          }
          let bytes: string;
          try {
            bytes = atob(q.imageDataUrl.split(',')[1]);
          } catch {
            throw Error(`${label}: invalid image encoding.`);
          }
          if (
            !(q.imageDataUrl.startsWith('data:image/png;') && bytes.startsWith('\x89PNG\r\n\x1a\n')) &&
            !(q.imageDataUrl.startsWith('data:image/jpeg;') && bytes.startsWith('\xff\xd8\xff'))
          ) {
            throw Error(`${label}: invalid image data.`);
          }
          imageDataUrl = q.imageDataUrl;
        }
      }

      const skill = formatSkillTitle(text(q.skill, 'Skill') || rawModuleTitle);
      const difficulty =
        Number.isInteger(q.difficulty) && Number(q.difficulty) >= 1 && Number(q.difficulty) <= 5
          ? Number(q.difficulty)
          : undefined;
      const svgDiagram = typeof q.svgDiagram === 'string' && q.svgDiagram.includes('<svg') ? q.svgDiagram : undefined;
      const desmosExpressions = Array.isArray(q.desmosExpressions)
        ? q.desmosExpressions.filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
        : undefined;
      const explanationMethods = Array.isArray(q.explanationMethods)
        ? (q.explanationMethods.filter(
            (item) =>
              item &&
              typeof item === 'object' &&
              typeof (item as any).title === 'string' &&
              Array.isArray((item as any).steps)
          ) as ExplanationMethod[])
        : undefined;

      result.push({
        imageDataUrl,
        imageAlt: text(q.imageAlt, 'Image description'),
        svgDiagram,
        id: `bbplus-${key}-${mi}-${qi}`,
        moduleId: `bbplus-${key}-${mi}`,
        materialTitle: title,
        moduleTitle,
        skill,
        domain: text(q.domain, 'Domain') || title.replace(/^.*—\s*/, '') || 'Unclassified',
        focus: text(q.focus, 'Focus') || moduleTitle,
        source: text(q.source, 'Source') || `Imported · ${title}`,
        questionType,
        passageTitle: text(q.passageTitle, 'Passage title') || moduleTitle,
        passage: text(q.passage, 'Passage'),
        prompt: text(q.prompt, `${label} prompt`, true),
        options,
        answer,
        sprAnswers: sprAnswersRaw.length ? sprAnswersRaw : undefined,
        explanation:
          text(q.explanation, 'Explanation') || 'No explanation was provided in this material.',
        explanationMethods,
        desmosExpressions,
        difficulty,
        isChallenge: Boolean(q.isChallenge) || (difficulty !== undefined && difficulty >= 4),
      });

      if (result.length > 1000) throw Error('A material can contain at most 1,000 questions.');
    });
  });
  return result;
}
