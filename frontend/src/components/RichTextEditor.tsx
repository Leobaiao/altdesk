import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { 
  Bold, 
  Italic, 
  Strikethrough, 
  List, 
  ListOrdered, 
  Heading1, 
  Heading2, 
  Quote, 
  Undo, 
  Redo 
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  const btnStyle = (isActive: boolean) => ({
    background: isActive ? 'var(--bg-secondary)' : 'transparent',
    border: 'none',
    borderRadius: '4px',
    padding: '6px',
    cursor: 'pointer',
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
  });

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px',
      padding: '8px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-primary)',
      borderTopLeftRadius: '8px',
      borderTopRightRadius: '8px',
    }}>
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        style={btnStyle(editor.isActive('bold'))}
        title="Bold"
        type="button"
      >
        <Bold size={16} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        style={btnStyle(editor.isActive('italic'))}
        title="Italic"
        type="button"
      >
        <Italic size={16} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        style={btnStyle(editor.isActive('strike'))}
        title="Strikethrough"
        type="button"
      >
        <Strikethrough size={16} />
      </button>
      
      <div style={{ width: '1px', background: 'var(--border)', margin: '0 4px' }} />
      
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        style={btnStyle(editor.isActive('heading', { level: 1 }))}
        title="Heading 1"
        type="button"
      >
        <Heading1 size={16} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        style={btnStyle(editor.isActive('heading', { level: 2 }))}
        title="Heading 2"
        type="button"
      >
        <Heading2 size={16} />
      </button>
      
      <div style={{ width: '1px', background: 'var(--border)', margin: '0 4px' }} />

      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        style={btnStyle(editor.isActive('bulletList'))}
        title="Bullet List"
        type="button"
      >
        <List size={16} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        style={btnStyle(editor.isActive('orderedList'))}
        title="Ordered List"
        type="button"
      >
        <ListOrdered size={16} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        style={btnStyle(editor.isActive('blockquote'))}
        title="Blockquote"
        type="button"
      >
        <Quote size={16} />
      </button>

      <div style={{ width: '1px', background: 'var(--border)', margin: '0 4px' }} />

      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        style={btnStyle(false)}
        title="Undo"
        type="button"
      >
        <Undo size={16} />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        style={btnStyle(false)}
        title="Redo"
        type="button"
      >
        <Redo size={16} />
      </button>
    </div>
  );
};

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange, placeholder }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content',
        style: 'padding: 16px; min-height: 250px; outline: none;',
      },
    },
  });

  // Estilos globais injetados para o Tiptap
  // Isso garante que tags como parágrafos e listas tenham espaçamento dentro do editor
  React.useEffect(() => {
    const styleId = 'tiptap-global-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            .tiptap-container {
                border: 1px solid var(--border);
                border-radius: 8px;
                background: var(--bg-primary);
                overflow: hidden;
            }
            .tiptap-container .ProseMirror {
                outline: none;
                color: var(--text-primary);
                line-height: 1.6;
            }
            .tiptap-container .ProseMirror p {
                margin: 0 0 1em 0;
            }
            .tiptap-container .ProseMirror h1, 
            .tiptap-container .ProseMirror h2, 
            .tiptap-container .ProseMirror h3 {
                margin: 1.5em 0 0.5em 0;
                line-height: 1.2;
            }
            .tiptap-container .ProseMirror h1 { font-size: 1.8em; }
            .tiptap-container .ProseMirror h2 { font-size: 1.5em; }
            .tiptap-container .ProseMirror ul,
            .tiptap-container .ProseMirror ol {
                padding: 0 1rem;
                margin: 0 0 1em 0;
            }
            .tiptap-container .ProseMirror ul { list-style-type: disc; }
            .tiptap-container .ProseMirror ol { list-style-type: decimal; }
            .tiptap-container .ProseMirror blockquote {
                border-left: 3px solid var(--border);
                margin: 1.5rem 0;
                padding-left: 1rem;
                font-style: italic;
                color: var(--text-secondary);
            }
            .tiptap-container .ProseMirror p.is-editor-empty:first-child::before {
                content: attr(data-placeholder);
                float: left;
                color: var(--text-secondary);
                pointer-events: none;
                height: 0;
            }
        `;
        document.head.appendChild(style);
    }
  }, []);

  return (
    <div className="tiptap-container">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
