import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Digital SAT Score Predictor — RedBookPrep',
  description:
    'Estimate your adaptive Digital SAT Reading & Writing and Math score (400–1600), percentile, and target gap.',
  alternates: { canonical: 'https://www.redbookprep.site/score-predictor' },
};

export default function ScorePredictorRedirect() {
  redirect('/score-calculator');
}
