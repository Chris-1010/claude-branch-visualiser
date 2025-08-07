import React from 'react';
import Markdown from 'markdown-to-jsx';

interface MessageContentRendererProps {
  content: string;
}

const MessageContentRenderer: React.FC<MessageContentRendererProps> = ({ content }) => {
  //#region Markdown Options
  const markdownOptions = {
    overrides: {
      code: {
        component: ({ children, className, ...props }: any) => {
          // Handle code blocks vs inline code
          const isBlock = className?.includes('lang-') || props.block;
          
          if (isBlock) {
            const language = className?.replace('lang-', '') || '';
            return (
              <div className="code code-block">
                {language && <div className="code-language">{language}</div>}
                <pre><code {...props}>{children}</code></pre>
              </div>
            );
          }
          
          return <code className="code code-inline" {...props}>{children}</code>;
        }
      },
      pre: {
        component: ({ children, ...props }: any) => {
          // Extract language from code element if present
          const codeElement = React.Children.only(children);
          const language = codeElement?.props?.className?.replace('lang-', '') || '';
          
          return (
            <div className="code code-block">
              {language && <div className="code-language">{language}</div>}
              <pre {...props}>{children}</pre>
            </div>
          );
        }
      },
      h1: { props: { className: 'message-h1' } },
      h2: { props: { className: 'message-h2' } },
      h3: { props: { className: 'message-h3' } },
      h4: { props: { className: 'message-h4' } },
      h5: { props: { className: 'message-h5' } },
      h6: { props: { className: 'message-h6' } },
      strong: { props: { className: 'message-bold' } },
      em: { props: { className: 'message-italic' } },
      blockquote: { props: { className: 'message-blockquote' } },
      ul: { props: { className: 'message-ul' } },
      ol: { props: { className: 'message-ol' } },
      li: { props: { className: 'message-li' } },
      p: { props: { className: 'message-paragraph' } }
    }
  };
  //#endregion

  return (
    <div className="message-content-parsed">
      <Markdown options={markdownOptions}>{content}</Markdown>
    </div>
  );
};

export default MessageContentRenderer;