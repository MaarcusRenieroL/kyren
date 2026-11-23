export type RichTextEditorProps = {
  value: string;
  placeholder?: string;
  maxLength?: number;
  minHeightClassName?: string;
  disabled?: boolean;
  /** Save and Cancel: always, never, or once the text has changed. */
  showActions?: boolean | "dirty";
  onChange?: (value: string) => void;
  onSave: (value: string) => void;
  onCancel?: () => void;
};


export const richTextContentClassName =
  "max-w-none text-sm leading-6 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_a]:text-primary [&_a]:underline [&_mark]:rounded [&_mark]:bg-warning-subtle [&_mark]:px-0.5 [&_mark]:text-warning-text [&_ul[data-type='taskList']]:ml-0 [&_ul[data-type='taskList']]:list-none [&_li[data-type='taskItem']]:flex [&_li[data-type='taskItem']]:gap-2 [&_li[data-type='taskItem']>label]:pt-1 [&>*+*]:mt-3 [&_ul[data-type='taskList']>li]:flex [&_ul[data-type='taskList']>li]:items-start [&_ul[data-type='taskList']>li]:gap-2.5 [&_ul[data-type='taskList']_input]:mt-1 [&_ul[data-type='taskList']_input]:size-4 [&_ul[data-type='taskList']_input]:accent-ink [&_li[data-checked='true']>div]:text-ink-3 [&_li[data-checked='true']>div]:line-through [&_code]:rounded-[6px] [&_code]:bg-hover [&_code]:px-1.5 [&_code]:py-px [&_code]:font-mono [&_code]:text-[13px]";


export const editorShellClassName =
  "min-h-24 max-w-none px-3.5 py-3 text-[15px] leading-6 outline-none [&_.ProseMirror]:min-h-[60px] [&_.ProseMirror]:outline-none [&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-semibold [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_ul]:ml-5 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ol]:ml-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_blockquote]:text-muted-foreground [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:rounded-md [&_.ProseMirror_pre]:bg-muted [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-muted [&_.ProseMirror_code]:px-1 [&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:underline [&_.ProseMirror_mark]:rounded [&_.ProseMirror_mark]:bg-warning-subtle [&_.ProseMirror_mark]:px-0.5 [&_.ProseMirror_mark]:text-warning-text [&_.ProseMirror_ul[data-type='taskList']]:ml-0 [&_.ProseMirror_ul[data-type='taskList']]:list-none [&_.ProseMirror_li[data-type='taskItem']]:flex [&_.ProseMirror_li[data-type='taskItem']]:gap-2 [&_.ProseMirror_li[data-type='taskItem']>label]:pt-1 [&_.ProseMirror>*+*]:mt-3 [&_.ProseMirror_ul[data-type='taskList']>li]:flex [&_.ProseMirror_ul[data-type='taskList']>li]:items-start [&_.ProseMirror_ul[data-type='taskList']>li]:gap-2.5 [&_.ProseMirror_ul[data-type='taskList']_input]:mt-1 [&_.ProseMirror_ul[data-type='taskList']_input]:size-4 [&_.ProseMirror_ul[data-type='taskList']_input]:accent-ink [&_.ProseMirror_li[data-checked='true']>div]:text-ink-3 [&_.ProseMirror_li[data-checked='true']>div]:line-through [&_.ProseMirror_code]:rounded-[6px] [&_.ProseMirror_code]:bg-hover [&_.ProseMirror_code]:px-1.5 [&_.ProseMirror_code]:py-px [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-[13px]";


export type RichTextPreviewProps = {
  value: string;
  emptyLabel?: string;
  className?: string;
};
