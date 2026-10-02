declare module '@cesur_polat/webquirer' {
  export interface WebquirerChoice {
    name: string;
    value: string;
    description?: string;
  }

  export interface WebquirerQuestion {
    type?: 'input' | 'password' | 'select' | 'confirm';
    presentation?: 'default' | 'buttons';
    name: string;
    message: string;
    default?: string | boolean;
    required?: boolean;
    choices?: readonly (string | WebquirerChoice)[];
    section?: string;
    sectionIcon?: string;
    validate?: (value: string, answers: Record<string, unknown>) => true | string | Promise<true | string>;
  }

  export function inquireWizard(options: {
    title?: string;
    questions: readonly WebquirerQuestion[];
    next: (context: {
      step: number;
      answers: Record<string, unknown>;
      allAnswers: Record<string, unknown>;
    }) => Promise<{ title?: string; questions: readonly WebquirerQuestion[] } | { done: true; result?: unknown } | undefined>;
    open?: boolean;
    timeout?: number;
    onOpen?: (url: string) => void;
  }): Promise<Record<string, unknown>>;

  export function inquire(options: {
    title?: string;
    questions: readonly WebquirerQuestion[];
    open?: boolean;
    timeout?: number;
    onOpen?: (url: string) => void;
  }): Promise<Record<string, unknown>>;
}
