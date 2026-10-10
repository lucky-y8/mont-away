import { createRoot } from 'react-dom/client';
import StudyApp from './StudyApp';
import rawQuestions from '../data/questions.json';
import type { Question } from './types';
import './style.css';
const questions = rawQuestions.map(q => ({ ...q, sourceUrl: `/study-assets${q.sourceUrl}`, figures: q.figures.map(p => `/study-assets${p}`) })) as Question[];
createRoot(document.getElementById('root')!).render(<StudyApp initialQuestions={questions} />);
