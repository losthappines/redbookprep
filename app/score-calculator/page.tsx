import type { Metadata } from 'next';
import { SatScoreCalculator } from '@/components/score-calculator/sat-score-calculator';

export const metadata: Metadata = {
  title: 'Digital SAT Score Calculator (400–1600)',
  description:
    'Estimate your Digital SAT score from 400 to 1600 using adaptive Module 1 and Module 2 raw scores for Reading & Writing and Math, with IRT score ranges and percentile estimates.',
  alternates: {
    canonical: 'https://www.redbookprep.site/score-calculator',
  },
  openGraph: {
    type: 'website',
    url: 'https://www.redbookprep.site/score-calculator',
    siteName: 'RedBookPrep',
    title: 'Digital SAT Score Calculator | RedBookPrep',
    description:
      'Convert your Digital SAT Reading & Writing and Math Module 1 & Module 2 raw scores into a 400–1600 estimate with adaptive routing insights.',
  },
};

export default function ScoreCalculatorPage() {
  return <SatScoreCalculator />;
}
