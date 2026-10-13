export type QuestionType = "single" | "multiple" | "short" | "calculation" | "truefalse" | "fill";
export type Source = "course" | "ai" | "missing" | "community";
export interface Question {
  id: string; chapter: number; chapterTitle: string; type: QuestionType;
  stem: string; options: string[]; answer: string; explanation: string;
  answerSource: Source; explanationSource: Source; sourceFile: string; sourceUrl: string;
  pages: number[]; figures: string[]; tags: string[]; needsReview: boolean;
  origin?: "upload";
  answerFigures?: string[]; figuresContainAnswer?: boolean; materialId?: string; sourceQuestion?: string;
  revision?: number; editor?: string; editedAt?: string;
}
export interface Revision { revision: number; editor: string; editedAt: string; question: Question }
export const typeNames: Record<QuestionType, string> = {
  fill: "填空题", single: "单选题", multiple: "多选题", short: "简答题", calculation: "计算题", truefalse: "判断题",
};
export const sourceNames: Record<Source, string> = {
  course: "资料原文", ai: "AI 辅助生成", community: "同学共同完善", missing: "待补充",
};
